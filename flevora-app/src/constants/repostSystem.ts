import { Alert } from 'react-native';
import {
  collection, doc, query, where, orderBy, limit, startAfter, getDocs, getDoc,
  updateDoc, setDoc, arrayUnion, arrayRemove, deleteField, serverTimestamp,
  QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { db } from '../config';
import { sendPush } from './push';
import { fetchUsersByIds } from './profileHelpers';

const inFlight = new Set<string>();

export async function toggleRepost({
  post,
  myUid,
  me,
  owner,
  thought,
  forceRemove = false,
  onOptimistic,
  onRollback,
}: {
  post: any;
  myUid: string;
  me?: any;
  owner?: any;
  thought?: string;
  forceRemove?: boolean;
  onOptimistic?: (reposted: boolean, thoughtText?: string) => void;
  onRollback?: (wasReposted: boolean, prevThought?: string) => void;
}): Promise<boolean> {
  if (!myUid) {
    Alert.alert('Sign In Required', 'Please sign in to repost.');
    return false;
  }
  if (!post?.id || post.isDeleted || post.status === 'deleted') {
    Alert.alert('Unavailable', 'This content is no longer available.');
    return false;
  }
  const current: string[] = Array.isArray(post.reposts) ? post.reposts : [];
  const wasReposted = current.includes(myUid);
  const nextReposted = forceRemove ? false : !wasReposted;
  if (forceRemove && !wasReposted) return false;

  const lockKey = `repost_${post.id}_${myUid}`;
  if (inFlight.has(lockKey)) return wasReposted;
  inFlight.add(lockKey);

  const prevThought = post.repostThoughts?.[myUid] || '';
  const cleanThought = (thought || '').trim().slice(0, 200);
  onOptimistic?.(nextReposted, nextReposted ? cleanThought : '');

  try {
    const patch: Record<string, any> = {
      reposts: nextReposted ? arrayUnion(myUid) : arrayRemove(myUid),
    };
    if (nextReposted && cleanThought) patch[`repostThoughts.${myUid}`] = cleanThought;
    else if (!nextReposted) patch[`repostThoughts.${myUid}`] = deleteField();

    await updateDoc(doc(db, 'posts', post.id), patch);

    if (nextReposted && post.uid && post.uid !== myUid) {
      const targetSnap = owner ? null : await getDoc(doc(db, 'users', post.uid)).catch(() => null);
      const tData = owner || targetSnap?.data();
      const blocked = Array.isArray(tData?.blockedUsers) && tData.blockedUsers.includes(myUid);
      const paused = typeof tData?.notifPausedUntil === 'number' && tData.notifPausedUntil > Date.now();
      if (!blocked && !paused) {
        const isReel = post.mediaType === 'video';
        await setDoc(doc(db, 'notifications', `repost_${post.id}_${myUid}`), {
          toUid: post.uid,
          fromUid: myUid,
          fromUsername: me?.username || 'user',
          fromAvatar: me?.avatar || me?.photoUrl || '',
          type: 'repost',
          postId: post.id,
          mediaType: post.mediaType || 'image',
          message: cleanThought ? `reposted: "${cleanThought}"` : `reposted your ${isReel ? 'reel' : 'post'}.`,
          read: false,
          createdAt: serverTimestamp(),
        }, { merge: true }).catch(() => {});

        const token = tData?.pushToken || tData?.expoPushToken;
        if (token) sendPush(token, 'Flevora', `@${me?.username || 'Someone'} reposted your ${isReel ? 'reel' : 'post'}.`);
      }
    }
    return nextReposted;
  } catch {
    onRollback?.(wasReposted, prevThought);
    Alert.alert('Error', 'Could not update repost. Please check your connection.');
    return wasReposted;
  } finally {
    inFlight.delete(lockKey);
  }
}

export async function saveRepostThought(postId: string, myUid: string, thought: string) {
  if (!postId || !myUid) return;
  const clean = thought.trim().slice(0, 200);
  await updateDoc(doc(db, 'posts', postId), {
    [`repostThoughts.${myUid}`]: clean || deleteField(),
  });
}

export async function fetchUserRepostsPage(
  targetUid: string,
  cursor: QueryDocumentSnapshot<DocumentData> | null,
  pageSize = 18
) {
  const qRef = cursor
    ? query(collection(db, 'posts'), where('reposts', 'array-contains', targetUid), orderBy('createdAt', 'desc'), startAfter(cursor), limit(pageSize))
    : query(collection(db, 'posts'), where('reposts', 'array-contains', targetUid), orderBy('createdAt', 'desc'), limit(pageSize));
  const snap = await getDocs(qRef);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p: any) => !p.isDeleted && p.status !== 'deleted'),
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function fetchRepostersUsers(uids: string[]): Promise<any[]> {
  return fetchUsersByIds(uids);
}
