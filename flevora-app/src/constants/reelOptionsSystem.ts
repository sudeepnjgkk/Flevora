import {
  collection, query, where, orderBy, limit, getDocs, addDoc, updateDoc,
  doc, arrayUnion, arrayRemove, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config';

export const REPORT_CATEGORIES = [
  'Spam',
  'Bullying or harassment',
  'Hate or abusive content',
  'Violence or dangerous content',
  'False information',
  'Intellectual property concern',
  'Scam or fraud',
  'Other',
] as const;

export const NOT_INTERESTED_REASONS = [
  "I don't like this content.",
  'I see too many posts like this.',
  'I am not interested in this topic.',
  "I don't like this creator.",
  'Other',
] as const;

export function canViewReel(reel: any, owner: any, me: any, myUid: string): boolean {
  if (!reel || reel.isDeleted) return false;
  if (owner?.status === 'suspended' || owner?.status === 'deleted') return false;
  if (Array.isArray(me?.blockedUsers) && me.blockedUsers.includes(reel.uid)) return false;
  if (Array.isArray(owner?.blockedUsers) && myUid && owner.blockedUsers.includes(myUid)) return false;
  if (owner?.isPrivate || reel.isPrivate) {
    if (!myUid) return false;
    if (reel.uid === myUid) return true;
    return Array.isArray(me?.following) && me.following.includes(reel.uid);
  }
  return true;
}

export function getAudioMeta(reel: any, owner: any) {
  if (!reel) return { id: '', title: 'Audio Unavailable', artist: '', coverUrl: '', isOriginal: false, restricted: false, available: false };
  if (reel.audioUnavailable) return { id: '', title: 'Audio Unavailable', artist: '', coverUrl: '', isOriginal: false, restricted: false, available: false };
  const username = owner?.username || reel.username || 'user';
  const isOriginal = !reel.audioName;
  return {
    id: reel.audioId || `orig_${reel.uid}`,
    title: reel.audioName || `Original Audio`,
    artist: reel.audioArtist || `@${username}`,
    coverUrl: reel.audioCover || owner?.photoUrl || owner?.avatar || reel.avatar || '',
    isOriginal,
    restricted: Boolean(reel.audioRestricted),
    available: true,
  };
}

export async function fetchReelsWithSameAudio(reel: any, owner: any, me: any, myUid: string, usersMap: Record<string, any>) {
  if (!reel) return [];
  const q = reel.audioId
    ? query(collection(db, 'posts'), where('mediaType', '==', 'video'), where('audioId', '==', reel.audioId), limit(24))
    : query(collection(db, 'posts'), where('mediaType', '==', 'video'), where('uid', '==', reel.uid), orderBy('createdAt', 'desc'), limit(24));
  const snap = await getDocs(q);
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((r: any) => canViewReel(r, usersMap[r.uid] || owner, me, myUid));
}

export function getWhySeeingReasons(reel: any, owner: any, me: any, feedTab: 'forYou' | 'following'): string[] {
  const reasons: string[] = [];
  const uname = owner?.username || reel?.username || 'this creator';
  if (Array.isArray(me?.following) && me.following.includes(reel?.uid)) {
    reasons.push(`You follow @${uname}.`);
  }
  const tags: string[] = Array.isArray(reel?.hashtags) ? reel.hashtags : [];
  const myTags: string[] = Array.isArray(me?.interestedTags) ? me.interestedTags : [];
  if (tags.some((t) => myTags.includes(t))) {
    reasons.push('Matches hashtags/topics you marked as Interested.');
  }
  if ((reel?.views || 0) >= 25 || (reel?.likes?.length || 0) >= 5) {
    reasons.push(`Trending on Flevora (${reel?.views || 0} plays, ${reel?.likes?.length || 0} likes).`);
  }
  if (feedTab === 'following') {
    reasons.push('Displayed in your Following Reels feed.');
  }
  if (!reasons.length) {
    reasons.push('Shown in your For You feed from recent public Reels on Flevora.');
  }
  return reasons;
}

export function canRemixReel(reel: any, owner: any, me: any, myUid: string): { allowed: boolean; reason?: string } {
  if (!myUid) return { allowed: false, reason: 'Please sign in to remix Reels.' };
  if (!canViewReel(reel, owner, me, myUid)) return { allowed: false, reason: 'You do not have permission to access this Reel.' };
  if (reel?.allowRemix === false) return { allowed: false, reason: 'The creator has disabled Remix for this Reel.' };
  if (reel?.audioRestricted) return { allowed: false, reason: 'Remix is unavailable because this Reel uses restricted audio.' };
  return { allowed: true };
}

export async function saveReelInterest({
  reel, myUid, me, interested, reason,
}: {
  reel: any; myUid: string; me: any; interested: boolean; reason?: string;
}): Promise<{ ok: boolean; alreadyMarked?: boolean }> {
  if (!myUid || !reel?.id) throw new Error('Sign in required.');
  const alreadyInterested = Array.isArray(me?.interestedPosts) && me.interestedPosts.includes(reel.id);
  const alreadyNotInterested = Array.isArray(me?.notInterestedPosts) && me.notInterestedPosts.includes(reel.id);
  if (interested && alreadyInterested) return { ok: true, alreadyMarked: true };
  if (!interested && alreadyNotInterested && !reason) return { ok: true, alreadyMarked: true };

  const patch: Record<string, any> = interested
    ? { interestedPosts: arrayUnion(reel.id), notInterestedPosts: arrayRemove(reel.id) }
    : { notInterestedPosts: arrayUnion(reel.id), interestedPosts: arrayRemove(reel.id) };

  if (interested && Array.isArray(reel.hashtags) && reel.hashtags.length > 0) {
    patch.interestedTags = arrayUnion(...reel.hashtags.slice(0, 10));
  }
  if (!interested && reason) {
    patch[`notInterestedReasons.${reel.id}`] = reason;
  }
  await updateDoc(doc(db, 'users', myUid), patch);
  return { ok: true, alreadyMarked: false };
}

export async function fetchMyReelReport(reelId: string, myUid: string) {
  if (!reelId || !myUid) return null;
  const snap = await getDocs(
    query(collection(db, 'reports'), where('postId', '==', reelId), where('reportedBy', '==', myUid), limit(1))
  );
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

export async function submitReelReport({
  reelId, myUid, category, details,
}: {
  reelId: string; myUid: string; category: string; details: string;
}) {
  if (!myUid) throw new Error('Please sign in to submit a report.');
  const existing = await fetchMyReelReport(reelId, myUid);
  if (existing) return { duplicate: true, report: existing };
  const ref = await addDoc(collection(db, 'reports'), {
    postId: reelId,
    type: 'reel',
    category,
    reason: category,
    details: details.trim(),
    status: 'pending',
    reportedBy: myUid,
    reporterUid: myUid,
    createdAt: serverTimestamp(),
  });
  return { duplicate: false, report: { id: ref.id, status: 'pending', category } };
}
