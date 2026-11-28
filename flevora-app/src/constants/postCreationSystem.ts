import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDoc, collection, doc, getDoc, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../config';
import type { Lang } from './i18n';

export const POST_CLOUD_NAME = 'faqfo0lu';
export const POST_UPLOAD_PRESET = 'flevora_upload';
export const POST_MAX_BYTES = 25 * 1024 * 1024;
export const POST_MAX_CAROUSEL = 20;

export interface PostCapabilities {
  planMode: 'spark' | 'blaze';
  cloudinaryUpload: boolean;
  musicProvider: boolean;
  placesProvider: boolean;
  videoTrimming: boolean;
}

export const DEFAULT_POST_CAPABILITIES: PostCapabilities = {
  planMode: 'spark',
  cloudinaryUpload: true,
  musicProvider: false,
  placesProvider: false,
  videoTrimming: false,
};

export async function detectPostCapabilities(): Promise<PostCapabilities> {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'posts'));
    if (!snap.exists()) return DEFAULT_POST_CAPABILITIES;
    const d = snap.data() || {};
    return {
      planMode: d.blazeEnabled === true ? 'blaze' : 'spark',
      cloudinaryUpload: true,
      musicProvider: Boolean(d.musicProvider),
      placesProvider: Boolean(d.placesProvider),
      videoTrimming: false,
    };
  } catch {
    return DEFAULT_POST_CAPABILITIES;
  }
}

export const POST_FILTERS = [
  { name: 'Original', tint: 'transparent' },
  { name: 'Natural', tint: 'rgba(255,245,230,0.08)' },
  { name: 'Warm', tint: 'rgba(249,115,22,0.16)' },
  { name: 'Cool', tint: 'rgba(59,130,246,0.16)' },
  { name: 'Bright', tint: 'rgba(255,255,255,0.14)' },
  { name: 'Soft', tint: 'rgba(244,114,182,0.12)' },
  { name: 'Vivid', tint: 'rgba(234,179,8,0.16)' },
  { name: 'Vintage', tint: 'rgba(180,130,70,0.22)' },
  { name: 'Fade', tint: 'rgba(209,213,219,0.22)' },
  { name: 'B&W', tint: 'rgba(100,116,139,0.38)' },
  { name: 'Dramatic', tint: 'rgba(17,24,39,0.28)' },
  { name: 'Film', tint: 'rgba(16,185,129,0.14)' },
] as const;

export const ASPECT_RATIOS = [
  { key: '1:1', label: '1:1', ratio: 1 },
  { key: '4:5', label: '4:5', ratio: 1.25 },
  { key: '1.91:1', label: '1.91:1', ratio: 0.52 },
  { key: 'original', label: 'Original', ratio: 1.1 },
] as const;

export interface MediaSlide {
  id: string;
  uri: string;
  uploadedUrl?: string;
  type: 'image' | 'video';
  filter: string;
  rotate: number;
  flip: boolean;
  muted: boolean;
  altText: string;
}

export interface PostDraft {
  id: string;
  slides: MediaSlide[];
  aspectRatio: string;
  caption: string;
  location: string;
  taggedUids: string[];
  collaboratorUids: string[];
  audience: 'everyone' | 'followers' | 'closeFriends';
  hideLikeCount: boolean;
  hideViewCount: boolean;
  commentsDisabled: boolean;
  allowReshare: boolean;
  updatedAt: number;
}

const POST_STRINGS = {
  English: {
    newPost: 'New Post',
    gallery: 'Gallery',
    camera: 'Camera',
    crop: 'Crop',
    editMedia: 'Edit Media',
    preview: 'Preview',
    publish: 'Publish Post',
    saveDraft: 'Save Draft',
    drafts: 'Drafts',
    tagPeople: 'Tag People & Collaborators',
    advanced: 'Advanced Settings',
    musicUnavailable: 'Music selection requires a licensed music provider (not configured yet).',
    publishedTitle: 'Post Published!',
  },
  Hindi: {
    newPost: 'नई पोस्ट',
    gallery: 'गैलरी',
    camera: 'कैमरा',
    crop: 'क्रॉप',
    editMedia: 'मीडिया एडिट करें',
    preview: 'प्रीव्यू',
    publish: 'पोस्ट शेयर करें',
    saveDraft: 'ड्राफ्ट सेव करें',
    drafts: 'ड्राफ्ट्स',
    tagPeople: 'लोगों को टैग / कोलैब करें',
    advanced: 'एडवांस्ड सेटिंग्स',
    musicUnavailable: 'म्यूज़िक के लिए लाइसेंस्ड म्यूज़िक प्रोवाइडर ज़रूरी है।',
    publishedTitle: 'पोस्ट पब्लिश हो गई!',
  },
  Hinglish: {
    newPost: 'Nayi Post',
    gallery: 'Gallery',
    camera: 'Camera',
    crop: 'Crop',
    editMedia: 'Media Edit Karo',
    preview: 'Preview',
    publish: 'Post Publish Karo',
    saveDraft: 'Draft Save Karo',
    drafts: 'Drafts',
    tagPeople: 'Tag People & Collaborators',
    advanced: 'Advanced Settings',
    musicUnavailable: 'Music ke liye licensed music provider configured hona zaroori hai.',
    publishedTitle: 'Post Publish Ho Gayi!',
  },
};

export function postT(lang: Lang) {
  return POST_STRINGS[lang] || POST_STRINGS.English;
}

