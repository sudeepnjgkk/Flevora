import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  doc, getDoc, updateDoc, addDoc, collection,
  arrayUnion, arrayRemove, increment, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config';
import type { Lang } from './i18n';

export const BC_CLOUD_NAME = 'faqfo0lu';
export const BC_UPLOAD_PRESET = 'flevora_upload';
export const BC_MAX_BYTES = 25 * 1024 * 1024;

export type ChannelRole = 'owner' | 'admin' | 'moderator' | 'member' | 'none';

export const BC_CATEGORIES = ['Creator', 'Tech', 'Music', 'Gaming', 'Education', 'Lifestyle', 'News', 'Other'] as const;
export const BC_REPORT_CATEGORIES = [
  'Spam', 'Harassment or bullying', 'Hate or abusive content',
  'Inappropriate content', 'Scam or fraud', 'Impersonation', 'Misinformation', 'Other',
] as const;

export interface BroadcastCapabilities {
  planMode: 'spark' | 'blaze';
  cloudinaryUpload: boolean;
  scheduledAnnouncements: boolean;
  serverFanOutPush: boolean;
  serverModeration: boolean;
}

export const DEFAULT_BC_CAPABILITIES: BroadcastCapabilities = {
  planMode: 'spark',
  cloudinaryUpload: true,
  scheduledAnnouncements: false,
  serverFanOutPush: false,
  serverModeration: false,
};

export async function detectBroadcastCapabilities(): Promise<BroadcastCapabilities> {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'broadcast'));
    if (!snap.exists()) return DEFAULT_BC_CAPABILITIES;
    const d = snap.data() || {};
    return {
      planMode: d.blazeEnabled === true ? 'blaze' : 'spark',
      cloudinaryUpload: true,
      scheduledAnnouncements: Boolean(d.scheduledAnnouncements),
      serverFanOutPush: Boolean(d.serverFanOutPush),
      serverModeration: Boolean(d.serverModeration),
    };
  } catch {
    return DEFAULT_BC_CAPABILITIES;
  }
}

const BC_STRINGS = {
  English: {
    channels: 'Broadcast Channels',
    discover: 'Discover',
    joined: 'Joined',
    createChannel: 'Create Channel',
    join: 'Join',
    open: 'Open',
    leave: 'Leave Channel',
    members: 'members',
    announcementsPlaceholder: 'Broadcast an announcement...',
    scheduleUnavailable: 'Scheduled announcements require a Blaze Cloud Function scheduler (not deployed yet).',
    repliesOff: 'Only admins can send messages in this channel.',
  },
  Hindi: {
    channels: 'ब्रॉडकास्ट चैनल',
    discover: 'खोजें',
    joined: 'जॉइन किए गए',
    createChannel: 'चैनल बनाएं',
    join: 'जॉइन करें',
    open: 'खोलें',
    leave: 'चैनल छोड़ें',
    members: 'सदस्य',
    announcementsPlaceholder: 'कोई घोषणा भेजें...',
    scheduleUnavailable: 'शेड्यूल्ड घोषणाओं के लिए Blaze Cloud Function शेड्यूलर ज़रूरी है।',
    repliesOff: 'इस चैनल में केवल एडमिन मैसेज भेज सकते हैं।',
  },
  Hinglish: {
    channels: 'Broadcast Channels',
    discover: 'Discover',
    joined: 'Joined',
    createChannel: 'Channel Banao',
    join: 'Join Karo',
    open: 'Open',
    leave: 'Channel Chhodo',
    members: 'members',
    announcementsPlaceholder: 'Announcement likho...',
    scheduleUnavailable: 'Scheduled announcements ke liye Blaze Cloud Function scheduler deployed hona zaroori hai.',
    repliesOff: 'Is channel me sirf admins message bhej sakte hain.',
  },
};

export function broadcastT(lang: Lang) {
  return BC_STRINGS[lang] || BC_STRINGS.English;
}

export function getChannelRole(ch: any, uid: string): ChannelRole {
  if (!ch || !uid) return 'none';
  if (ch.ownerUid === uid) return 'owner';
  if (Array.isArray(ch.admins) && ch.admins.includes(uid)) return 'admin';
  if (Array.isArray(ch.moderators) && ch.moderators.includes(uid)) return 'moderator';
  if (Array.isArray(ch.members) && ch.members.includes(uid)) return 'member';
  return 'none';
}

