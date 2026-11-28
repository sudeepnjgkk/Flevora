import { doc, getDoc, updateDoc, addDoc, collection, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import type { Lang } from './i18n';

export const NOTE_MAX_CHARS = 60;
export const NOTE_TTL_MS = 24 * 60 * 60 * 1000;
export const NOTE_CLOUD_NAME = 'faqfo0lu';
export const NOTE_UPLOAD_PRESET = 'flevora_upload';
export const NOTE_MAX_BYTES = 25 * 1024 * 1024;

export const NOTE_PROMPT_TEMPLATES = [
  'Ask me a question...',
  'Share an unpopular opinion...',
  'Pick one: Coffee or Chai?',
  'Today I feel like...',
  'Recommend a good movie/song!',
] as const;

export const NOTE_REPORT_CATEGORIES = [
  'Spam',
  'Harassment or bullying',
  'Hate or abusive content',
  'Inappropriate content',
  'Scam or fraud',
  'False or misleading information',
  'Other',
] as const;

export interface NotesCapabilities {
  planMode: 'spark' | 'blaze';
  musicProvider: boolean;
  gifProvider: boolean;
  videoNotes: boolean;
  locationProvider: boolean;
  serverCleanup: boolean;
}

export const DEFAULT_NOTES_CAPABILITIES: NotesCapabilities = {
  planMode: 'spark',
  musicProvider: false,
  gifProvider: false,
  videoNotes: true,
  locationProvider: true,
  serverCleanup: false,
};

export async function detectNotesCapabilities(): Promise<NotesCapabilities> {
  try {
    const snap = await getDoc(doc(db, 'app_config', 'notes'));
    if (!snap.exists()) return DEFAULT_NOTES_CAPABILITIES;
    const d = snap.data() || {};
    return {
      planMode: d.blazeEnabled === true ? 'blaze' : 'spark',
      musicProvider: Boolean(d.musicProvider),
      gifProvider: Boolean(d.gifProvider),
      videoNotes: d.videoNotes !== false,
      locationProvider: d.locationProvider !== false,
      serverCleanup: Boolean(d.serverCleanup),
    };
  } catch {
    return DEFAULT_NOTES_CAPABILITIES;
  }
}

const NOTE_STRINGS = {
  English: {
    yourNote: 'Your note',
    shareThought: 'Share a thought...',
    share: 'Share',
    deleteNote: 'Delete note',
    mutualFollowers: 'Followers you follow back',
    closeFriends: 'Close Friends',
    replyPlaceholder: 'Reply privately in DM...',
    muteNotes: 'Mute Notes',
    unmuteNotes: 'Unmute Notes',
    reportNote: 'Report Note',
    visitProfile: 'Visit Profile',
    musicUnavailable: 'Music Notes require a licensed music provider (not configured yet).',
    gifUnavailable: 'GIF search requires a configured GIPHY API key.',
    expired: 'This note has expired.',
  },
  Hindi: {
    yourNote: 'आपका नोट',
    shareThought: 'कोई विचार लिखें...',
    share: 'शेयर करें',
    deleteNote: 'नोट हटाएं',
    mutualFollowers: 'वे फॉलोअर्स जिन्हें आप भी फॉलो करते हैं',
    closeFriends: 'क्लोज़ फ्रेंड्स',
    replyPlaceholder: 'DM में प्राइवेट रिप्लाई करें...',
    muteNotes: 'नोट्स म्यूट करें',
    unmuteNotes: 'नोट्स अनम्यूट करें',
    reportNote: 'नोट रिपोर्ट करें',
    visitProfile: 'प्रोफ़ाइल देखें',
    musicUnavailable: 'म्यूज़िक नोट्स के लिए लाइसेंस्ड म्यूज़िक प्रोवाइडर ज़रूरी है।',
    gifUnavailable: 'GIF सर्च के लिए GIPHY API key ज़रूरी है।',
    expired: 'यह नोट समाप्त हो चुका है।',
  },
  Hinglish: {
    yourNote: 'Aapka note',
    shareThought: 'Kuch thought likho...',
    share: 'Share Karo',
    deleteNote: 'Note Delete Karo',
    mutualFollowers: 'Followers jinhe aap follow back karte ho',
    closeFriends: 'Close Friends',
    replyPlaceholder: 'DM me private reply karo...',
    muteNotes: 'Notes Mute Karo',
    unmuteNotes: 'Notes Unmute Karo',
    reportNote: 'Note Report Karo',
    visitProfile: 'Profile Dekho',
    musicUnavailable: 'Music Notes ke liye licensed music provider configured hona zaroori hai.',
    gifUnavailable: 'GIF search ke liye GIPHY API key configured nahi hai.',
    expired: 'Ye note expire ho chuka hai.',
  },
};

export function notesT(lang: Lang) {
  return NOTE_STRINGS[lang] || NOTE_STRINGS.English;
}

export function isNoteExpired(note: any): boolean {
  if (!note) return true;
  if (typeof note.expiresAt === 'number' && note.expiresAt <= Date.now()) return true;
  return false;
}

export function canViewNote(note: any, myUid: string, ownerUid: string, me: any, owner?: any): boolean {
  if (!note || isNoteExpired(note)) return false;
  if (owner?.status === 'suspended' || owner?.status === 'deleted' || owner?.status === 'deactivated') return false;
  if (ownerUid === myUid) return true;
  if (!myUid) return false;
  if (Array.isArray(me?.blockedUsers) && me.blockedUsers.includes(ownerUid)) return false;
  if (Array.isArray(owner?.blockedUsers) && owner.blockedUsers.includes(myUid)) return false;
  if (Array.isArray(me?.mutedNotes) && me.mutedNotes.includes(ownerUid)) return false;

  if (note.audience === 'closeFriends') {
    const cfList = Array.isArray(owner?.closeFriends) ? owner.closeFriends : (Array.isArray(note.allowedUids) ? note.allowedUids : []);
    return cfList.includes(myUid);
  }
  const iFollowOwner = Array.isArray(me?.following) && me.following.includes(ownerUid);
  const ownerFollowsMe = owner
    ? (Array.isArray(owner.following) && owner.following.includes(myUid)) || (Array.isArray(me?.followers) && me.followers.includes(ownerUid))
    : Array.isArray(me?.followers) && me.followers.includes(ownerUid);
  return iFollowOwner && ownerFollowsMe;
}

export async function toggleNoteLike(note: any, myUid: string, me: any) {
  if (!myUid || !note?.uid || isNoteExpired(note)) return;
  const noteId = note.id || note.uid;
  const likes: string[] = Array.isArray(note.likes) ? note.likes : [];
  const liked = likes.includes(myUid);
  await updateDoc(doc(db, 'notes', noteId), {
    likes: liked ? arrayRemove(myUid) : arrayUnion(myUid),
  });
  if (!liked && note.uid !== myUid) {
    await addDoc(collection(db, 'notifications'), {
      toUid: note.uid,
      fromUid: myUid,
      fromUsername: me?.username || 'user',
      type: 'note_like',
      noteId,
      message: 'liked your note.',
      read: false,
      createdAt: serverTimestamp(),
    }).catch(() => {});
  }
}

export function uploadNoteVideoToCloudinary(uri: string, onProgress?: (pct: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const data = new FormData();
    data.append('file', { uri, type: 'video/mp4', name: `note_${Date.now()}.mp4` } as any);
    data.append('upload_preset', NOTE_UPLOAD_PRESET);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${NOTE_CLOUD_NAME}/video/upload`);
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
