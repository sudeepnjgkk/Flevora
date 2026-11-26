import React, { useEffect, useState } from 'react';
import { View, Text, Modal, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, NEON } from './theme';
import { GlossyIcon } from './GlossyIcon';

const META: Record<string, { icon: any; color: string }> = {
  like: { icon: 'heart', color: NEON.pink },
  comment: { icon: 'chatbubble', color: NEON.purple },
  follow: { icon: 'person-add', color: NEON.magenta },
  repost: { icon: 'repeat', color: NEON.orange },
  mention: { icon: 'at', color: NEON.purple },
};

export function NotificationModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const uid = auth.currentUser?.uid || '';
  const [items, setItems] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!uid || !visible) return;
    const u1 = onSnapshot(query(collection(db, 'notifications'), where('toUid', '==', uid), orderBy('createdAt', 'desc')), (s) => {
      setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
    const u2 = onSnapshot(collection(db, 'users'), (s) => {
      const m: Record<string, any> = {};
      s.docs.forEach((d) => { m[d.id] = d.data(); });
      setUsersMap(m);
    }, () => {});
    return () => { u1(); u2(); };
  }, [uid, visible]);

  const markAllRead = () => {
    items.filter((i) => !i.read).forEach((i) => updateDoc(doc(db, 'notifications', i.id), { read: true }).catch(() => {}));
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Notifications</Text>
          <TouchableOpacity onPress={markAllRead}><Text style={{ color: NEON.purple, fontWeight: '700', fontSize: 13 }}>Read all</Text></TouchableOpacity>
        </View>

        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 14, gap: 10 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 80 }}>
              <GlossyIcon name="notifications" size={26} boxSize={56} active accent={NEON.purple} />
              <Text style={{ color: c.muted, marginTop: 14, fontWeight: '600' }}>No notifications yet</Text>
            </View>
          }
          renderItem={({ item }) => {
            const u = usersMap[item.fromUid];
            const dp = u?.photoUrl || u?.avatar || '';
            const m = META[item.type] || { icon: 'notifications', color: NEON.purple };
            return (
              <TouchableOpacity
                style={[s.card, { backgroundColor: item.read ? c.card : `${NEON.purple}14`, borderColor: item.read ? c.border : NEON.purple }]}
                onPress={() => {
                  if (!item.read) updateDoc(doc(db, 'notifications', item.id), { read: true }).catch(() => {});
                  onClose();
                  if (item.fromUid) router.push(`/user/${

item.fromUid}` as any);
                }}
              >
                {dp ? <Image source={{ uri: dp }} style={s.av} /> : <GlossyIcon name={m.icon} size={18} boxSize={40} active accent={m.color} />}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontSize: 14 }}>
                    <Text style={{ fontWeight: '800' }}>@{item.fromUsername || u?.username || 'user'} </Text>
                    {item.message}
                  </Text>
                </View>
                {!item.read && <View style={s.dot} />}
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 0.5 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 16, borderWidth: 1 },
  av: { width: 42, height: 42, borderRadius: 21 },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: NEON.pink },
});
