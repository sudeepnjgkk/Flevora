import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  collection, query, where, orderBy, limit, startAfter, getDocs, getDoc,
  doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp,
  QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { db } from '../config';

export type SearchTab = 'top' | 'accounts' | 'posts' | 'reels' | 'tags' | 'places';

// Cloudinary video URL se lightweight JPG thumbnail nikalta hai (poora video download nahi hota)
export function getThumbUrl(post: any): string {
  if (post?.coverUrl) return post.coverUrl;
  if (post?.thumbnailUrl) return post.thumbnailUrl;
  const raw = post?.mediaUrl || post?.media?.[0] || '';
  if (!raw) return '';
  if (post?.mediaType === 'video' && raw.includes('res.cloudinary.com') && raw.includes('/video/upload/')) {
    return raw
      .replace('/video/upload/', '/video/upload/so_0,w_400,c_fill/')
      .replace(/\.(mp4|mov|webm|m4v)(\?.*)?$/i, '.jpg');
  }
  return raw;
}

export function isBlockedBetween(me: any, other: any, myUid: string): boolean {
  if (!myUid || !other?.id) return false;
  const myBlocks: string[] = Array.isArray(me?.blockedUsers) ? me.blockedUsers : [];
  const theirBlocks: string[] = Array.isArray(other?.blockedUsers) ? other.blockedUsers : [];
  return myBlocks.includes(other.id) || theirBlocks.includes(myUid);
}

export function canViewAccount(user: any, me: any, myUid: string): boolean {
  if (!user || user.status === 'suspended' || user.status === 'deactivated' || user.status === 'deleted') {
    return false;
  }
  return !isBlockedBetween(me, user, myUid);
}

export function canViewPost(post: any, author: any, me: any, myUid: string): boolean {
  if (!post) return false;
  if (post.status === 'deleted' || post.isDeleted || post.isHidden || post.status === 'hidden') return false;
  if (Array.isArray(me?.hiddenPosts) && me.hiddenPosts.includes(post.id)) return false;
  if (author && (author.status === 'suspended' || author.status === 'deactivated' || author.status === 'deleted')) {
    return false;
  }
  if (isBlockedBetween(me, { id: post.uid, blockedUsers: author?.blockedUsers }, myUid)) return false;

  const isPrivate = Boolean(author?.isPrivate || post.isPrivate);
  if (!isPrivate) return true;
  if (post.uid === myUid) return true;
  const iFollow = Array.isArray(me?.following) && me.following.includes(post.uid);
  const inFollowers = Array.isArray(author?.followers) && author.followers.includes(myUid);
  return iFollow || inFollowers;
}

// Per-user private search history (sign-out hone par guest key)
const historyKey = (uid: string) => (uid ? `flevora_searches_${uid}` : 'flevora_searches_guest');

