import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, TextInput, FlatList, StyleSheet, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, addDoc, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND } from './theme';

export function ShareModal({ visible, post, onClose }: { visible?: boolean; post: any | null; onClose: () => void }) {
  const { c } = useTheme();
  const uid = auth.currentUser?.uid || '';
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [msg, setMsg] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!post && !visible) return;
    setSelected([]); setMsg('');
    return onSnapshot(collection(db, 'users'), (s) => {
      setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== uid));
    });
  }, [post, visible, uid]);

  const toggleUser = (id: string) => {
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const handleSend = async () => {
    if (!uid || !post || !selected.length || sending) return;
    setSending(true);
    const note = msg.trim();
    for (const targetUid of selected) {
      const chatId = [uid, targetUid].sort().join('_');
      await setDoc(doc(db, 'conversations', chatId), {
        participants: [uid, targetUid], updatedAt: serverTimestamp(), lastMessage: note || 'Shared a post',
      }, { merge: true }).catch(() => {});
      if (note) {
        await addDoc(collection(db, 'conversations', chatId, 'messages'), {
          senderUid: uid, text: note, mediaUrl: '', mediaType: 'text', read: false, createdAt: serverTimestamp(),
        });
      }
      await addDoc(collection(db, 'conversations', chatId, 'messages'), {
        senderUid: uid, text: '', mediaUrl: post.mediaUrl || '', mediaType: post.mediaType || 'image', read: false, createdAt: serverTimestamp(),
      });
    }
    setSending(false);
    Alert.alert('Sent', `Shared with ${selected.length} ${selected.length === 1 ? 'person' : 'people'}!`);
    onClose();
  };

  const filtered = users.filter((u) => (u.username || '').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Modal visible={visible ?? !!post} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.card, { backgroundColor: c.background }]}>
          <View style={s.handle} />
          <View style={s.sRow}>
            <View style={[s.sBox, { backgroundColor: c.input }]}>
              <Ionicons name="search" size={18} color={c.muted} />
              <TextInput style={[s.inp, { color: c.text }]} placeholder="Search" placeholderTextColor={c.muted} value={q} onChangeText={setQ} />
            </View>
            <TouchableOpacity style={[s.extBtn, { backgroundColor: c.input }]} onPress={() => Share.share({ message: `${post?.caption || 'Check this on Flevora!'} ${post?.mediaUrl || ''}` })}>
              <Ionicons name="share-social-outline" size={20} color={c.text} />
            </TouchableOpacity>
          </View>

          <FlatList
            data={filtered} numColumns={3} keyExtractor={(i) => i.id}
            renderItem={({ item }) => {
              const isSel = selected.includes(item.id);
              const av = item.photoUrl || item.avatar;
              return (
                <TouchableOpacity style={s.user} onPress={() => toggleUser(item.id)}>
                  <View style={{ position: 'relative' }}>
                    {av ? <Image source={{ uri: av }} style={s.av} /> : <View style={[s.av, s.ph]}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>{(item.username || 'U')[0].toUpperCase()}</Text></View>}
                    {isSel && <View style={s.chk}><Ionicons name="checkmark" size={14} color="#fff" /></View>}
                  </View>
                  <Text style={{ color: c.text, fontSize: 12, marginTop: 5 }} numberOfLines={1}>{item.username}</Text>
                </TouchableOpacity>
              );
            }}
          />

          <View style={[s.footer, { borderTopColor: c.border }]}>
            <TextInput value={msg} onChangeText={setMsg} placeholder="Write a message..." placeholderTextColor={c.muted} style={[s.msgInp, { color: c.text }]} />
            <TouchableOpacity disabled={!selected.length || sending} onPress={handleSend} style={[s.sendBtn, { backgroundColor: selected.length ? '#4F46E5' : '#9CA3AF' }]}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{sending ? 'Sending...' : selected.length > 1 ? `Send (${selected.length})` : 'Send'}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card: { height: '72%', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 18 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 12 },
  sRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  sBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 12, height: 40 },
  inp: { flex: 1, marginLeft: 8, fontSize: 14 },
  extBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  user: { width: '33.3%', alignItems: 'center', marginBottom: 16 },
  av: { width: 64, height: 64, borderRadius: 32 },
  ph: { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' },
  chk: { position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  footer: { borderTopWidth: 0.5, paddingTop: 10 },
  msgInp: { fontSize: 15, paddingHorizontal: 6, paddingVertical: 8, marginBottom: 8 },
  sendBtn: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
});
