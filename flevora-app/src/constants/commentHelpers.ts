import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit, increment, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config';
import { sendPush } from './push';

export function getTimeMs(ts: any): number {
  if (!ts) return Date.now();
  if (typeof ts.toMillis === 'function') return ts.toMillis();
  if (typeof ts.seconds === 'number') return ts.seconds * 1000;
  return Date.now();
}

export function sortCommentsStable(list: any[]): any[] {
  return [...list].sort((a, b) => {
    const ap = a.isPinned || a.pinned ? 1 : 0;
    const bp = b.isPinned || b.pinned ? 1 : 0;
    if (ap !== bp) return bp - ap;
    return getTimeMs(a.createdAt) - getTimeMs(b.createdAt);
  });
}

export function containsHiddenWord(text: string, hiddenWords: string[]): boolean {
  if (!Array.isArray(hiddenWords) || hiddenWords.length === 0) return false;
  const lower = text.toLowerCase();
  return hiddenWords.some((w) => w && lower.includes(w.toLowerCase()));
}

async function notifyUser({
  toUid, fromUid, fromUsername, fromAvatar, type, postId, commentId, message, pushBody,
}: {
  toUid: string; fromUid: string; fromUsername: string; fromAvatar: string;
  type: 'comment' | 'mention'; postId: string; commentId: string; message: string; pushBody: string;
}) {
  if (!toUid || toUid === fromUid) return;
  try {
    const targetSnap = await getDoc(doc(db, 'users', toUid));
    if (!targetSnap.exists()) return;
    const tData = targetSnap.data();
    if (Array.isArray(tData.blockedUsers) && tData.blockedUsers.includes(fromUid)) return;
    if (typeof tData.notifPausedUntil === 'number' && tData.notifPausedUntil > Date.now()) return;
    if (type === 'comment' && tData.notifComments === false) return;
    if (type === 'mention' && tData.notifMentions === false) return;

    await setDoc(doc(db, 'notifications', `${type}_${commentId}_${toUid}`), {
      toUid, fromUid, fromUsername, fromAvatar, type, postId, commentId,
      message, read: false, createdAt: serverTimestamp(),
    }, { merge: true });

    const token = tData.pushToken || tData.expoPushToken;
    if (token) sendPush(token, 'Flevora', pushBody);
  } catch {}
}

export async function createCommentOrReply({
  postId, postOwnerUid, parentComment, text, myUid, me,
}: {
  postId: string; postOwnerUid: string; parentComment: any | null; text: string; myUid: string; me: any;
}) {
  const uname = me?.username || 'user';
  const avatar = me?.avatar || me?.photoUrl || '';
  const clean = text.trim();

  if (parentComment) {
    const ref = await addDoc(collection(db, 'posts', postId, 'comments', parentComment.id, 'replies'), {
      uid: myUid, username: uname, userAvatar: avatar, text: clean,
      likes: [], isEdited: false, createdAt: serverTimestamp(),
    });
    await updateDoc(doc(db, 'posts', postId, 'comments', parentComment.id), { repliesCount: increment(1) }).catch(() => {});
    await notifyUser({
      toUid: parentComment.uid, fromUid: myUid, fromUsername: uname, fromAvatar: avatar,
      type: 'comment', postId, commentId: ref.id,
      message: `replied: ${clean}`, pushBody: `@${uname} replied to your comment.`,
    });
    await notifyMentions(clean, postId, ref.id, myUid, uname, avatar);
    return ref.id;
  }

  const ref = await addDoc(collection(db, 'posts', postId, 'comments'), {
    uid: myUid, username: uname, userAvatar: avatar, text: clean,
    likes: [], repliesCount: 0, isPinned: false, isHidden: false, isEdited: false,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) }).catch(() => {});
  await notifyUser({
    toUid: postOwnerUid, fromUid: myUid, fromUsername: uname, fromAvatar: avatar,
    type: 'comment', postId, commentId: ref.id,
    message: `commented: ${clean}`, pushBody: `@${uname} commented on your post.`,
  });
  await notifyMentions(clean, postId, ref.id, myUid, uname, avatar);
  return ref.id;
}

async function notifyMentions(text: string, postId: string, commentId: string, myUid: string, uname: string, avatar: string) {
  const matches = Array.from(new Set((text.match(/@[a-zA-Z0-9._]+/g) || []).map((m) => m.slice(1).toLowerCase()))).slice(0, 5);
  for (const targetUname of matches) {
    const snap = await getDocs(query(collection(db, 'users'), where('username', '==', targetUname), limit(1)));
    if (!snap.empty) {
      await notifyUser({
        toUid: snap.docs[0].id, fromUid: myUid, fromUsername: uname, fromAvatar: avatar,
        type: 'mention', postId, commentId,
        message: `mentioned you in a comment: ${text}`, pushBody: `@${uname} mentioned you in a comment.`,
      });
    }
  }
}

export async function editCommentDoc(postId: string, commentId: string, newText: string, replyId?: string) {
  const ref = replyId
    ? doc(db, 'posts', postId, 'comments', commentId, 'replies', replyId)
    : doc(db, 'posts', postId, 'comments', commentId);
  await updateDoc(ref, { text: newText.trim(), isEdited: true, editedAt: serverTimestamp() });
}

export async function deleteCommentDoc(postId: string, commentId: string, currentPostCount: number, replyId?: string) {
  if (replyId) {
    await deleteDoc(doc(db, 'posts', postId, 'comments', commentId, 'replies', replyId));
    await updateDoc(doc(db, 'posts', postId, 'comments', commentId), { repliesCount: increment(-1) }).catch(() => {});
    return;
  }
  await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));
  if (currentPostCount > 0) {
    await updateDoc(doc(db, 'posts', postId), { commentsCount: increment(-1) }).catch(() => {});
  }
}

export async function togglePinComment(postId: string, comment: any, allComments: any[]) {
  const currentlyPinned = Boolean(comment.isPinned || comment.pinned);
  if (!currentlyPinned) {
    const pinnedCount = allComments.filter((c) => c.isPinned || c.pinned).length;
    if (pinnedCount >= 3) throw new Error('MAX_PIN');
  }
  await updateDoc(doc(db, 'posts', postId, 'comments', comment.id), {
    isPinned: !currentlyPinned,
    pinnedAt: !currentlyPinned ? serverTimestamp() : null,
  });
}

export async function toggleHideComment(postId: string, comment: any) {
  const next = !(comment.isHidden || comment.hidden);
  await updateDoc(doc(db, 'posts', postId, 'comments', comment.id), { isHidden: next });
}

export async function fetchRepliesList(postId: string, commentId: string): Promise<any[]> {
  const snap = await getDocs(
    query(collection(db, 'posts', postId, 'comments', commentId, 'replies'), orderBy('createdAt', 'asc'), limit(30))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
