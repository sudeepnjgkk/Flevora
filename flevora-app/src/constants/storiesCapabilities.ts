import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config';
import type { Lang } from './i18n';

export const CLOUDINARY_CLOUD = 'faqfo0lu';
export const CLOUDINARY_PRESET = 'flevora_upload';
export const STORY_MAX_BYTES = 25 * 1024 * 1024;
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

export interface StoriesCapabilities {
  planMode: 'spark' | 'blaze';
  cloudinaryUpload: boolean;
  serverExpiryCleanup: boolean;
  gifProvider: boolean;
  weatherProvider: boolean;
  musicProvider: boolean;
  videoTrimming: boolean;
}

export const DEFAULT_STORIES_CAPABILITIES: StoriesCapabilities = {
  planMode: 'spark',
  cloudinaryUpload: true,
  serverExpiryCleanup: false,
  gifProvider: false,
  weatherProvider: false,
  musicProvider: false,
  videoTrimming: false,
};

export async function detectStoriesCapabilities(): Promise<StoriesCapabilities> {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'stories'));
    if (!snap.exists()) return DEFAULT_STORIES_CAPABILITIES;
    const d = snap.data() || {};
    return {
      planMode: d.blazeEnabled === true ? 'blaze' : 'spark',
      cloudinaryUpload: true,
      serverExpiryCleanup: Boolean(d.serverExpiryCleanup),
      gifProvider: Boolean(d.gifProvider),
      weatherProvider: Boolean(d.weatherProvider),
      musicProvider: Boolean(d.musicProvider),
      videoTrimming: false,
    };
  } catch {
    return DEFAULT_STORIES_CAPABILITIES;
  }
}

const STORY_STRINGS = {
  English: {
    yourStory: 'Your story',
    addStory: 'Add to story',
    camera: 'Camera',
    gallery: 'Gallery',
    textStory: 'Text Story',
    multiMedia: 'Multi Media',
    closeFriends: 'Close Friends',
    everyone: 'Your story',
    publish: 'Publish',
    saveDraft: 'Save Draft',
    drafts: 'Drafts',
    archive: 'Story Archive',
    discardTitle: 'Discard Story?',
    discardMsg: 'You have unsaved changes. Save as draft or discard?',
    discard: 'Discard',
    cancel: 'Cancel',
    uploading: 'Uploading story...',
    uploadFailed: 'Upload Failed',
    retry: 'Retry',
    stickers: 'Stickers',
    draw: 'Draw',
    text: 'Text',
    muteStory: 'Mute Story',
    unmuteStory: 'Unmute Story',
    reportStory: 'Report Story',
    visitProfile: 'Visit Profile',
    noStories: 'No stories yet',
    repliesOff: 'Replies are turned off for this story',
    unavailableSticker: 'Provider not configured yet',
  },
  Hindi: {
    yourStory: 'आपकी स्टोरी',
    addStory: 'स्टोरी जोड़ें',
    camera: 'कैमरा',
    gallery: 'गैलरी',
    textStory: 'टेक्स्ट स्टोरी',
    multiMedia: 'मल्टी मीडिया',
    closeFriends: 'क्लोज़ फ्रेंड्स',
    everyone: 'आपकी स्टोरी',
    publish: 'पब्लिश करें',
    saveDraft: 'ड्राफ्ट सेव करें',
    drafts: 'ड्राफ्ट्स',
    archive: 'स्टोरी आर्काइव',
    discardTitle: 'स्टोरी हटाएं?',
    discardMsg: 'आपके बदलाव सेव नहीं हैं। ड्राफ्ट सेव करें या हटाएं?',
    discard: 'हटाएं',
    cancel: 'रद्द करें',
    uploading: 'स्टोरी अपलोड हो रही है...',
    uploadFailed: 'अपलोड विफल',
    retry: 'फिर से कोशिश करें',
    stickers: 'स्टिकर्स',
    draw: 'ड्रॉ',
    text: 'टेक्स्ट',
    muteStory: 'स्टोरी म्यूट करें',
    unmuteStory: 'स्टोरी अनम्यूट करें',
    reportStory: 'स्टोरी रिपोर्ट करें',
    visitProfile: 'प्रोफ़ाइल देखें',
    noStories: 'अभी कोई स्टोरी नहीं है',
    repliesOff: 'इस स्टोरी पर रिप्लाई बंद हैं',
    unavailableSticker: 'यह सेवा अभी कॉन्फ़िगर नहीं है',
  },
  Hinglish: {
    yourStory: 'Aapki story',
    addStory: 'Story lagao',
    camera: 'Camera',
    gallery: 'Gallery',
    textStory: 'Text Story',
    multiMedia: 'Multi Media',
    closeFriends: 'Close Friends',
    everyone: 'Aapki story',
    publish: 'Publish Karo',
    saveDraft: 'Draft Save Karo',
    drafts: 'Drafts',
    archive: 'Story Archive',
    discardTitle: 'Story Discard Karein?',
    discardMsg: 'Unsaved changes hain. Draft save karein ya discard?',
    discard: 'Discard',
    cancel: 'Cancel',
    uploading: 'Story upload ho rahi hai...',
    uploadFailed: 'Upload Fail Ho Gaya',
    retry: 'Retry Karo',
    stickers: 'Stickers',
    draw: 'Draw',
    text: 'Text',
    muteStory: 'Story Mute Karo',
    unmuteStory: 'Story Unmute Karo',
    reportStory: 'Story Report Karo',
    visitProfile: 'Profile Dekho',
    noStories: 'Abhi koi story nahi hai',
    repliesOff: 'Is story par replies band hain',
    unavailableSticker: 'Provider abhi configured nahi hai',
  },
};

