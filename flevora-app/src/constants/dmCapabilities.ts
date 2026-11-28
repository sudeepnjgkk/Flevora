import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config';
import type { Lang } from './i18n';

export const DM_CLOUD_NAME = 'faqfo0lu';
export const DM_UPLOAD_PRESET = 'flevora_upload';
export const DM_MAX_BYTES = 25 * 1024 * 1024;

export interface DmCapabilities {
  planMode: 'spark' | 'blaze';
  cloudinaryUpload: boolean;
  voiceRecording: boolean;
  callingProvider: boolean;
  realtimePresence: boolean;
  serverModeration: boolean;
}

export const DEFAULT_DM_CAPABILITIES: DmCapabilities = {
  planMode: 'spark',
  cloudinaryUpload: true,
  voiceRecording: true,
  callingProvider: false,
  realtimePresence: false,
  serverModeration: false,
};

export async function detectDmCapabilities(): Promise<DmCapabilities> {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'dm'));
    if (!snap.exists()) return DEFAULT_DM_CAPABILITIES;
    const d = snap.data() || {};
    return {
      planMode: d.blazeEnabled === true ? 'blaze' : 'spark',
      cloudinaryUpload: true,
      voiceRecording: true,
      callingProvider: Boolean(d.callingProvider),
      realtimePresence: Boolean(d.realtimePresence),
      serverModeration: Boolean(d.serverModeration),
    };
  } catch {
    return DEFAULT_DM_CAPABILITIES;
  }
}

const DM_STRINGS = {
  English: {
    messages: 'Messages',
    searchPlaceholder: 'Search messages, people, or groups...',
    requests: 'Requests',
    primary: 'Primary',
    general: 'General',
    all: 'All',
    noChats: 'No messages yet. Tap ✏️ to start a chat!',
    typing: 'Typing...',
    activeNow: 'Active now',
    offline: 'Offline',
    msgPlaceholder: 'Message...',
    blockedPlaceholder: 'You cannot message this user',
    recording: 'Recording voice...',
    cancel: 'Cancel',
    send: 'Send',
    callUnavailable: 'Voice & Video Calling requires a configured real-time RTC provider (Agora/WebRTC + TURN/STUN).',
    loadOlder: 'Load older messages',
    disappearing: 'Disappearing messages',
    retry: 'Retry',
  },
  Hindi: {
    messages: 'मैसेज',
    searchPlaceholder: 'मैसेज, लोग या ग्रुप खोजें...',
    requests: 'रिक्वेस्ट',
    primary: 'प्राइमरी',
    general: 'जनरल',
    all: 'सभी',
    noChats: 'अभी कोई मैसेज नहीं है। चैट शुरू करने के लिए ✏️ दबाएं!',
    typing: 'टाइप कर रहे हैं...',
    activeNow: 'अभी ऑनलाइन',
    offline: 'ऑफ़लाइन',
    msgPlaceholder: 'मैसेज लिखें...',
    blockedPlaceholder: 'आप इस यूज़र को मैसेज नहीं भेज सकते',
    recording: 'वॉइस रिकॉर्ड हो रही है...',
    cancel: 'रद्द करें',
    send: 'भेजें',
    callUnavailable: 'वॉइस और वीडियो कॉलिंग के लिए रियल-टाइम RTC प्रोवाइडर (Agora/WebRTC + TURN/STUN) ज़रूरी है।',
    loadOlder: 'पुराने मैसेज लोड करें',
    disappearing: 'गायब होने वाले मैसेज',
    retry: 'फिर से कोशिश करें',
  },
  Hinglish: {
    messages: 'Messages',
    searchPlaceholder: 'Messages, log ya groups search karo...',
    requests: 'Requests',
    primary: 'Primary',
    general: 'General',
    all: 'All',
    noChats: 'Abhi koi message nahi hai. Chat shuru karne ke liye ✏️ dabao!',
    typing: 'Typing...',
    activeNow: 'Online hai',
    offline: 'Offline',
    msgPlaceholder: 'Message likho...',
    blockedPlaceholder: 'Aap is user ko message nahi bhej sakte',
    recording: 'Voice record ho rahi hai...',
    cancel: 'Cancel',
    send: 'Bhejo',
    callUnavailable: 'Voice aur Video Calling ke liye real-time RTC provider (Agora/WebRTC + TURN/STUN) setup hona zaroori hai.',
    loadOlder: 'Purane messages load karo',
    disappearing: 'Disappearing messages',
    retry: 'Retry Karo',
  },
};