export function validatePostAsset(asset: { uri: string; fileSize?: number; type?: string }): string | null {
  if (!asset?.uri) return 'Invalid media file.';
  if (asset.fileSize && asset.fileSize > POST_MAX_BYTES) return 'Each photo/video must be under 25 MB.';
  return null;
}

export function uploadPostMediaToCloudinary(
  uri: string,
  type: 'image' | 'video',
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.append('file', {
      uri,
      type: type === 'video' ? 'video/mp4' : 'image/jpeg',
      name: `flevora_${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`,
    } as any);
    data.append('upload_preset', POST_UPLOAD_PRESET);
    const xhr = new XMLHttpRequest();
    xhr.timeout = 90000;
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${POST_CLOUD_NAME}/${type}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        if (j.secure_url) resolve(j.secure_url);
        else reject(new Error(j.error?.message || 'Cloudinary upload failed'));
      } catch {
        reject(new Error('Invalid upload response'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.ontimeout = () => reject(new Error('Upload timed out'));
    xhr.send(data);
  });
}

const draftKey = (uid: string) => `flevora_post_drafts_${uid}`;

export async function loadPostDrafts(uid: string): Promise<PostDraft[]> {
  if (!uid) return [];
  try {
    const raw = await AsyncStorage.getItem(draftKey(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function savePostDraft(uid: string, draft: PostDraft): Promise<void> {
  if (!uid) return;
  const list = await loadPostDrafts(uid);
  const next = [draft, ...list.filter((d) => d.id !== draft.id)].slice(0, 12);
  await AsyncStorage.setItem(draftKey(uid), JSON.stringify(next));
}

export async function deletePostDraft(uid: string, draftId: string): Promise<void> {
  if (!uid) return;
  const list = await loadPostDrafts(uid);
  await AsyncStorage.setItem(draftKey(uid), JSON.stringify(list.filter((d) => d.id !== draftId)));
}

export async function publishPostToFirestore({
  uid, userData, slides, uploadedUrls, aspectRatio, caption, location,
  taggedUids, collaboratorUids, audience, hideLikeCount, hideViewCount,
  commentsDisabled, allowReshare, remixOf, allUsers,
}: {
  uid: string; userData: any; slides: MediaSlide[]; uploadedUrls: string[];
  aspectRatio: string; caption: string; location: string;
  taggedUids: string[]; collaboratorUids: string[];
  audience: 'everyone' | 'followers' | 'closeFriends';
  hideLikeCount: boolean; hideViewCount: boolean;
  commentsDisabled: boolean; allowReshare: boolean;
  remixOf?: { postId: string; username: string } | null;
  allUsers: any[];
}) {
  const hashtags = Array.from(new Set((caption.match(/#\w+/g) || []).map((h) => h.toLowerCase())));
  const mentionNames = Array.from(new Set((caption.match(/@([a-zA-Z0-9_]+)/g) || []).map((m) => m.slice(1).toLowerCase())));
  const mentionedUids = allUsers.filter((u) => mentionNames.includes((u.username || '').toLowerCase())).map((u) => u.id);
  const taggedUsernames = allUsers.filter((u) => taggedUids.includes(u.id)).map((u) => (u.username || '').toLowerCase()).filter(Boolean);

  const ref = await addDoc(collection(db, 'posts'), {
    uid,
    username: userData.username || 'user',
    userAvatar: userData.photoUrl || userData.avatar || '',
    mediaUrl: uploadedUrls[0],
    media: uploadedUrls,
    mediaTypes: slides.map((s) => s.type),
    mediaType: slides[0]?.type === 'video' ? 'video' : 'image',
    aspectRatio,
    filters: slides.map((s) => s.filter),
    altTexts: slides.map((s) => s.altText || ''),
    caption: caption.trim(),
    hashtags,
    mentions: mentionedUids,
    taggedUids,
    taggedUsers: taggedUsernames,
    pendingCollaborators: collaboratorUids,
    collaborators: [],
    location: location.trim(),
    audience,
    allowedUids: audience === 'closeFriends' ? (Array.isArray(userData.closeFriends) ? userData.closeFriends : []) : [],
    hideLikeCount,
    hideViewCount,
    commentsDisabled,
    allowReshare,
    ...(remixOf ? { remixOf } : {}),
    likes: [],
    reposts: [],
    views: 0,
    status: 'published',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const notifyTargets = new Set([...taggedUids, ...mentionedUids]);
  for (const tid of notifyTargets) {
    if (tid && tid !== uid) {
      await addDoc(collection(db, 'notifications'), {
        toUid: tid, fromUid: uid, fromUsername: userData.username || 'user',
        type: taggedUids.includes(tid) ? 'tag' : 'mention',
        postId: ref.id,
        message: taggedUids.includes(tid) ? 'tagged you in a post.' : 'mentioned you in a post.',
        read: false, createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  }
  for (const cid of collaboratorUids) {
    if (cid && cid !== uid) {
      await addDoc(collection(db, 'notifications'), {
        toUid: cid, fromUid: uid, fromUsername: userData.username || 'user',
        type: 'collab_invite', postId: ref.id,
        message: 'invited you to collaborate on a post.',
        read: false, createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  }
  return ref.id;
}

export async function updatePublishedPost(postId: string, patch: Record<string, any>) {
  await updateDoc(doc(db, 'posts', postId), { ...patch, updatedAt: serverTimestamp() });
}