export function storyT(lang: Lang) {
  return STORY_STRINGS[lang] || STORY_STRINGS.English;
}

export function getStoryCreatedMs(story: any): number {
  if (story?.createdAt?.toMillis) return story.createdAt.toMillis();
  if (typeof story?.createdAtMs === 'number') return story.createdAtMs;
  return Date.now();
}

export function isStoryExpired(story: any): boolean {
  if (!story) return true;
  if (story.archived) return true;
  const exp = typeof story.expiresAt === 'number' ? story.expiresAt : getStoryCreatedMs(story) + STORY_TTL_MS;
  return exp <= Date.now();
}

export function canViewStory(story: any, owner: any, me: any, myUid: string): boolean {
  if (!story || isStoryExpired(story)) return false;
  if (owner?.status === 'suspended' || owner?.status === 'deleted') return false;
  if (Array.isArray(me?.blockedUsers) && me.blockedUsers.includes(story.uid)) return false;
  if (Array.isArray(owner?.blockedUsers) && myUid && owner.blockedUsers.includes(myUid)) return false;
  if (Array.isArray(owner?.hiddenStoryFrom) && myUid && owner.hiddenStoryFrom.includes(myUid)) return false;
  if (story.closeFriendsOnly || story.audience === 'Close Friends') {
    if (!myUid) return false;
    if (story.uid === myUid) return true;
    return Array.isArray(story.allowedUids) && story.allowedUids.includes(myUid);
  }
  if (owner?.isPrivate) {
    if (!myUid) return false;
    if (story.uid === myUid) return true;
    return Array.isArray(me?.following) && me.following.includes(story.uid);
  }
  return true;
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

export function validateStoryAsset(asset: { uri: string; fileSize?: number; mimeType?: string; type?: string }): string | null {
  if (!asset?.uri) return 'Invalid media file.';
  if (asset.fileSize && asset.fileSize > STORY_MAX_BYTES) return 'Media exceeds 25 MB limit.';
  const lower = (asset.uri || '').toLowerCase();
  const okExt = ['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov'].some((ext) => lower.includes(ext)) || asset.type === 'image' || asset.type === 'video';
  if (!okExt) return 'Unsupported format. Use JPG, PNG, WEBP, or MP4.';
  return null;
}

export function uploadStoryMediaToCloudinary(
  uri: string,
  type: 'image' | 'video',
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.append('file', {
      uri,
      type: type === 'video' ? 'video/mp4' : 'image/jpeg',
      name: `story_${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}`,
    } as any);
    data.append('upload_preset', CLOUDINARY_PRESET);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/${type}/upload`);
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
    xhr.onerror = () => reject(new Error('Network interruption during upload'));
    xhr.send(data);
  });
}

export interface StoryDraft {
  id: string;
  mode: 'media' | 'text' | 'multi';
  items: { uri: string; type: 'image' | 'video' }[];
  textItems: any[];
  stickers: any[];
  bgColor: string;
  textStoryValue: string;
  updatedAt: number;
}

const draftKey = (uid: string) => `flevora_story_drafts_${uid}`;

export async function loadStoryDrafts(uid: string): Promise<StoryDraft[]> {
  if (!uid) return [];
  try {
    const raw = await AsyncStorage.getItem(draftKey(uid));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveStoryDraft(uid: string, draft: StoryDraft): Promise<void> {
  if (!uid) return;
  const list = await loadStoryDrafts(uid);
  const next = [draft, ...list.filter((d) => d.id !== draft.id)].slice(0, 10);
  await AsyncStorage.setItem(draftKey(uid), JSON.stringify(next));
}

export async function deleteStoryDraft(uid: string, draftId: string): Promise<void> {
  if (!uid) return;
  const list = await loadStoryDrafts(uid);
  await AsyncStorage.setItem(draftKey(uid), JSON.stringify(list.filter((d) => d.id !== draftId)));
}
