import {
  collection, query, where, orderBy, limit, startAfter, getDocs, getDoc,
  doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, documentId,
  QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { db } from '../config';

const CLOUD_NAME = 'faqfo0lu';
const UPLOAD_PRESET = 'flevora_upload';

export function uploadAvatarToCloudinary(
  uri: string,
  uid: string,
  onProgress: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.append('file', { uri, type: 'image/jpeg', name: `avatar_${uid}_${Date.now()}.jpg` } as any);
    data.append('upload_preset', UPLOAD_PRESET);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText);
        if (json.secure_url) resolve(json.secure_url);
        else reject(new Error('Upload failed'));
      } catch {
        reject(new Error('Invalid response'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(data);
  });
}

export async function checkUsernameAvailable(rawUsername: string, myUid: string): Promise<{ ok: boolean; normalized: string; error?: string }> {
  const norm = rawUsername.trim().toLowerCase().replace(/^@/, '');
  if (!/^[a-z0-9._]{3,24}$/.test(norm)) {
    return { ok: false, normalized: norm, error: 'Username must be 3-24 chars (letters, numbers, . or _).' };
  }
  const snap = await getDocs(query(collection(db, 'users'), where('username', '==', norm), limit(2)));
  const takenByOther = snap.docs.some((d) => d.id !== myUid);
  if (takenByOther) {
    return { ok: false, normalized: norm, error: 'This username is already taken.' };
  }
  return { ok: true, normalized: norm };
}

export async function fetchUserPostsPage(
  targetUid: string,
  cursor: QueryDocumentSnapshot<DocumentData> | null,
  pageSize = 18
) {
  const qRef = cursor
    ? query(collection(db, 'posts'), where('uid', '==', targetUid), orderBy('createdAt', 'desc'), startAfter(cursor), limit(pageSize))
    : query(collection(db, 'posts'), where('uid', '==', targetUid), orderBy('createdAt', 'desc'), limit(pageSize));
  const snap = await getDocs(qRef);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p: any) => !p.isDeleted && p.status !== 'deleted'),
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function fetchTaggedPostsPage(
  usernameLower: string,
  cursor: QueryDocumentSnapshot<DocumentData> | null,
  pageSize = 18
) {
  if (!usernameLower) return { items: [], lastDoc: null, hasMore: false };
  const qRef = cursor
    ? query(collection(db, 'posts'), where('taggedUsers', 'array-contains', usernameLower), orderBy('createdAt', 'desc'), startAfter(cursor), limit(pageSize))
    : query(collection(db, 'posts'), where('taggedUsers', 'array-contains', usernameLower), orderBy('createdAt', 'desc'), limit(pageSize));
  const snap = await getDocs(qRef);
  return {
    items: snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p: any) => !p.isDeleted && p.status !== 'deleted'),
    lastDoc: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null,
    hasMore: snap.docs.length === pageSize,
  };
}

export async function fetchPostsByIds(ids: string[]): Promise<any[]> {
  if (!ids.length) return [];
  const unique = Array.from(new Set(ids)).slice(0, 30);
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));
  const results = await Promise.all(
    chunks.map((c) => getDocs(query(collection(db, 'posts'), where(documentId(), 'in', c))))
  );
  const map: Record<string, any> = {};
  results.forEach((snap) => snap.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; }));
  return unique.map((id) => map[id]).filter((p) => p && !p.isDeleted && p.status !== 'deleted');
}

export async function fetchUsersByIds(ids: string[]): Promise<any[]> {
  if (!ids.length) return [];
  const unique = Array.from(new Set(ids)).slice(0, 50);
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));
  const results = await Promise.all(
    chunks.map((c) => getDocs(query(collection(db, 'users'), where(documentId(), 'in', c))))
  );
  const list: any[] = [];
  results.forEach((snap) => snap.docs.forEach((d) => list.push({ id: d.id, ...d.data() })));
  return list.filter((u) => u.status !== 'deleted');
}

export async function removeFollower(myUid: string, followerUid: string) {
  await updateDoc(doc(db, 'users', myUid), { followers: arrayRemove(followerUid) });
  await updateDoc(doc(db, 'users', followerUid), { following: arrayRemove(myUid) }).catch(() => {});
}

export async function respondFollowRequest(myUid: string, requesterUid: string, accept: boolean) {
  await updateDoc(doc(db, 'users', myUid), { followRequests: arrayRemove(requesterUid) });
  if (accept) {
    await updateDoc(doc(db, 'users', myUid), { followers: arrayUnion(requesterUid) });
    await updateDoc(doc(db, 'users', requesterUid), { following: arrayUnion(myUid) });
    const mySnap = await getDoc(doc(db, 'users', myUid));
    await addDoc(collection(db, 'notifications'), {
      toUid: requesterUid,
      fromUid: myUid,
      fromUsername: mySnap.data()?.username || 'user',
      type: 'follow',
      message: 'accepted your follow request.',
      read: false,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  }
}

export async function fetchUserStories(uid: string): Promise<any[]> {
  const snap = await getDocs(query(collection(db, 'stories'), where('uid', '==', uid), limit(30)));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export function computeRealInsights(posts: any[], user: any) {
  let totalLikes = 0;
  let totalViews = 0;
  let totalComments = 0;
  let reelsCount = 0;
  posts.forEach((p) => {
    totalLikes += Array.isArray(p.likes) ? p.likes.length : 0;
    totalViews += typeof p.views === 'number' ? p.views : 0;
    totalComments += typeof p.commentsCount === 'number' ? p.commentsCount : 0;
    if (p.mediaType === 'video') reelsCount += 1;
  });
  return {
    postsCount: posts.length,
    reelsCount,
    totalLikes,
    totalViews,
    totalComments,
    followersCount: Array.isArray(user?.followers) ? user.followers.length : 0,
  };
}
