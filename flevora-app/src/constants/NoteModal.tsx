import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, FlatList, Image,
  ActivityIndicator, Alert, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter } from 'expo-router';
import {
  doc, setDoc, updateDoc, deleteDoc, addDoc, collection,
  arrayUnion, arrayRemove, deleteField, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { useLang } from './i18n';
import {
  canViewNote, DEFAULT_NOTES_CAPABILITIES, detectNotesCapabilities,
  isNoteExpired, NOTE_MAX_BYTES, NOTE_MAX_CHARS, NOTE_PROMPT_TEMPLATES,
  NOTE_REPORT_CATEGORIES, NOTE_TTL_MS, notesT, toggleNoteLike, uploadNoteVideoToCloudinary,
} from './notesCapabilities';

export { canViewNote as canSeeNote };

const PLACES = ['Lucknow, India', 'New Delhi, India', 'Mumbai, India', 'Kanpur, India', 'Home', 'College'];

export function NoteModal({ visible, me, users, activeNote, onClose }: { visible: boolean; me: any; users: any[]; activeNote?: any; onClose: () => void }) {
  const { c } = useTheme();
  const { lang } = useLang();
  const L = notesT(lang);
  const uid = auth.currentUser?.uid || '';

  const [tab, setTab] = useState<'main' | 'prompt' | 'location' | 'audience'>('main');
  const [text, setText] = useState('');
  const [noteType, setNoteType] = useState<'text' | 'prompt'>('text');
  const [promptQ, setPromptQ] = useState('');
  const [location, setLocation] = useState('');
  const [videoUri, setVideoUri] = useState('');
  const [audience, setAudience] = useState<'friends' | 'closeFriends'>('friends');
  const [caps, setCaps] = useState(DEFAULT_NOTES_CAPABILITIES);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);

  const player = useVideoPlayer(videoUri || '', (p) => { p.loop = true; p.muted = true; if (videoUri) p.play(); });

  useEffect(() => {
    if (!visible) return;
    detectNotesCapabilities().then(setCaps);
    const n = activeNote || {};
    setText(n.text || '');
    setNoteType(n.type === 'prompt' ? 'prompt' : 'text');
    setPromptQ(n.promptQuestion || '');
    setLocation(n.location || '');
    setVideoUri(n.videoUrl || '');
    setAudience(n.audience === 'closeFriends' ? 'closeFriends' : 'friends');
    setTab('main'); setSearch(''); setBusy(false); setPct(0);
  }, [visible, activeNote?.id]);

  const atMatch = text.match(/@([a-zA-Z0-9_]*)$/);
  const mentionSuggestions = atMatch
    ? (users || []).filter((u) => u.id !== uid && (u.username || '').toLowerCase().includes(atMatch[1].toLowerCase()) && !(me?.blockedUsers || []).includes(u.id)).slice(0, 5)
    : [];

  const insertMention = (uname: string) => {
    const next = text.replace(/@([a-zA-Z0-9_]*)$/, `@${uname} `).slice(0, NOTE_MAX_CHARS);
    setText(next);
  };

  const recordVideoNote = async () => {
    if (!caps.videoNotes) return;
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera Permission', 'Allow camera access to record a short video note.');
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: 3, quality: 0.6 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      if (a.fileSize && a.fileSize > NOTE_MAX_BYTES) return Alert.alert('Too Large', 'Video must be under 25 MB.');
      setVideoUri(a.uri);
    }
  };

  const canShare = !busy && !!(text.trim() || (noteType === 'prompt' && promptQ.trim()) || videoUri || location);
  const dp = me?.photoUrl || me?.avatar || '';
  const cfIds: string[] = Array.isArray(me?.closeFriends) ? me.closeFriends : [];

  const saveNote = async () => {
    if (!uid || !canShare) return;
    setBusy(true);
    try {
      let finalVideoUrl = videoUri;
      if (videoUri && !videoUri.startsWith('http')) {
        finalVideoUrl = await uploadNoteVideoToCloudinary(videoUri, setPct);
      }
      const mentionNames = Array.from(new Set((text.match(/@([a-zA-Z0-9_]+)/g) || []).map((m) => m.slice(1).toLowerCase())));
      const mentionedUids = (users || []).filter((u) => mentionNames.includes((u.username || '').toLowerCase())).map((u) => u.id);

      await setDoc(doc(db, 'notes', uid), {
        uid,
        username: me?.username || 'user',
        userPhoto: dp,
        type: noteType,
        promptQuestion: noteType === 'prompt' ? promptQ.trim() : '',
        text: text.trim().slice(0, NOTE_MAX_CHARS),
        location: location || '',
        videoUrl: finalVideoUrl || '',
        audience,
        allowedUids: audience === 'closeFriends' ? cfIds : [],
        mentions: mentionedUids,
        likes: [],
        promptResponses: [],
        expiresAt: Date.now() + NOTE_TTL_MS,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'users', uid), { note: deleteField() }).catch(() => {});

      for (const tid of mentionedUids) {
        if (tid !== uid) {
          await addDoc(collection(db, 'notifications'), {
            toUid: tid, fromUid: uid, fromUsername: me?.username || 'user',
            type: 'note_mention', noteId: uid, message: 'mentioned you in a note.',
            read: false, createdAt: serverTimestamp(),
          }).catch(() => {});
        }
      }
      onClose();
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not publish note.');
    } finally {
      setBusy(false); setPct(0);
    }
  };

  const deleteNote = async () => {
    if (!uid) return;
    await deleteDoc(doc(db, 'notes', uid)).catch(() => {});
    await updateDoc(doc(db, 'users', uid), { note: deleteField() }).catch(() => {});
    onClose();
  };
    return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        {tab === 'main' && (
          <>
            <View style={s.top}>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color={c.text} /></TouchableOpacity>
              <Text style={{ color: c.muted, fontWeight: '700', fontSize: 13 }}>{text.length}/{NOTE_MAX_CHARS}</Text>
              {!!activeNote && <TouchableOpacity onPress={deleteNote}><Text style={{ color: '#EF4444', fontWeight: '700' }}>{L.deleteNote}</Text></TouchableOpacity>}
            </View>

            <View style={s.center}>
              <View style={[s.bubble, { backgroundColor: c.card, borderColor: c.border, borderWidth: 1 }]}>
                {noteType === 'prompt' && !!promptQ && <Text style={{ color: BRAND, fontWeight: '800', fontSize: 12, textAlign: 'center', marginBottom: 4 }}>{promptQ}</Text>}
                <TextInput value={text} onChangeText={setText} placeholder={L.shareThought} placeholderTextColor={c.muted} maxLength={NOTE_MAX_CHARS} multiline style={[s.input, { color: c.text }]} />
              </View>
              <View style={[s.tail, { backgroundColor: c.card }]} />
              {videoUri ? (
                <TouchableOpacity onLongPress={() => setVideoUri('')}>
                  <VideoView player={player} style={s.av} contentFit="cover" nativeControls={false} />
                </TouchableOpacity>
              ) : dp ? (
                <Image source={{ uri: dp }} style={s.av} />
              ) : (
                <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={38} color={BRAND_TEXT} /></View>
              )}

              {mentionSuggestions.length > 0 && (
                <View style={[s.mBox, { backgroundColor: c.card, borderColor: c.border }]}>
                  {mentionSuggestions.map((u) => (
                    <TouchableOpacity key={u.id} style={s.mRow} onPress={() => insertMention(u.username)}>
                      <Text style={{ color: c.text, fontWeight: '700' }}>@{u.username}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {!!location && <TouchableOpacity onPress={() => setLocation('')} style={[s.tagPill, { backgroundColor: c.input }]}><Ionicons name="location" size={14} color={BRAND} /><Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{location} ×</Text></TouchableOpacity>}

              <View style={s.iconRow}>
                <TouchableOpacity onPress={() => setTab('prompt')} style={[s.toolBtn, { backgroundColor: c.input }]}><Ionicons name="help-circle-outline" size={22} color={BRAND} /></TouchableOpacity>
                <TouchableOpacity onPress={recordVideoNote} style={[s.toolBtn, { backgroundColor: c.input }]}><Ionicons name="videocam-outline" size={22} color={c.text} /></TouchableOpacity>
                <TouchableOpacity onPress={() => setTab('location')} style={[s.toolBtn, { backgroundColor: c.input }]}><Ionicons name="location-outline" size={22} color={c.text} /></TouchableOpacity>
                <TouchableOpacity onPress={() => Alert.alert('Music Unavailable', L.musicUnavailable)} style={[s.toolBtn, { backgroundColor: c.input, opacity: 0.5 }]}><Ionicons name="musical-notes-outline" size={20} color={c.muted} /></TouchableOpacity>
                <TouchableOpacity onPress={() => Alert.alert('GIF Unavailable', L.gifUnavailable)} style={[s.toolBtn, { backgroundColor: c.input, opacity: 0.5 }]}><Text style={{ color: c.muted, fontWeight: '900', fontSize: 11 }}>GIF</Text></TouchableOpacity>
              </View>
              {busy && <Text style={{ color: BRAND, fontWeight: '700', marginTop: 10 }}>Publishing{pct ? ` ${pct}%` : '...'}</Text>}
            </View>

            <View style={s.bottom}>
              <TouchableOpacity onPress={() => setTab('audience')} style={s.audBtn}>
                <Ionicons name={audience === 'closeFriends' ? 'star' : 'people'} size={18} color={audience === 'closeFriends' ? '#10B981' : c.text} />
                <Text style={{ fontWeight: '700', color: c.text, fontSize: 13 }}>{audience === 'closeFriends' ? `${L.closeFriends} (${cfIds.length})` : L.mutualFollowers}</Text>
                <Ionicons name="chevron-forward" size={16} color={c.muted} />
              </TouchableOpacity>
              <TouchableOpacity onPress={saveNote} disabled={!canShare} style={[s.shareBtn, { opacity: canShare ? 1 : 0.4 }]}>
                {busy ? <ActivityIndicator size="small" color={BRAND_TEXT} /> : <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>{L.share}</Text>}
              </TouchableOpacity>
            </View>
          </>
        )}

        {tab === 'prompt' && (
          <View style={{ flex: 1 }}>
            <View style={s.subHead}><TouchableOpacity onPress={() => setTab('main')}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity><Text style={[s.subTitle, { color: c.text }]}>Prompt Note</Text><View style={{ width: 24 }} /></View>
            <TextInput value={promptQ} onChangeText={setPromptQ} placeholder="Write custom prompt..." placeholderTextColor={c.muted} maxLength={60} style={[s.searchBox, { backgroundColor: c.input, color: c.text }]} />
            {NOTE_PROMPT_TEMPLATES.map((tpl) => (
              <TouchableOpacity key={tpl} style={[s.listRow, { borderBottomColor: c.border }]} onPress={() => { setNoteType('prompt'); setPromptQ(tpl); setTab('main'); }}>
                <Ionicons name="sparkles-outline" size={20} color={BRAND} /><Text style={{ color: c.text, fontWeight: '600' }}>{tpl}</Text>
              </TouchableOpacity>
            ))}
            {!!promptQ.trim() && (
              <TouchableOpacity style={[s.shareBtn, { marginTop: 14, alignItems: 'center' }]} onPress={() => { setNoteType('prompt'); setTab('main'); }}>
                <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Use Custom Prompt</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {tab === 'location' && (
          <View style={{ flex: 1 }}>
            <View style={s.subHead}><TouchableOpacity onPress={() => setTab('main')}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity><Text style={[s.subTitle, { color: c.text }]}>Location</Text><View style={{ width: 24 }} /></View>
            <TextInput value={search} onChangeText={setSearch} placeholder="Type city or place..." placeholderTextColor={c.muted} style={[s.searchBox, { backgroundColor: c.input, color: c.text }]} />
            {!!search.trim() && <TouchableOpacity style={[s.listRow, { borderBottomColor: c.border }]} onPress={() => { setLocation(search.trim()); setTab('main'); }}><Ionicons name="add-circle" size={22} color={BRAND} /><Text style={{ color: c.text, fontWeight: '700' }}>Use "{search.trim()}"</Text></TouchableOpacity>}
            <FlatList data={PLACES.filter((p) => p.toLowerCase().includes(search.toLowerCase()))} keyExtractor={(i) => i} renderItem={({ item }) => (
              <TouchableOpacity style={[s.listRow, { borderBottomColor: c.border }]} onPress={() => { setLocation(item); setTab('main'); }}><Ionicons name="location" size={20} color={BRAND} /><Text style={{ color: c.text, fontWeight: '600' }}>{item}</Text></TouchableOpacity>
            )} />
          </View>
        )}

        {tab === 'audience' && (
          <View style={{ flex: 1 }}>
            <View style={s.subHead}>
              <TouchableOpacity onPress={() => setTab('main')}><Text style={{ color: c.muted, fontSize: 15 }}>Back</Text></TouchableOpacity>
              <Text style={[s.subTitle, { color: c.text }]}>Share with</Text>
              <TouchableOpacity onPress={() => setTab('main')}><Text style={{ color: BRAND, fontWeight: '800', fontSize: 15 }}>Done</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={[s.listRow, { borderBottomColor: c.border }]} onPress={() => setAudience('friends')}>
              <Ionicons name="people-circle" size={32} color={c.text} />
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>{L.mutualFollowers}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Only mutual followers</Text></View>
              <Ionicons name={audience === 'friends' ? 'radio-button-on' : 'radio-button-off'} size={22} color={BRAND} />
            </TouchableOpacity>
            <TouchableOpacity style={[s.listRow, { borderBottomColor: c.border }]} onPress={() => setAudience('closeFriends')}>
              <Ionicons name="star-circle" size={32} color="#10B981" />
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>{L.closeFriends}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Uses your Close Friends list ({cfIds.length} people)</Text></View>
              <Ionicons name={audience === 'closeFriends' ? 'radio-button-on' : 'radio-button-off'} size={22} color="#10B981" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

export function NoteDetailModal({
  visible, note, owner, me, myUid, allUsers = [], onReplyDm, onEditOwn, onClose,
}: any) {
  const { c } = useTheme();
  const { lang } = useLang();
  const router = useRouter();
  const L = notesT(lang);
  const [reply, setReply] = useState('');
  const [promptAns, setPromptAns] = useState('');
  const [showLikes, setShowLikes] = useState(false);

  if (!visible || !note) return null;
  if (isNoteExpired(note)) {
    return (
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={s.dBg} activeOpacity={1} onPress={onClose}>
          <View style={[s.dCard, { backgroundColor: c.card }]}><Text style={{ color: c.text, fontWeight: '700', textAlign: 'center' }}>{L.expired}</Text></View>
        </TouchableOpacity>
      </Modal>
    );
  }

  const isOwn = note.uid === myUid;
  const likes: string[] = Array.isArray(note.likes) ? note.likes : [];
  const liked = likes.includes(myUid);
  const resps: any[] = Array.isArray(note.promptResponses) ? note.promptResponses : [];
  const isMuted = Array.isArray(me?.mutedNotes) && me.mutedNotes.includes(note.uid);

  const sendPromptAnswer = async () => {
    if (!myUid || !promptAns.trim()) return;
    await updateDoc(doc(db, 'notes', note.id || note.uid), {
      promptResponses: arrayUnion({ id: `pr_${Date.now()}`, uid: myUid, username: me?.username || 'user', text: promptAns.trim() }),
    }).catch(() => {});
    setPromptAns('');
    Alert.alert('Sent', 'Response sent privately to the creator.');
  };

  const openMore = () => {
    if (isOwn) {
      Alert.alert('Your Note', undefined, [
        { text: 'Replace Note', onPress: () => { onClose(); onEditOwn?.(); } },
        { text: `View Likes (${likes.length})`, onPress: () => setShowLikes((v) => !v) },
        { text: L.deleteNote, style: 'destructive', onPress: async () => { await deleteDoc(doc(db, 'notes', note.id || myUid)); onClose(); } },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert(`@${owner?.username || note.username}`, undefined, [
        { text: L.visitProfile, onPress: () => { onClose(); router.push(`/user/${note.uid}` as any); } },
        { text: isMuted ? L.unmuteNotes : L.muteNotes, onPress: async () => { await updateDoc(doc(db, 'users', myUid), { mutedNotes: isMuted ? arrayRemove(note.uid) : arrayUnion(note.uid) }); onClose(); } },
        {
          text: L.reportNote, style: 'destructive',
          onPress: () => Alert.alert('Report Category', 'Select reason:', [
            ...NOTE_REPORT_CATEGORIES.slice(0, 4).map((cat) => ({
              text: cat, onPress: () => addDoc(collection(db, 'reports'), { noteId: note.id || note.uid, targetUid: note.uid, type: 'note', reason: cat, status: 'pending', reportedBy: myUid, reporterUid: myUid, createdAt: serverTimestamp() }),
            })),
            { text: 'Cancel', style: 'cancel' },
          ]),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.dBg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.dCard, { backgroundColor: c.card }]}>
          <View style={s.dHead}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>@{owner?.username || note.username || 'user'}</Text>
            <TouchableOpacity onPress={openMore}><Ionicons name="ellipsis-horizontal" size={22} color={c.text} /></TouchableOpacity>
          </View>
          {note.type === 'prompt' && !!note.promptQuestion && <Text style={{ color: BRAND, fontWeight: '800', fontSize: 13 }}>{note.promptQuestion}</Text>}
          {!!note.text && <Text style={{ color: c.text, fontSize: 17, fontWeight: '700' }}>{note.text}</Text>}
          {!!note.location && <Text style={{ color: c.muted, fontSize: 12 }}>📍 {note.location}</Text>}

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity onPress={() => toggleNoteLike(note, myUid, me)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={liked ? '#EF4444' : c.text} />
              <Text style={{ color: c.text, fontWeight: '700' }}>{likes.length}</Text>
            </TouchableOpacity>
            {isOwn && note.type === 'prompt' && <Text style={{ color: c.muted, fontSize: 12 }}>{resps.length} responses</Text>}
          </View>

          {isOwn && showLikes && likes.length > 0 && (
            <View style={{ maxHeight: 120 }}>
              {likes.map((lid) => {
                const u = allUsers.find((x: any) => x.id === lid);
                return <Text key={lid} style={{ color: c.muted, fontSize: 12 }}>❤️ @{u?.username || lid.slice(0, 6)}</Text>;
              })}
            </View>
          )}

          {isOwn && note.type === 'prompt' && resps.length > 0 && (
            <View style={{ gap: 6 }}>
              {resps.slice(0, 5).map((r) => (
                <TouchableOpacity key={r.id} onPress={() => { onClose(); onReplyDm?.(r.uid, r.username, `Replied to your prompt answer: "${r.text}"`); }} style={{ backgroundColor: c.input, padding: 8, borderRadius: 8 }}>
                  <Text style={{ color: c.text, fontSize: 12 }}><Text style={{ fontWeight: '800' }}>@{r.username}: </Text>{r.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {!isOwn && note.type === 'prompt' && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={promptAns} onChangeText={setPromptAns} placeholder="Answer prompt..." placeholderTextColor={c.muted} style={[s.dInp, { backgroundColor: c.input, color: c.text }]} />
              <TouchableOpacity onPress={sendPromptAnswer} style={{ backgroundColor: BRAND, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10 }}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Send</Text></TouchableOpacity>
            </View>
          )}

          {!isOwn && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={reply} onChangeText={setReply} placeholder={L.replyPlaceholder} placeholderTextColor={c.muted} style={[s.dInp, { backgroundColor: c.input, color: c.text }]} />
              <TouchableOpacity onPress={() => { if (reply.trim()) { onReplyDm?.(note.uid, owner?.username || note.username, reply.trim(), note); setReply(''); onClose(); } }} style={{ backgroundColor: BRAND, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10 }}><Ionicons name="send" size={18} color={BRAND_TEXT} /></TouchableOpacity>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'space-between', paddingTop: 48, paddingBottom: 22, paddingHorizontal: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  center: { alignItems: 'center' },
  bubble: { borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, minWidth: 160, maxWidth: '85%' },
  input: { fontSize: 15, fontWeight: '600', textAlign: 'center', padding: 0 },
  tail: { width: 12, height: 12, borderRadius: 6, marginTop: -4, marginBottom: 4 },
  av: { width: 88, height: 88, borderRadius: 44, overflow: 'hidden' },
  mBox: { width: '80%', borderWidth: 1, borderRadius: 12, marginTop: 8 },
  mRow: { padding: 10 },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  iconRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  toolBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  audBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shareBtn: { backgroundColor: BRAND, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 22 },
  subHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  subTitle: { fontSize: 17, fontWeight: '800' },
  searchBox: { borderRadius: 12, padding: 11, marginBottom: 12 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5 },
  dBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center', padding: 20 },
  dCard: { borderRadius: 20, padding: 18, gap: 12 },
  dHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dInp: { flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
});
              
