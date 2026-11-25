import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, FlatList, Image, Switch, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { BRAND } from './theme';
import { sendPush } from './push';

const EMOJIS = ['❤️', '😮', '😭', '😂', '😍', '💔', '😔', '💯'];
const fmtV = (n: number) => (n >= 1000 ? n.toLocaleString() : String(n || 0));

export function RepostModal({ visible, onClose, item, uid, me, c }: any) {
  const [thought, setThought] = useState('');
  const [askThought, setAskThought] = useState(false);

  const sendThought = async (txt: string) => {
    const clean = txt.trim();
    if (!clean || !item?.id || !uid) return;
    await updateDoc(doc(db, 'posts', item.id), { [`repostThoughts.${uid}`]: clean }).catch(() => {});
    if (item.uid && item.uid !== uid) {
      await addDoc(collection(db, 'notifications'), {
        toUid: item.uid, fromUid: uid, fromUsername: me?.username || 'User',
        type: 'repost', message: `reposted your reel: "${clean}"`, postId: item.id, read: false, createdAt: serverTimestamp(),
      }).catch(() => {});
      if (item.expoPushToken) sendPush(item.expoPushToken, 'Reel Repost', `@${me?.username || 'Someone'} reposted: ${clean}`);
    }
    setThought(''); setAskThought(false); onClose();
    Alert.alert('Saved', 'Thought added & creator notified!');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <View style={[s.sheet, { backgroundColor: '#1F2937' }]}>
          <View style={s.handle} />
          <TouchableOpacity style={s.thoughtBtn} onPress={() => setAskThought(true)}>
            <Text style={{ color: '#fff', fontWeight: '600' }}>{item?.repostThoughts?.[uid] || 'Add a thought...'}</Text>
          </TouchableOpacity>
          {askThought && (
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TextInput value={thought} onChangeText={setThought} placeholder="Write a thought..." placeholderTextColor="#9CA3AF" style={s.inp} />
              <TouchableOpacity onPress={() => sendThought(thought)} style={s.sendBtn}><Text style={{ color: '#fff', fontWeight: '700' }}>Post</Text></TouchableOpacity>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12 }}>
            {EMOJIS.map((e) => <TouchableOpacity key={e} onPress={() => sendThought(e)}><Text style={{ fontSize: 26 }}>{e}</Text></TouchableOpacity>)}
          </View>
          <TouchableOpacity style={s.saveBtn} onPress={onClose}><Text style={{ color: '#111', fontWeight: '700', fontSize: 15 }}>Done</Text></TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function LikesPlaysModal({ visible, onClose, item, allUsers, myUid, myFollowing, onFollow, onOpenUser, c }: any) {
  const [q, setQ] = useState('');
  const likeIds: string[] = item?.likes || [];
  const likedUsers = allUsers.filter((u: any) => likeIds.includes(u.id) && (u.username || '').toLowerCase().includes(q.toLowerCase()));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <View style={[s.sheet, { backgroundColor: c.background, maxHeight: '78%' }]}>
          <View style={s.handle} />
          <Text style={{ fontSize: 16, fontWeight: '700', color: c.text, textAlign: 'center', marginBottom: 12 }}>Likes and plays</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginBottom: 12 }}>
            <Ionicons name="eye-outline" size={20} color={c.text} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: c.text }}>{fmtV(item?.views || 0)}</Text>
          </View>
          <TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={c.muted} style={[s.sInp, { backgroundColor: c.input, color: c.text }]} />
          <FlatList data={likedUsers} keyExtractor={(i) => i.id} ListEmptyComponent={<Text style={{ textAlign: 'center', color: c.muted, marginVertical: 24 }}>No likes yet</Text>} renderItem={({ item: u }) => {
            const isF = myFollowing.includes(u.id);
            return (
              <TouchableOpacity style={s.uRow} onPress={() => { onClose(); onOpenUser(u.id); }}>
                {u.photoUrl ? <Image source={{ uri: u.photoUrl }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={18} color="#fff" /></View>}
                <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', color: c.text }}>{u.username}</Text><Text style={{ fontSize: 12, color: c.muted }}>{u.fullName || u.name || ''}</Text></View>
                {u.id !== myUid && (
                  <TouchableOpacity style={[s.fBtn, { backgroundColor: isF ? c.input : '#3B82F6' }]} onPress={() => onFollow(u.id)}>
                    <Text style={{ color: isF ? c.text : '#fff', fontWeight: '700', fontSize: 12 }}>{isF ? 'Following' : 'Follow'}</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          }} />
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function ReelMenuModal({ visible, onClose, item, captions, setCaptions, fullscreen, setFullscreen, autoScroll, setAutoScroll, onReport, c }: any) {
  const [tab, setTab] = useState<'main' | 'playback'>('main');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { setTab('main'); onClose(); }}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={() => { setTab('main'); onClose(); }}>
        <View style={[s.sheet, { backgroundColor: c.background }]}>
          <View style={s.handle} />
          {tab === 'main' ? (
            <>
              <TouchableOpacity style={s.mRow} onPress={() => setTab('playback')}><Ionicons name="play-circle-outline" size={22} color={c.text} /><Text style={[s.mTxt, { color: c.text }]}>Playback</Text><Ionicons name="chevron-forward" size={18} color={c.muted} /></TouchableOpacity>
              <TouchableOpacity style={s.mRow} onPress={() => Alert.alert('About', `@${item?.username}\nAudio: ${item?.audioName || 'Original Audio'}`)}><Ionicons name="information-circle-outline" size={22} color={c.text} /><Text style={[s.mTxt, { color: c.text }]}>About this reel</Text></TouchableOpacity>
              <TouchableOpacity style={s.mRow} onPress={() => { onClose(); onReport(); }}><Ionicons name="alert-circle-outline" size={22} color="#EF4444" /><Text style={[s.mTxt, { color: '#EF4444' }]}>Report</Text></TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={s.mRow} onPress={() => setTab('main')}><Ionicons name="arrow-back" size={20} color={c.text} /><Text style={[s.mTxt, { color: c.text, fontWeight: '700' }]}>Playback</Text></TouchableOpacity>
              <View style={s.mRow}><Text style={[s.mTxt, { color: c.text }]}>View fullscreen</Text><Switch value={fullscreen} onValueChange={setFullscreen} /></View>
              <View style={s.mRow}><Text style={[s.mTxt, { color: c.text }]}>Auto scroll</Text><Switch value={autoScroll} onValueChange={setAutoScroll} /></View>
              <View style={s.mRow}><Text style={[s.mTxt, { color: c.text }]}>Closed Captions</Text><Switch value={captions} onValueChange={setCaptions} /></View>
            </>
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingBottom: 28, paddingTop: 10 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#9CA3AF', alignSelf: 'center', marginBottom: 14 },
  thoughtBtn: { backgroundColor: '#374151', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, alignSelf: 'center', marginBottom: 10 },
  inp: { flex: 1, backgroundColor: '#374151', color: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  sendBtn: { backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' },
  saveBtn: { backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  sInp: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 10 },
  uRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  av: { width: 42, height: 42, borderRadius: 21 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  fBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  mRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13 },
  mTxt: { flex: 1, fontSize: 15, fontWeight: '500', marginLeft: 12 },
});