export async function loadSearchHistory(uid: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(historyKey(uid));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveSearchHistory(uid: string, term: string): Promise<string[]> {
  const clean = term.trim();
  if (!clean) return loadSearchHistory(uid);
  const current = await loadSearchHistory(uid);
  const next = [clean, ...current.filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, 12);
  await AsyncStorage.setItem(historyKey(uid), JSON.stringify(next)).catch(() => {});
  return next;
}

export async function removeSearchHistoryItem(uid: string, term: string): Promise<string[]> {
  const current = await loadSearchHistory(uid);
  const next = current.filter((x) => x !== term);
  await AsyncStorage.setItem(historyKey(uid), JSON.stringify(next)).catch(() => {});
  return next;
}

export async function clearSearchHistoryAll(uid: string): Promise<string[]> {
  await AsyncStorage.removeItem(historyKey(uid)).catch(() => {});
  return [];
}

// Paginated Explore posts (Spark-compatible: sirf pageSize docs fetch hote hain)
export async function fetchExplorePostsPage(
  cursor: QueryDocumentSnapshot<DocumentData> | null,
  pageSize = 18
) {
  const qRef = cursor
    ? query(collection(db, 'posts'), orderBy('createdAt', 'desc'), startAfter(cursor), limit(pageSize))
    : query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(pageSize));
  const snap = await getDocs(qRef);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

// Paginated Reels discovery
export async function fetchReelsPage(
  cursor: QueryDocumentSnapshot<DocumentData> | null,
  pageSize = 18
) {
  const qRef = cursor
    ? query(collection(db, 'posts'), where('mediaType', '==', 'video'), orderBy('createdAt', 'desc'), startAfter(cursor), limit(pageSize))
    : query(collection(db, 'posts'), where('mediaType', '==', 'video'), orderBy('createdAt', 'desc'), limit(pageSize));
  const snap = await getDocs(qRef);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

// Paginated Hashtag posts (case-insensitive normalized lowercase #tag)
export async function fetchHashtagPostsPage(
  rawTag: string,
  cursor: QueryDocumentSnapshot<DocumentData> | null,
  pageSize = 18
) {
  const tag = rawTag.trim().toLowerCase().startsWith('#')
    ? rawTag.trim().toLowerCase()
    : `#${rawTag.trim().toLowerCase()}`;
  const qRef = cursor
    ? query(collection(db, 'posts'), where('hashtags', 'array-contains', tag), orderBy('createdAt', 'desc'), startAfter(cursor), limit(pageSize))
    : query(collection(db, 'posts'), where('hashtags', 'array-contains', tag), orderBy('createdAt', 'desc'), limit(pageSize));
  const snap = await getDocs(qRef);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

// Scalable Account search: Firestore Spark par full-text index nahi hota,
// isliye username prefix range query + bounded recent users sample merge kiya gaya hai.
export async function searchAccounts(qRaw: string, pageSize = 25): Promise<any[]> {
  const qLower = qRaw.trim().toLowerCase().replace(/^@/, '');
  if (!qLower) {
    const snap = await getDocs(query(collection(db, 'users'), limit(pageSize)));
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  }

  const prefixSnap = await getDocs(
    query(
      collection(db, 'users'),
      where('username', '>=', qLower),
      where('username', '<=', qLower + '\uf8ff'),
      limit(pageSize)
    )
  );
  const byId: Record<string, any> = {};
  prefixSnap.docs.forEach((d) => { byId[d.id] = { id: d.id, ...d.data() }; });

  // Display name (fullName) ya partial username match ke liye bounded sample
  const sampleSnap = await getDocs(query(collection(db, 'users'), limit(40)));
  sampleSnap.docs.forEach((d) => {
    if (byId[d.id]) return;
    const data = d.data();
    const uname = (data.username || '').toLowerCase();
    const fname = (data.fullName || '').toLowerCase();
    if (uname.includes(qLower) || fname.includes(qLower)) {
      byId[d.id] = { id: d.id, ...data };
    }
  });

  return Object.values(byId).sort((a, b) => {
    const au = (a.username || '').toLowerCase();
    const bu = (b.username || '').toLowerCase();
    const aExact = au === qLower ? 2 : au.startsWith(qLower) ? 1 : 0;
    const bExact = bu === qLower ? 2 : bu.startsWith(qLower) ? 1 : 0;
    return bExact - aExact;
  });
}

// Genuine engagement + text relevance ranking (no fake scores)
export function scorePostMatch(post: any, qLower: string): number {
  const cap = (post.caption || '').toLowerCase();
  const uname = (post.username || '').toLowerCase();
  const tags: string[] = Array.isArray(post.hashtags) ? post.hashtags.map((t: string) => t.toLowerCase()) : [];
  const loc = (post.location || '').toLowerCase();
  const cleanQ = qLower.replace(/^[@#]/, '');

  let score = 0;
  if (uname === cleanQ) score += 100;
  else if (uname.includes(cleanQ)) score += 40;
  if (tags.includes(`#${cleanQ}`)) score += 80;
  else if (tags.some((t) => t.includes(cleanQ))) score += 35;
  if (cap.includes(qLower)) score += 30;
  if (loc && loc.includes(cleanQ)) score += 25;
  if (score === 0) return 0;

  const likes = Array.isArray(post.likes) ? post.likes.length : 0;
  const views = typeof post.views === 'number' ? post.views : 0;
  const comments = typeof post.commentsCount === 'number' ? post.commentsCount : 0;
  return score + Math.min(20, likes + comments + Math.floor(views / 10));
}

// Real hashtag counts from loaded authorized posts
export function extractRealHashtags(posts: any[], filterQuery = ''): { tag: string; count: number }[] {
  const counts: Record<string, number> = {};
  posts.forEach((p) => {
    const tags: string[] = Array.isArray(p.hashtags) ? p.hashtags : [];
    tags.forEach((t) => {
      const norm = String(t).toLowerCase();
      if (norm.startsWith('#')) counts[norm] = (counts[norm] || 0) + 1;
    });
  });
  const qClean = filterQuery.trim().toLowerCase().replace(/^#/, '');
  return Object.entries(counts)
    .filter(([tag]) => !qClean || tag.includes(qClean))
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

// Real place counts from posts that actually have location metadata
export function extractRealPlaces(posts: any[], filterQuery = ''): { place: string; count: number }[] {
  const counts: Record<string, { display: string; count: number }> = {};
  posts.forEach((p) => {
    const raw = (p.location || '').trim();
    if (!raw) return;
    const key = raw.toLowerCase();
    if (!counts[key]) counts[key] = { display: raw, count: 0 };
    counts[key].count += 1;
  });
  const qClean = filterQuery.trim().toLowerCase();
  return Object.values(counts)
    .filter((item) => !qClean || item.display.toLowerCase().includes(qClean))
    .map((item) => ({ place: item.display, count: item.count }))
    .sort((a, b) => b.count - a.count);
}

// Existing follow/unfollow/request logic preserved
export async function toggleFollowUser(targetUser: any, me: any, myUid: string): Promise<'following' | 'requested' | 'none'> {
  if (!myUid || !targetUser?.id || myUid === targetUser.id) return 'none';
  const targetId = targetUser.id;
  const isFollowing = Array.isArray(me?.following) && me.following.includes(targetId);
  const isRequested = Array.isArray(targetUser?.followRequests) && targetUser.followRequests.includes(myUid);

  if (isFollowing) {
    await updateDoc(doc(db, 'users', targetId), { followers: arrayRemove(myUid) });
    await updateDoc(doc(db, 'users', myUid), { following: arrayRemove(targetId) });
    return 'none';
  }
  if (targetUser.isPrivate) {
    if (isRequested) {
      await updateDoc(doc(db, 'users', targetId), { followRequests: arrayRemove(myUid) });
      return 'none';
    }
    await updateDoc(doc(db, 'users', targetId), { followRequests: arrayUnion(myUid) });
    const mySnap = await getDoc(doc(db, 'users', myUid));
    await addDoc(collection(db, 'notifications'), {
      toUid: targetId,
      fromUid: myUid,
      fromUsername: mySnap.data()?.username || 'user',
      type: 'follow_request',
      message: 'requested to follow you.',
      read: false,
      createdAt: serverTimestamp(),
    }).catch(() => {});
    return 'requested';
  }
  await updateDoc(doc(db, 'users', targetId), { followers: arrayUnion(myUid) });
  await updateDoc(doc(db, 'users', myUid), { following: arrayUnion(targetId) });
  const mySnap = await getDoc(doc(db, 'users', myUid));
  await addDoc(collection(db, 'notifications'), {
    toUid: targetId,
    fromUid: myUid,
    fromUsername: mySnap.data()?.username || 'user',
    type: 'follow',
    message: 'started following you.',
    read: false,
    createdAt: serverTimestamp(),
  }).catch(() => {});
  return 'following';
}
