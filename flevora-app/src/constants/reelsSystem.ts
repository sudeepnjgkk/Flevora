import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addDoc, collection, doc, getDoc, serverTimestamp, updateDoc,
} from 'firebase/firestore';
import { db } from '../config';

export const CLOUD_NAME = 'faqfo0lu';
export const UPLOAD_PRESET = 'flevora_upload';
export const REEL_MAX_BYTES = 25 * 1024 * 1024; // 25 MB existing client limit
export const REEL_DURATIONS = [15, 30, 60] as const;

export const REEL_FILTERS = [
  { name: 'Original', tint: 'transparent', opacity: 0 },
  { name: 'Natural', tint: '#FEF3C7', opacity: 0.08 },
  { name: 'Warm', tint: '#F59E0B', opacity: 0.16 },
  { name: 'Cool', tint: '#38BDF8', opacity: 0.16 },
  { name: 'Vintage', tint: '#92400E', opacity: 0.22 },
  { name: 'Cinematic', tint: '#0F172A', opacity: 0.22 },
  { name: 'Bright', tint: '#FFFFFF', opacity: 0.14 },
  { name: 'B&W', tint: '#111827', opacity: 0.45 },
] as const;

export const REEL_PREVIEW_SPEEDS = [0.5, 1, 1.5, 2] as const;

export type ReelAudience = 'everyone' | 'followers' | 'closeFriends';

export interface ReelTextLayer {
  id: string;
  text: string;
  color: string;
  bg: string;
  size: number;
  align: 'left' | 'center' | 'right';
  xPct: number;
  yPct: number;
  startSec: number;
  endSec: number;
}

export interface ReelStickerLayer {
  id: string;
  emoji: string;
  size: number;
  rotate: number;
  xPct: number;
  yPct: number;
}

export interface ReelCaptionLine {
  id: string;
  text: string;
  startSec: number;
  endSec: number;
}

export interface ReelDraft {
  id: string;
  videoUri: string;
  coverUri: string;
  durationSec: number;
  width?: number;
  height?: number;
  fileSize?: number;
  trimStart: number;
  trimEnd: number;
  speed: number;
  filter: string;
  textLayers: ReelTextLayer[];
  stickers: ReelStickerLayer[];
  captionsList: ReelCaptionLine[];
  voiceoverUri: string;
  videoVolume: number;
  voiceVolume: number;
  audioName: string;
  caption: string;
  location: string;
  audience: ReelAudience;
  commentsDisabled: boolean;
  allowRepost: boolean;
  allowRemix: boolean;
  allowDownload: boolean;
  hideLikeCount: boolean;
  updatedAt: number;
}

export interface ReelsCapabilities {
  licensedMusicProvider: boolean;
  autoCaptionsProvider: boolean;
  serverTranscodeExport: boolean;
  pushNotifications: boolean;
}

export const DEFAULT_REELS_CAPABILITIES: ReelsCapabilities = {
  licensedMusicProvider: false,
  autoCaptionsProvider: false,
  serverTranscodeExport: false,
  pushNotifications: false,
};

export async function detectReelsCapabilities(): Promise<ReelsCapabilities> {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'reels'));
    if (!snap.exists()) return DEFAULT_REELS_CAPABILITIES;
    const d = snap.data() || {};
    return {
      licensedMusicProvider: Boolean(d.licensedMusicProvider),
      autoCaptionsProvider: Boolean(d.autoCaptionsProvider),
      serverTranscodeExport: Boolean(d.serverTranscodeExport),
      pushNotifications: Boolean(d.pushNotifications),
    };
  } catch {
    return DEFAULT_REELS_CAPABILITIES;
  }
}

export function validateReelVideoAsset(asset: {
  uri?: string;
  type?: string;
  fileSize?: number;
  mimeType?: string;
}): string | null {
  if (!asset?.uri) return 'Invalid video file.';
  if (asset.type && asset.type !== 'video') return 'Please select a valid MP4 video.';
  if (asset.mimeType && !['video/mp4', 'video/quicktime'].includes(asset.mimeType.toLowerCase()) && !asset.mimeType.startsWith('video/')) {
    return 'Unsupported format. Please choose an MP4 video.';
  }
  if (asset.fileSize && asset.fileSize > REEL_MAX_BYTES) {
    const mb = (asset.fileSize / (1024 * 1024)).toFixed(1);
    return `Video is ${mb} MB. Maximum allowed limit is 25 MB (Cloudinary Spark setup). Trim or compress the video first.`;
  }
  return null;
}

