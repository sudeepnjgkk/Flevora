import { Alert } from 'react-native';
import {
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy,
  getDocs, arrayUnion, arrayRemove, serverTimestamp, documentId, where,
} from 'firebase/firestore';
import { db } from '../config';
import { canViewPost } from './searchHelpers';

const inFlight = new Set<string>();

export async function toggleSavePost({
  postId,
  myUid,
  me,
  onOptimistic,
  onRollback,
}: {
  postId: string;
  myUid: string;
  me?: any;
  onOptimistic?: (nextSaved: boolean) => void;
  onRollback?: (wasSaved: boolean) => void;
}): Promise<boolean> {
  if (!myUid) {
    Alert.alert('Sign In Required', 'Please sign in to save posts.');
    return false;
  }
  if (!postId) return false;
  const lockKey = `save_${postId}_${myUid}`;
  if (inFlight.has(lockKey)) return Array.isArray(me?.savedPosts) && me.savedPosts.includes(postId);
  inFlight.add(lockKey);

  const wasSaved = Array.isArray(me?.savedPosts) && me.savedPosts.includes(postId);
  const nextSaved = !wasSaved;
  onOptimistic?.(nextSaved);

  try {
    await updateDoc(doc(db, 'users', myUid), {
      savedPosts: nextSaved ? arrayUnion(postId) : arrayRemove(postId),
    });

    // All Saved se unsave karne par collections se bhi safely remove karo
    if (!nextSaved) {
      const colSnap = await getDocs(collection(db, 'users', myUid, 'collections')).catch(() => null);
      if (colSnap) {
        await Promise.all(
          colSnap.docs
            .filter((d) => Array.isArray(d.data().postIds) && d.data().postIds.includes(postId))
            .map((d) => updateDoc(d.ref, { postIds: arrayRemove(postId), updatedAt: serverTimestamp() }).catch(() => {}))
        );
      }
    }
    return nextSaved;
  } catch {
    onRollback?.(wasSaved);
    Alert.alert('Error', 'Could not update saved state. Check your connection.');
    return wasSaved;
  } finally {
    inFlight.delete(lockKey);
  }
}

export function subscribeCollections(uid: string, onUpdate: (cols: any[]) => void) {
  if (!uid) return () => {};
  return onSnapshot(
    query(collection(db, 'users', uid, 'collections'), orderBy('updatedAt', 'desc')),
    (snap) => onUpdate(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    () => {}
  );
}

export async function createCollection(uid: string, rawName: string, initialPostId?: string, coverUrl = '') {
  const name = rawName.trim();
  if (!name) throw new Error('Collection name cannot be empty.');
  if (name.length > 40) throw new Error('Collection name must be under 40 characters.');

  const existing = await getDocs(collection(db, 'users', uid, 'collections'));
  if (existing.docs.some((d) => (d.data().name || '').toLowerCase() === name.toLowerCase())) {
    throw new Error('A collection with this name already exists.');
  }

  const ref = await addDoc(collection(db, 'users', uid, 'collections'), {
    name,
    postIds: initialPostId ? [initialPostId] : [],
    coverUrl: coverUrl || '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (initialPostId) {
    await updateDoc(doc(db, 'users', uid), { savedPosts: arrayUnion(initialPostId) }).catch(() => {});
  }
  return ref.id;
}

export async function renameCollection(uid: string, colId: string, rawName: string) {
  const name = rawName.trim();
  if (!name || name.length > 40) throw new Error('Invalid collection name.');
  await updateDoc(doc(db, 'users', uid, 'collections', colId), { name, updatedAt: serverTimestamp() });
}

export async function deleteCollectionOnly(uid: string, colId: string) {
  // Sirf collection delete hoti hai, All Saved posts safe rehte hain
  await deleteDoc(doc(db, 'users', uid, 'collections', colId));
}

export async function togglePostInCollection(uid: string, colId: string, postId: string, add: boolean, coverUrl = '') {
  const patch: Record<string, any> = {
    postIds: add ? arrayUnion(postId) : arrayRemove(postId),
    updatedAt: serverTimestamp(),
  };
  if (add && coverUrl) patch.coverUrl = coverUrl;
  await updateDoc(doc(db, 'users', uid, 'collections', colId), patch);
  if (add) {
    await updateDoc(doc(db, 'users', uid), { savedPosts: arrayUnion(postId) }).catch(() => {});
  }
}

export async function fetchSavedPostsSafe(ids: string[], me: any, myUid: string) {
  if (!ids.length) return { available: [] as any[], unavailableIds: [] as string[] };
  const unique = Array.from(new Set(ids)).slice(0, 50);
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 10) chunks.push(unique.slice(i, i + 10));

  const snaps = await Promise.all(chunks.map((c) => getDocs(query(collection(db, 'posts'), where(documentId(), 'in', c)))));
  const map: Record<string, any> = {};
  snaps.forEach((s) => s.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; }));

  const available: any[] = [];
  const unavailableIds: string[] = [];
  unique.forEach((id) => {
    const p = map[id];
    if (!p || !canViewPost(p, null, me, myUid)) unavailableIds.push(id);
    else available.push(p);
  });
  return { available, unavailableIds };
}
