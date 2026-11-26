import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import { useRouter } from 'expo-router';
import { doc, updateDoc, deleteDoc, addDoc, setDoc, collection, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { BRAND, NEON } from './theme';
import { sendPush } from './push';
import { ChatInfoModal } from './ChatInfoModal';

const CLOUD = 'faqfo0lu';
const PRESET = 'flevora_upload';
const REACTS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

function VoiceBubble({ uri, mine, textColor }: { uri: string; mine: boolean; textColor: string }) {
  const player = useAudioPlayer(uri);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    if (playing) { player.pause(); setPlaying(false); }
    else { player.play(); setPlaying(true); }
  };
  return (
    <TouchableOpacity onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 130 }}>
      <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={28} color={mine ? '#fff' : BRAND} />
      <Text style={{ color: mine ? '#fff' : textColor, fontWeight: '700', fontSize: 13 }}>Voice message</Text>
    </TouchableOpacity>
  );
}

export function DmChatRoom({ myUid, me, chatId: propChatId, convo, targetUid, targetName, otherUser, msgs, onBack, onForward, c }: any) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [menuMsg, setMenuMsg] = useState<any>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [chatColor, setChatColor] = useState(NEON.purple);
  const [recording, setRecording] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const chatId = propChatId || [myUid, targetUid].sort().join('_');
  const isGroup = convo?.type === 'group';
  const blocked = !isGroup && ((me?.blockedUsers || []).includes(targetUid) || (otherUser?.blockedUsers || []).includes(myUid));
  const online = !isGroup && (otherUser?.isOnline || (otherUser?.lastSeen?.toDate ? Date.now() - otherUser.lastSeen.toDate().getTime() < 300000 : false));
  const sub = isGroup ? `${convo?.participants?.length || 0} members` : otherUser?.typingTo === myUid ? 'Typing...' : online ? 'Active now' : 'Offline';
  const dp = otherUser?.photoUrl || otherUser?.avatar || '';

  const sendMsg = async (mediaUrl = '', mediaType = 'text') => {
    const body = text.trim();
    if (blocked || (!body && !mediaUrl)) return;
    if (editing) {
      await updateDoc(doc(db, 'conversations', chatId, 'messages', editing.id), { text: body, editedAt: serverTimestamp() }).catch(() => {});
      setEditing(null); setText(''); return;
    }
    setText('');
    const replySnapshot = replyTo ? { id: replyTo.id, text: replyTo.text || 'Media', senderUid: replyTo.senderUid } : null;
    setReplyTo(null);
    await setDoc(doc(db, 'conversations', chatId), { participants: convo?.participants || [myUid, targetUid], updatedAt: serverTimestamp(), lastMessage: body || (mediaType === 'audio' ? '🎤 Voice message' : '📷 Media'), lastSenderUid: myUid }, { merge: true });
    await addDoc(collection(db, 'conversations', chatId, 'messages'), { senderUid: myUid, senderName: me?.username || 'user', text: body, mediaUrl, mediaType, replyTo: replySnapshot, read: false, createdAt: serverTimestamp() });
    if (otherUser?.expoPushToken && !(me?.mutedMsgChats?.[targetUid])) sendPush(otherUser.expoPushToken, me?.username || 'New Message', body || 'Sent a message');
  };

  const uploadToCloud = async (uri: string, type: 'image' | 'video' | 'audio') => {
    const data = new FormData();
    data.append('file', { uri, type: type === 'audio' ? 'audio/m4a' : type === 'video' ? 'video/mp4' : 'image/jpeg', name: `dm_${Date.now()}` } as any);
    data.append('upload_preset', PRESET);
    const endpoint = type === 'image' ? 'image' : 'video';
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${endpoint}/upload`, { method: 'POST', body: data });
    const j = await r.json();
    if (j.secure_url) await sendMsg(j.secure_url, type);
  };

  const pickMedia = async (useCam: boolean) => {
    if (blocked) return;
    const res = useCam ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 });
    if (!res.canceled && res.assets[0]) uploadToCloud(res.assets[0].uri, res.assets[0].type === 'video' ? 'video' : 'image').catch(() => Alert.alert('Failed', 'Upload failed.'));
  };

  const startVoice = async () => {
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) return Alert.alert('Mic Permission', 'Please allow microphone access.');
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  const stopVoice = async (send: boolean) => {
    await recorder.stop();
    setRecording(false);
    if (send && recorder.uri) uploadToCloud(recorder.uri, 'audio').catch(() => Alert.alert('Failed', 'Voice upload failed.'));
  };

  const visibleMsgs = (msgs || []).filter((m: any) => !(Array.isArray(m.deletedFor) && m.deletedFor.includes(myUid)));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[s.hdr, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
        <TouchableOpacity onPress={() => !isGroup && targetUid && router.push(`/user/${targetUid}` as any)} style={{ flexDirection: 'row', alignItems

: 'center', gap: 10, flex: 1 }}>
          <View>{dp ? <Image source={{ uri: dp }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name={isGroup ? 'people' : 'person'} size={18} color="#fff" /></View>}{online && <View style={[s.dot, { borderColor: c.background }]} />}</View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '800', color: c.text }} numberOfLines={1}>{isGroup ? convo?.groupName : (otherUser?.username || targetName)}</Text><Text style={{ fontSize: 12, color: online ? '#10B981' : c.muted }}>{sub}</Text></View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Voice Call', 'Real-time calling infrastructure (Agora/WebRTC) needed.')} style={s.hIcon}><Ionicons name="call-outline" size={21} color={c.text} /></TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Video Call', 'Real-time calling infrastructure (Agora/WebRTC) needed.')} style={s.hIcon}><Ionicons name="videocam-outline" size={23} color={c.text} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setInfoOpen(true)} style={s.hIcon}><Ionicons name="information-circle-outline" size={23} color={c.text} /></TouchableOpacity>
      </View>

      <FlatList
        inverted data={visibleMsgs} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 14 }}
        ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>Say hi to start the conversation!</Text>}
        renderItem={({ item }) => {
          const mine = item.senderUid === myUid;
          return (
            <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              {isGroup && !mine && <Text style={{ color: c.muted, fontSize: 11, marginBottom: 2 }}>@{item.senderName || 'user'}</Text>}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TouchableOpacity onPress={() => item.postId && router.push(`/reels?startId=${item.postId}` as any)} onLongPress={() => setMenuMsg(item)} activeOpacity={0.85} style={[s.bubble, mine ? { backgroundColor: chatColor } : { backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]}>
                  {!!item.replyTo && <View style={s.repBox}><Text style={{ color: mine ? '#eee' : c.muted, fontSize: 11 }} numberOfLines={1}>↩ {item.replyTo.text}</Text></View>}
                  {item.mediaType === 'audio' && !!item.mediaUrl ? <VoiceBubble uri={item.mediaUrl} mine={mine} textColor={c.text} /> : !!item.mediaUrl ? <Image source={{ uri: item.mediaType === 'video' ? item.mediaUrl.replace(/\.mp4.*$/, '.jpg') : item.mediaUrl }} style={s.media} /> : null}
                  {!!item.text && <Text style={{ color: mine ? '#fff' : c.text, fontSize: 14 }}>{item.text}{item.editedAt ? ' (edited)' : ''}</Text>}
                  {!!item.reaction && <Text style={{ fontSize: 14, marginTop: 2 }}>{item.reaction}</Text>}
                </TouchableOpacity>
                {!!item.mediaUrl && <TouchableOpacity onPress={() => onForward?.(item)}><Ionicons name="paper-plane-outline" size={16} color={c.text} /></TouchableOpacity>}
              </View>
              {mine && <Text style={{ color: c.muted, fontSize: 10, marginTop: 2 }}>{item.read ? '✓✓ Seen' : '✓ Sent'}</Text>}
            </View>
          );
        }}
      />

      {!!menuMsg && (
        <View style={[s.reactBar, { backgroundColor: c.card, borderColor: c.border }]}>
          {REACTS.map((e) => <TouchableOpacity key={e} onPress={() => { updateDoc(doc(db, 'conversations', chatId, 'messages', menuMsg.id), { reaction: e }); setMenuMsg(null); }}><Text style={{ fontSize: 21 }}>{e}</Text></TouchableOpacity>)}
          <TouchableOpacity onPress={() => { setReplyTo(menuMsg); setMenuMsg(null); }}><Ionicons name="arrow-undo" size={19} color={c.text} /></TouchableOpacity>
          {menuMsg.senderUid === myUid && !!menuMsg.text && <TouchableOpacity onPress={() => { setEditing(menuMsg); setText(menuMsg.text); setMenuMsg(null); }}><Ionicons name="create-outline" size={19} color={c.text} /></TouchableOpacity>}
          <TouchableOpacity onPress={() => { updateDoc(doc(db, 'conversations', chatId, 'messages', menuMsg.id), { deletedFor: arrayUnion(myUid) }); setMenuMsg(null); }}><Ionicons name="eye-off-outline" size={19} color={c.muted} /></TouchableOpacity>
          {menuMsg.senderUid === myUid && <TouchableOpacity onPress={() => { deleteDoc(doc(db, 'conversations', chatId, 'messages', menuMsg.id)); setMenuMsg(null); }}><Ionicons name="trash" size={19} color="#EF4444" /></TouchableOpacity>}
          <TouchableOpacity onPress={() => setMenuMsg(null)}><Ionicons name="close" size={19} color={c.muted} /></TouchableOpacity>
        </View>
      )}

      {(replyTo || editing) && (
        <View style={[s.repBanner, { backgroundColor: c.surface }]}>
          <Text style={{ color: c.text, fontSize: 12, flex: 1 }} numberOfLines={1}>{editing ? `Editing: ${editing.text}` : `Replying to: ${replyTo.text || 'Media'}`}</Text>
          <TouchableOpacity onPress={() => { setReplyTo(null); setEditing(null); }}><Ionicons name="close" size={18} color={c.muted} /></TouchableOpacity>
        </View>
      )}

      {recording ? (
        <View style={[s.inpBar, { borderTopColor: c.border, backgroundColor: c.card }]}>
          <Ionicons name="mic" size={22} color="#EF4444" />
          <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>Recording voice...</Text>
          <TouchableOpacity onPress={() => stopVoice(false)}><Text style={{ color: '#EF4444', fontWeight: '700', marginRight: 14 }}>Cancel</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => stopVoice(true)} style={{ backgroundColor: chatColor, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 }}><Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={[s.inpBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <TouchableOpacity onPress={() => pickMedia(true)}><Ionicons name="camera" size={24} color={chatColor} /></TouchableOpacity>
          <TextInput value={text} onChangeText={setText} placeholder={blocked ? 'Blocked' : 'Message...'} editable={!blocked} multiline placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input, borderColor: c.border }]} />
          <TouchableOpacity onPress={startVoice}><Ionicons name="mic-outline" size={23} color={c.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => pickMedia(false)}><Ionicons name="image-outline" size={23} color={c.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => sendMsg()}><Ionicons name="send" size={22} color={chatColor} /></TouchableOpacity>
        </View>
      )}

      <ChatInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} myUid={myUid} chatId={chatId} convo={convo} otherUser={otherUser} msgs={visibleMsgs} c={c} chatColor={chatColor} onChangeColor={setChatColor} onLeaveOrDelete={() => { updateDoc(doc(db, 'users', myUid), { hiddenChats: arrayUnion(targetUid || chatId) }); onBack(); }} />
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 48, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  av: { width: 38, height: 38, borderRadius: 19 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', position: 'absolute', right: 0, bottom: 0, borderWidth: 2 },
  hIcon: { padding: 5 },
  bubble: { maxWidth: 245, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  repBox: { borderLeftWidth: 2, borderColor: 'rgba(255,255,255,0.6)', paddingLeft: 6, marginBottom: 4 },
  media: { width: 200, height: 210, borderRadius: 12, marginBottom: 4 },
  reactBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, paddingVertical: 8, borderRadius: 24, borderWidth: 1 },
  repBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7 },
  inpBar: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5 },
  inp: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14, maxHeight: 90 },
});