export function canPublishAnnouncement(role: ChannelRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function canModerateReplies(role: ChannelRole): boolean {
  return role === 'owner' || role === 'admin' || role === 'moderator';
}

export function canViewChannel(ch: any, uid: string, me?: any): boolean {
  if (!ch || ch.status === 'deleted') return false;
  if (Array.isArray(ch.bannedUids) && uid && ch.bannedUids.includes(uid)) return false;
  if (Array.isArray(me?.blockedUsers) && me.blockedUsers.includes(ch.ownerUid)) return false;
  if (ch.visibility === 'private') {
    return getChannelRole(ch, uid) !== 'none';
  }
  return true;
}

export async function joinChannelIdempotent(ch: any, uid: string) {
  if (!ch?.id || !uid) throw new Error('Sign in required.');
  if (Array.isArray(ch.bannedUids) && ch.bannedUids.includes(uid)) {
    throw new Error('You cannot join this channel.');
  }
  if (Array.isArray(ch.members) && ch.members.includes(uid)) return;
  await updateDoc(doc(db, 'channels', ch.id), {
    members: arrayUnion(uid),
    memberCount: increment(1),
    updatedAt: serverTimestamp(),
  });
}

export async function leaveChannelSafe(ch: any, uid: string) {
  if (!ch?.id || !uid) return;
  if (ch.ownerUid === uid) {
    throw new Error('Owner cannot leave without transferring ownership or deleting the channel.');
  }
  if (!Array.isArray(ch.members) || !ch.members.includes(uid)) return;
  await updateDoc(doc(db, 'channels', ch.id), {
    members: arrayRemove(uid),
    admins: arrayRemove(uid),
    moderators: arrayRemove(uid),
    memberCount: increment(-1),
    updatedAt: serverTimestamp(),
  });
}

export async function transferChannelOwnership(ch: any, currentOwnerUid: string, newOwnerUid: string) {
  if (!ch?.id || ch.ownerUid !== currentOwnerUid) throw new Error('Only the owner can transfer ownership.');
  if (!Array.isArray(ch.members) || !ch.members.includes(newOwnerUid)) throw new Error('New owner must be a channel member.');
  await updateDoc(doc(db, 'channels', ch.id), {
    ownerUid: newOwnerUid,
    admins: arrayUnion(newOwnerUid),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteChannelSafe(ch: any, uid: string) {
  if (!ch?.id || ch.ownerUid !== uid) throw new Error('Only the owner can delete this channel.');
  await updateDoc(doc(db, 'channels', ch.id), {
    status: 'deleted',
    inviteActive: false,
    updatedAt: serverTimestamp(),
  });
}

export function validateBcAsset(asset: { uri: string; fileSize?: number }): string | null {
  if (!asset?.uri) return 'Invalid media file.';
  if (asset.fileSize && asset.fileSize > BC_MAX_BYTES) return 'File exceeds 25 MB limit.';
  return null;
}

export function uploadBroadcastMediaToCloudinary(
  uri: string,
  type: 'image' | 'video',
  onProgress?: (pct: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.append('file', { uri, type: type === 'video' ? 'video/mp4' : 'image/jpeg', name: `bc_${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}` } as any);
    data.append('upload_preset', BC_UPLOAD_PRESET);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${BC_CLOUD_NAME}/${type}/upload`);
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
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(data);
  });
}

const bcDraftKey = (uid: string, chId: string) => `flevora_bc_draft_${uid}_${chId}`;

export async function loadChannelDraft(uid: string, chId: string): Promise<string> {
  if (!uid || !chId) return '';
  try { return (await AsyncStorage.getItem(bcDraftKey(uid, chId))) || ''; } catch { return ''; }
}

export async function saveChannelDraft(uid: string, chId: string, text: string): Promise<void> {
  if (!uid || !chId) return;
  try {
    if (!text.trim()) await AsyncStorage.removeItem(bcDraftKey(uid, chId));
    else await AsyncStorage.setItem(bcDraftKey(uid, chId), text);
  } catch {}
}

export async function notifyChannelMembers(ch: any, actorUid: string, actorName: string, text: string) {
  const members: string[] = Array.isArray(ch?.members) ? ch.members : [];
  const targets = members.filter((id) => id !== actorUid).slice(0, 25);
  await Promise.all(
    targets.map((toUid) =>
      addDoc(collection(db, 'notifications'), {
        toUid, fromUid: actorUid, fromUsername: actorName || 'creator',
        type: 'channel', channelId: ch.id,
        message: `posted in ${ch.name}: ${text.slice(0, 60)}`,
        read: false, createdAt: serverTimestamp(),
      }).catch(() => {})
    )
  );
}
