import React, { useEffect, useState } from 'react';
import { Modal, View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config';
import { BRAND } from './theme';

export function NotificationModal({ visible, onClose, c }: any) {
  const router = useRouter();
  const uid = auth.currentUser?.uid || '';
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<'all' | 'follow' | 'like' | 'comment' | 'repost'>('all');

  useEffect(() => {
    if (!uid || !visible) return;
    return onSnapshot(query(collection(db, 'notifications'), where('toUid', '==', uid)), (s) => {
      const l = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      l.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(l);
    });
  }, [uid, visible]);

  const shown = tab === 'all' ? items : items.filter((i) => i.type === tab);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 46 }}>
        <View style={s.hdr}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>Notifications</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 14, paddingBottom: 10 }}>
          {(['all', 'follow', 'like', 'comment', 'repost'] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.chip, { backgroundColor: tab === t ? BRAND : c.input }]}>
              <Text style={{ color: tab === t ? '#fff' : c.text, fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FlatList data={shown} keyExtractor={(i) => i.id} ListEmptyComponent={<Text style={{ textAlign: 'center', color: c.muted, marginTop: 40 }}>No notifications yet</Text>} renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => { updateDoc(doc(db, 'notifications', item.id), { read: true }).catch(() => {}); if (item.fromUid) { onClose(); router.push(`/user/${item.fromUid}` as any); } }}>
            <Ionicons name={item.type === 'like' ? 'heart' : item.type === 'repost' ? 'repeat' : item.type === 'comment' ? 'chatbubble' : 'person-add'} size={20} color={item.type === 'like' ? '#EF4444' : BRAND} />
            <View style={{ flex: 1, marginLeft: 12 }}><Text style={{ color: c.text }}><Text style={{ fontWeight: '700' }}>@{item.fromUsername || 'user'}</Text> {item.message || item.type}</Text></View>
          </TouchableOpacity>
        )} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
});