export function dmT(lang: Lang) {
  return DM_STRINGS[lang] || DM_STRINGS.English;
}

export function canMessageUser(targetUser: any, me: any, myUid: string): { allowed: boolean; reason?: string } {
  if (!myUid) return { allowed: false, reason: 'Sign in required.' };
  if (!targetUser) return { allowed: true };
  if (Array.isArray(me?.blockedUsers) && me.blockedUsers.includes(targetUser.id || targetUser.uid)) {
    return { allowed: false, reason: 'You blocked this user.' };
  }
  if (Array.isArray(targetUser?.blockedUsers) && targetUser.blockedUsers.includes(myUid)) {
    return { allowed: false, reason: 'You cannot message this user.' };
  }
  if (targetUser?.status === 'suspended' || targetUser?.status === 'deleted') {
    return { allowed: false, reason: 'This account is unavailable.' };
  }
  const policy = targetUser?.allowMessagesFrom || 'everyone';
  if (policy === 'nobody') return { allowed: false, reason: 'This user has turned off message requests.' };
  if (policy === 'following' && !(Array.isArray(targetUser?.following) && targetUser.following.includes(myUid))) {
    return { allowed: false, reason: 'Only people this user follows can message them.' };
  }
  return { allowed: true };
}

export function validateDmAsset(asset: { uri: string; fileSize?: number; type?: string }): string | null {
  if (!asset?.uri) return 'Invalid file.';
  if (asset.fileSize && asset.fileSize > DM_MAX_BYTES) return 'File exceeds 25 MB limit.';
  return null;
}

export function uploadDmMediaToCloudinary(
  uri: string,
  type: 'image' | 'video' | 'audio',
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = new FormData();
    const mime = type === 'audio' ? 'audio/m4a' : type === 'video' ? 'video/mp4' : 'image/jpeg';
    const ext = type === 'audio' ? 'm4a' : type === 'video' ? 'mp4' : 'jpg';
    data.append('file', { uri, type: mime, name: `dm_${Date.now()}.${ext}` } as any);
    data.append('upload_preset', DM_UPLOAD_PRESET);
    const endpoint = type === 'image' ? 'image' : 'video';
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${DM_CLOUD_NAME}/${endpoint}/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const j = JSON.parse(xhr.responseText);
        if (j.secure_url) resolve(j.secure_url);
        else reject(new Error(j.error?.message || 'Upload failed'));
      } catch {
        reject(new Error('Invalid upload response'));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(data);
  });
}

const draftKey = (uid: string, chatId: string) => `flevora_dm_draft_${uid}_${chatId}`;

export async function loadDmDraft(uid: string, chatId: string): Promise<string> {
  if (!uid || !chatId) return '';
  try { return (await AsyncStorage.getItem(draftKey(uid, chatId))) || ''; } catch { return ''; }
}

export async function saveDmDraft(uid: string, chatId: string, text: string): Promise<void> {
  if (!uid || !chatId) return;
  try {
    if (!text.trim()) await AsyncStorage.removeItem(draftKey(uid, chatId));
    else await AsyncStorage.setItem(draftKey(uid, chatId), text);
  } catch {}
}

export function isMessageExpired(msg: any): boolean {
  if (!msg?.expiresAt) return false;
  return typeof msg.expiresAt === 'number' && msg.expiresAt <= Date.now();
}

export function formatMsgTime(ts: any): string {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
}
