import { Alert } from 'react-native';
import { doc, updateDoc, arrayUnion, arrayRemove, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { sendPush } from './push';

const inFlight = new Set<string>();

export function formatLikeCount(count: number): string {
  if (!count || count < 0) return '0';
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(count);
}

export function formatLikesLabel(count: number): string {
  const safe = Math.max(0, count || 0);
  if (safe === 1) return '1 like';
  return `${formatLikeCount(safe)} likes`;
}

function canNotify(targetUser: any, myUid: string, targetUid: string): boolean {
  if (!targetUid || targetUid === myUid) return false;
  if (!targetUser) return true;
  if (targetUser.notifLikes === false) return false;
  if (typeof targetUser.notifPausedUntil === 'number' && targetUser.notifPausedUntil > Date.now()) return false;
  if (Array.isArray(targetUser.blockedUsers) && targetUser.blockedUsers.includes(myUid)) return false;
  return true;
}

export async function togglePostLike({
  post,
  myUid,
  me,
  targetUser,
  forceLike = false,
  onOptimistic,
  onRollback,
}: {
  post: any;
  myUid: string;
  me?: any;
  targetUser?: any;
  forceLike?: boolean;
  onOptimistic?: (nextLiked: boolean) => void;
  onRollback?: (prevLiked: boolean) => void;
}): Promise<boolean> {
  if (!myUid) {
    Alert.alert('Sign In Required', 'Please sign in to like posts.');
    return false;
  }
  if (!post?.id || post.isDeleted || post.status === 'deleted') return false;

  const currentLikes: string[] = Array.isArray(post.likes) ? post.likes : [];
  const wasLiked = currentLikes.includes(myUid);
  if (forceLike && wasLiked) return true; // Double-tap already liked post ko unlike nahi karega

  const lockKey = `post_${post.id}_${myUid}`;
  if (inFlight.has(lockKey)) return wasLiked;
  inFlight.add(lockKey);

  const nextLiked = !wasLiked;
  onOptimistic?.(nextLiked);

  try {
    await updateDoc(doc(db, 'posts', post.id), {
      likes: nextLiked ? arrayUnion(myUid) : arrayRemove(myUid),
    });

    if (nextLiked && canNotify(targetUser, myUid, post.uid)) {
      const notifId = `like_${post.id}_${myUid}`;
      const isReel = post.mediaType === 'video';
      await setDoc(doc(db, 'notifications', notifId), {
        toUid: post.uid,
        fromUid: myUid,
        fromUsername: me?.username || 'user',
        fromAvatar: me?.avatar || '',
        type: 'like',
        postId: post.id,
        mediaType: post.mediaType || 'image',
        message: isReel ? 'liked your reel.' : 'liked your post.',
        read: false,
        createdAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});

      if (targetUser?.pushToken) {
        sendPush(targetUser.pushToken, 'Flevora', `@${me?.username || 'Someone'} liked your ${isReel ? 'reel' : 'post'}.`);
      }
    }
    return nextLiked;
  } catch {
    onRollback?.(wasLiked);
    Alert.alert('Action Failed', 'Could not update like. Check your internet or permissions.');
    return wasLiked;
  } finally {
    inFlight.delete(lockKey);
  }
}

export async function toggleCommentLike({
  postId,
  comment,
  replyId,
  myUid,
  me,
  targetUser,
}: {
  postId: string;
  comment: any;
  replyId?: string;
  myUid: string;
  me?: any;
  targetUser?: any;
}): Promise<boolean> {
  if (!myUid || !postId || !comment?.id) return false;
  const targetId = replyId || comment.id;
  const lockKey = `comment_${targetId}_${myUid}`;
  if (inFlight.has(lockKey)) return false;
  inFlight.add(lockKey);

  const wasLiked = Array.isArray(comment.likes) && comment.likes.includes(myUid);
  const nextLiked = !wasLiked;
  const ref = replyId
    ? doc(db, 'posts', postId, 'comments', comment.id, 'replies', replyId)
    : doc(db, 'posts', postId, 'comments', comment.id);

  try {
    await updateDoc(ref, { likes: nextLiked ? arrayUnion(myUid) : arrayRemove(myUid) });
    if (nextLiked && canNotify(targetUser, myUid, comment.uid)) {
      await setDoc(doc(db, 'notifications', `clike_${targetId}_${myUid}`), {
        toUid: comment.uid,
        fromUid: myUid,
        fromUsername: me?.username || 'user',
        fromAvatar: me?.avatar || '',
        type: 'like',
        postId,
        commentId: targetId,
        message: 'liked your comment.',
        read: false,
        createdAt: serverTimestamp(),
      }, { merge: true }).catch(() => {});
    }
    return nextLiked;
  } catch {
    return wasLiked;
  } finally {
    inFlight.delete(lockKey);
  }
}