const draftKey = (uid: string) => `flevora_reel_drafts_${uid}`;

export async function loadReelDrafts(uid: string): Promise<ReelDraft[]> {
  if (!uid) return [];
  try {
    const raw = await AsyncStorage.getItem(draftKey(uid));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export async function saveReelDraft(uid: string, draft: ReelDraft): Promise<void> {
  if (!uid) return;
  const list = await loadReelDrafts(uid);
  const idx = list.findIndex((d) => d.id === draft.id);
  if (idx >= 0) list[idx] = draft;
  else list.unshift(draft);
  await AsyncStorage.setItem(draftKey(uid), JSON.stringify(list.slice(0, 15)));
}

export async function deleteReelDraft(uid: string, draftId: string): Promise<void> {
  if (!uid) return;
  const list = await loadReelDrafts(uid);
  await AsyncStorage.setItem(draftKey(uid), JSON.stringify(list.filter((d) => d.id !== draftId)));
}
export function uploadFileWithProgress(
  uri: string,
  resourceType: 'video' | 'image' | 'raw',
  onProgress?: (pct: number) => void,
  onXhr?: (xhr: XMLHttpRequest) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const ext = resourceType === 'video' ? 'mp4' : resourceType === 'raw' ? 'm4a' : 'jpg';
    const mime = resourceType === 'video' ? 'video/mp4' : resourceType === 'raw' ? 'audio/mp4' : 'image/jpeg';
    const data = new FormData();
    data.append('file', { uri, type: mime, name: `reel_${Date.now()}.${ext}` } as any);
    data.append('upload_preset', UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    onXhr?.(xhr);
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType === 'raw' ? 'video' : resourceType}/upload`);
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        onProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
      }
    };
    xhr.onload = () => {
      try {
        const res = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300 && res.secure_url) {
          onProgress?.(100);
          resolve(res.secure_url);
        } else {
          reject(new Error(res?.error?.message || 'Cloudinary upload failed.'));
        }
      } catch {
        reject(new Error('Invalid upload response.'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload.'));
    xhr.onabort = () => reject(new Error('Upload cancelled.'));
    xhr.send(data);
  });
}

export async function publishReelToFirestore(params: {
  uid: string;
  userData: any;
  videoUrl: string;
  coverUrl: string;
  voiceoverUrl?: string;
  draft: ReelDraft;
  remixOf?: { postId: string; username: string } | null;
  allUsers: any[];
}): Promise<string> {
  const { uid, userData, videoUrl, coverUrl, voiceoverUrl, draft, remixOf, allUsers } = params;
  const hashtags = Array.from(new Set((draft.caption.match(/#[a-zA-Z0-9_]+/g) || []).map((h) => h.toLowerCase())));
  const mentionNames = Array.from(new Set((draft.caption.match(/@([a-zA-Z0-9._]+)/g) || []).map((m) => m.slice(1).toLowerCase())));
  const uname = userData?.username || 'user';

  const docRef = await addDoc(collection(db, 'posts'), {
    uid,
    username: uname,
    avatar: userData?.photoUrl || userData?.avatar || '',
    mediaUrl: videoUrl,
    thumbnailUrl: coverUrl || videoUrl.replace(/\.[^/.]+$/, '.jpg'),
    mediaType: 'video',
    caption: draft.caption.trim(),
    hashtags,
    mentions: mentionNames,
    location: draft.location.trim(),
    duration: Math.max(1, Math.round((draft.trimEnd || draft.durationSec || 15) - (draft.trimStart || 0))),
    trimStart: draft.trimStart || 0,
    trimEnd: draft.trimEnd || draft.durationSec || 15,
    filter: draft.filter || 'Original',
    playbackSpeed: draft.speed || 1,
    textOverlays: draft.textLayers || [],
    stickers: draft.stickers || [],
    captionsList: draft.captionsList || [],
    voiceoverUrl: voiceoverUrl || '',
    videoVolume: draft.videoVolume ?? 1,
    voiceVolume: draft.voiceVolume ?? 1,
    audioName: draft.audioName?.trim() || '',
    audioArtist: `@${uname}`,
    audience: draft.audience || 'everyone',
    isPrivate: draft.audience !== 'everyone' || Boolean(userData?.isPrivate),
    commentsDisabled: Boolean(draft.commentsDisabled),
    allowRepost: draft.allowRepost !== false,
    allowRemix: draft.allowRemix !== false,
    allowDownload: Boolean(draft.allowDownload),
    hideLikeCount: Boolean(draft.hideLikeCount),
    remixOf: remixOf || null,
    likes: [],
    reposts: [],
    commentsCount: 0,
    views: 0,
    sharesCount: 0,
    isArchived: false,
    isDeleted: false,
    status: 'published',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  for (const mName of mentionNames.slice(0, 10)) {
    const target = allUsers.find((u) => (u.username || '').toLowerCase() === mName && u.id !== uid);
    if (target) {
      addDoc(collection(db, 'notifications'), {
        toUid: target.id,
        fromUid: uid,
        fromUsername: uname,
        type: 'mention',
        postId: docRef.id,
        reelId: docRef.id,
        mediaUrl: coverUrl || videoUrl,
        message: 'mentioned you in a Reel.',
        read: false,
        createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  }
  return docRef.id;
}

export function canViewReelExtended(reel: any, owner: any, me: any, myUid: string): boolean {
  if (!reel || reel.isDeleted) return false;
  if (reel.isArchived && reel.uid !== myUid) return false;
  if (owner?.status === 'suspended' || owner?.status === 'deleted' || owner?.status === 'deactivated') return false;
  if (Array.isArray(me?.blockedUsers) && me.blockedUsers.includes(reel.uid)) return false;
  if (Array.isArray(owner?.blockedUsers) && myUid && owner.blockedUsers.includes(myUid)) return false;
  if (Array.isArray(me?.hiddenCreators) && me.hiddenCreators.includes(reel.uid) && reel.uid !== myUid) return false;

  if (reel.uid === myUid) return true;
  if (reel.audience === 'closeFriends') {
    return Array.isArray(owner?.closeFriends) && owner.closeFriends.includes(myUid);
  }
  if (reel.audience === 'followers' || owner?.isPrivate || reel.isPrivate) {
    return Boolean(myUid && Array.isArray(me?.following) && me.following.includes(reel.uid));
  }
  return true;
}

export function rankReelsForYou(list: any[], me: any): any[] {
  const following = new Set(Array.isArray(me?.following) ? me.following : []);
  const myTags = new Set(Array.isArray(me?.interestedTags) ? me.interestedTags : []);
  const score = (r: any) => {
    let s = 0;
    if (following.has(r.uid)) s += 25;
    if (Array.isArray(r.hashtags) && r.hashtags.some((h: string) => myTags.has(h))) s += 18;
    s += Math.min(25, (r.likes?.length || 0) * 2 + (r.reposts?.length || 0) * 3 + Math.floor((r.views || 0) / 10));
    const ageHours = r.createdAt?.seconds ? (Date.now() / 1000 - r.createdAt.seconds) / 3600 : 24;
    s += Math.max(0, 20 - ageHours * 0.25);
    return s;
  };
  return [...list].sort((a, b) => score(b) - score(a));
}

const sessionViewedReels = new Set<string>();

export async function recordDeduplicatedReelView(reelId: string, myUid: string, ownerUid: string): Promise<void> {
  if (!reelId || sessionViewedReels.has(reelId)) return;
  sessionViewedReels.add(reelId);
  if (myUid && myUid === ownerUid) return;
  try {
    const { increment } = await import('firebase/firestore');
    await updateDoc(doc(db, 'posts', reelId), { views: increment(1) });
  } catch {
    sessionViewedReels.delete(reelId);
  }
}
