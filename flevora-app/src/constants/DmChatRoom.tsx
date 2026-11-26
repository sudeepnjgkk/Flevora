import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { doc, updateDoc, deleteDoc, addDoc, setDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { BRAND, NEON } from './theme';
import { sendPush } from './push';
import { GlossyIcon } from './GlossyIcon';

const CLOUD = 'faqfo0lu';
const PRESET = 'flevora_upload';
const REACTS = ['😂', '❤️', '😍', '🔥', '👍', '😢'];
const STICKERS = ['👋 Hey!', '🔥 Lit!', '❤️ Love it', '😂 Haha', '💯 100%', '🥳 Party'];

export function DmChatRoom({ myUid, me, targetUid, targetName, otherUser, msgs, onBack, onForward, onToggleLabel, labelText, c }: any) {
  const [text, setText] = useState('');
  const [reactMsg, setReactMsg] = useState<any>(null);
  const [showStickers, setShowStickers] = useState(false);
  const chatId = [myUid, targetUid].sort().join('_');
  const blocked = (me?.blockedUsers || []).includes(targetUid) || (otherUser?.blockedUsers || []).includes(myUid);

  const isOnline = (u: any) => u?.isOnline || (u?.lastSeen?.toDate ? Date.now() - u.lastSeen.toDate().getTime() < 300000 : false);
  const online = isOnline(otherUser);
  const sub = otherUser?.typingTo === myUid ? 'Typing...' : online ? 'Active now' : 'Offline';
  const dp = otherUser?.photoUrl || otherUser?.avatar || '';

  const sendMsg = async (mediaUrl = '', mediaType = 'text', customText?: string) => {
    const body = (customText ?? text).trim();
    if (blocked || (!body && !mediaUrl)) return;
    if (!customText) setText('');
    await setDoc(doc(db, 'conversations', chatId), { participants: [myUid, targetUid], updatedAt: serverTimestamp(), lastMessage: body || 'Media' }, { merge: true });
    await addDoc(collection(db, 'conversations', chatId, 'messages'), { senderUid: myUid, text: body, mediaUrl, mediaType, read: false, createdAt: serverTimestamp() });
    if (otherUser?.expoPushToken) sendPush(otherUser.expoPushToken, me?.username || 'New Message', body || 'Sent media');
  };

  const pickMedia = async (useCam: boolean) => {
    if (blocked) return;
    const res = useCam
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const type = asset.type === 'video' ? 'video' : 'image';
    const data = new FormData();
    data.append('file', { uri: asset.uri, type: type === 'video' ? 'video/mp4' : 'image/jpeg', name: `dm_${Date.now()}` } as any);
    data.append('upload_preset', PRESET);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD}/${type}/upload`);
    xhr.onload = () => { const j = JSON.parse(xhr.responseText); if (j.secure_url) sendMsg(j.secure_url, type); };
    xhr.send(data);
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[s.hdr, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
        <View style

={{ position: 'relative' }}>
          {dp ? <Image source={{ uri: dp }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={18} color="#fff" /></View>}
          {online && <View style={[s.dot, { borderColor: c.background }]} />}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: c.text }} numberOfLines={1}>{otherUser?.username || targetName}</Text>
          <Text style={{ fontSize: 12, color: online ? '#10B981' : c.muted }}>{sub}</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Audio Call', 'Free tier par live voice call server available nahi hai.')} style={s.hIcon}><Ionicons name="call-outline" size={21} color={c.text} /></TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Video Call', 'Free tier par live video call server available nahi hai.')} style={s.hIcon}><Ionicons name="videocam-outline" size={23} color={c.text} /></TouchableOpacity>
        <TouchableOpacity onPress={onToggleLabel} style={s.hIcon}><Ionicons name="pricetag" size={20} color={labelText === 'Follow up' ? NEON.pink : NEON.purple} /></TouchableOpacity>
      </View>

      <FlatList
        inverted data={msgs} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 14 }}
        renderItem={({ item }) => {
          const mine = item.senderUid === myUid;
          return (
            <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                {!mine && (dp ? <Image source={{ uri: dp }} style={s.miniAv} /> : null)}
                <TouchableOpacity onLongPress={() => setReactMsg(item)} activeOpacity={0.85} style={[s.bubble, mine ? { backgroundColor: NEON.purple } : { backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]}>
                  {!!item.mediaUrl && <Image source={{ uri: item.mediaType === 'video' ? item.mediaUrl.replace(/\.mp4.*$/, '.jpg') : item.mediaUrl }} style={s.media} />}
                  {!!item.text && <Text style={{ color: mine ? '#fff' : c.text, fontSize: 14, lineHeight: 20 }}>{item.text}</Text>}
                  {!!item.reaction && <Text style={{ fontSize: 14, marginTop: 2 }}>{item.reaction}</Text>}
                </TouchableOpacity>
                {!!item.mediaUrl && <TouchableOpacity onPress={() => onForward?.(item)} style={s.fwdBtn}><Ionicons name="paper-plane-outline" size={16} color={c.text} /></TouchableOpacity>}
              </View>
              {mine && <Text style={{ color: c.muted, fontSize: 10, marginTop: 2 }}>{item.read ? '✓✓ Seen' : '✓ Sent'}</Text>}
            </View>
          );
        }}
      />

      {!!reactMsg && (
        <View style={[s.reactBar, { backgroundColor: c.card, borderColor: c.border }]}>
          {REACTS.map((e) => (
            <TouchableOpacity key={e} onPress={() => { updateDoc(doc(db, 'conversations', chatId, 'messages', reactMsg.id), { reaction: e }).catch(() => {}); setReactMsg(null); }}>
              <Text style={{ fontSize: 22 }}>{e}</Text>
            </TouchableOpacity>
          ))}
          {reactMsg.senderUid === myUid && (
            <TouchableOpacity onPress={() => { deleteDoc(doc(db, 'conversations', chatId, 'messages', reactMsg.id)); setReactMsg(null); }}>
              <Ionicons name="trash" size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setReactMsg(null)}><Ionicons name="close" size={20} color={c.muted} /></TouchableOpacity>
        </View>
      )}

      {showStickers && (
        <View style={[s.stickerRow, { backgroundColor: c.card, borderTopColor: c.border }]}>
          {STICKERS.map((st) => (
            <TouchableOpacity key={st} onPress={() => { sendMsg('', 'text', st); setShowStickers(false); }} style={[s.stPill, { backgroundColor: c.input }]}>
              <Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{st}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={[s.inpBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
        <TouchableOpacity onPress={() => pickMedia(true)}><GlossyIcon name="camera" size={18} boxSize={36} active accent={NEON.pink} /></TouchableOpacity>
        <TextInput value={text} onChangeText={setText} placeholder={blocked ? 'Blocked' : 'Message...'} editable={!blocked} placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input, borderColor: c.border }]} />
        <TouchableOpacity onPress={() => setShowStickers((v) => !v)}><Ionicons name="happy-outline" size={23} color={NEON.orange} /></TouchableOpacity>
        <TouchableOpacity onPress={() => pickMedia(false)}><Ionicons name="image-outline" size={23} color={c.text} /></TouchableOpacity>
        <TouchableOpacity onPress={() => sendMsg()}><GlossyIcon name="send" size={17} boxSize={36} active accent={NEON.purple} /></TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 48, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  av: { width: 38, height: 38, borderRadius: 19 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', position: 'absolute', right: 0, bottom: 0, borderWidth: 2 },
  hIcon: { padding: 6 }, miniAv: { width: 24, height: 24, borderRadius: 12 },
  bubble: { maxWidth: 240, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  media: { width: 200, height: 210, borderRadius: 12, marginBottom: 4 },
  fwdBtn: { padding: 6 },
  reactBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginHorizontal: 18, marginBottom: 8, paddingVertical: 8, borderRadius: 24, borderWidth: 1 },
  stickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 10, borderTopWidth: 0.5 },
  stPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  inpBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 0.5 },
  inp: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14 },
});
