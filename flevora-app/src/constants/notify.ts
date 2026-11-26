import { addDoc, collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../config';

export type NotifType =
  | 'like' | 'comment' | 'reply' | 'follow' | 'follow_request'
  | 'mention' | 'tag' | 'story_like' | 'story_reply' | 'story_reaction' | 'repost' | 'live';

export async function sendNotification(p: {
  toUid: string;
  fromUid: string;
  fromUsername: string;
  type: NotifType;
  message: string;
  postId?: string;
  reelId?: string;
  commentId?: string;
  storyId?: string;
  mediaUrl?: string;
}) {
  if (!p.toUid || !p.fromUid || p.toUid === p.fromUid) return;
  const payload = {
    toUid: p.toUid,
    fromUid: p.fromUid,
    fromUsername: p.fromUsername || 'user',
    type: p.type,
    message: p.message,
    postId: p.postId || '',
    reelId: p.reelId || '',
    commentId: p.commentId || '',
    storyId: p.storyId || '',
    mediaUrl: p.mediaUrl || '',
    read: false,
    actionStatus: p.type === 'follow_request' ? 'pending' : '',
    createdAt: serverTimestamp(),
  };
  const dedup = ['like', 'follow', 'repost', 'story_like'].includes(p.type);
  if (dedup) {
    const key = `${p.type}_${p.fromUid}_${p.toUid}_${p.postId || p.storyId || 'u'}`;
    await setDoc(doc(db, 'notifications', key), payload, { merge: true }).catch(() => {});
  } else {
    await addDoc(collection(db, 'notifications'), payload).catch(() => {});
  }
}
