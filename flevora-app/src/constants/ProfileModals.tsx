import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, Image, StyleSheet, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND, NEON } from './theme';

const CREATE_ITEMS = [
  { key: 'post', label: 'Post', sub: 'Share single or multiple photos to your feed', icon: 'images-outline', color: NEON.purple },
  { key: 'reel', label: 'Reel', sub: 'Upload short vertical video with cover & audio', icon: 'film-outline', color: NEON.pink },
  { key: 'story', label: 'Story', sub: '24-hour photo or video with text & stickers', icon: 'add-circle-outline', color: '#3B82F6' },
  { key: 'live', label: 'Live', sub: 'Live stream setup & broadcast check', icon: 'radio-outline', color: '#EF4444' },
];

export function CreateMenuModal({ visible, onClose, onSelect, c }: any) {
  const { c: tc } = useTheme();
  const th = c || tc;
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: th.card }]}>
          <View style={s.handle} />
          <Text style={[s.title, { color: th.text }]}>Create</Text>
          {CREATE_ITEMS.map((it) => (
            <TouchableOpacity key={it.key} style={s.row} onPress={() => { onClose(); onSelect?.(it.key); }}>
              <View style={[s.iconBox, { backgroundColor: `${it.color}1E` }]}>
                <Ionicons name={it.icon as any} size={22} color={it.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: th.text, fontWeight: '700', fontSize: 15 }}>{it.label}</Text>
                <Text style={{ color: th.muted, fontSize: 12 }}>{it.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={th.muted} />
            </TouchableOpacity>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function FollowersModal({ visible, onClose, initialTab, user, allUsers, onOpenUser }: any) {
  const { c } = useTheme();
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab || 'followers');
  useEffect(() => { if (initialTab) setTab(initialTab); }, [initialTab]);
  const ids: string[] = tab === 'followers' ? (user?.followers || []) : (user?.following || []);
  const list = (allUsers || []).filter((u: any) => ids.includes(u.id));
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card, maxHeight: '72%' }]}>
          <View style={s.handle} />
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            {(['followers', 'following'] as const).map((t) => (
              <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.tabBtn, { backgroundColor: tab === t ? NEON.purple : c.surface }]}>
                <Text style={{ color: tab === t ? '#fff' : c.text, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <FlatList data={list} keyExtractor={(i) => i.id} ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', padding: 20 }}>No users</Text>} renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => { onClose(); onOpenUser?.(item.id); }}>
              {item.photoUrl

 || item.avatar ? <Image source={{ uri: item.photoUrl || item.avatar }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={18} color="#fff" /></View>}
              <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>@{item.username}</Text>
            </TouchableOpacity>
          )} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function ShareQrModal({ visible, onClose, username }: any) {
  const { c } = useTheme();
  const url = `https://flevora.app/u/${username || 'user'}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.qrBg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.qrCard, { backgroundColor: c.card }]}>
          <Image source={{ uri: qr }} style={{ width: 200, height: 200, borderRadius: 14 }} />
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 18, marginTop: 12 }}>@{username || 'user'}</Text>
          <TouchableOpacity onPress={() => Share.share({ message: `Follow @${username} on Flevora: ${url}` })} style={s.shareBtn}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Share Profile</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function DraftsModal({ visible, onClose, drafts, onEdit, onAction }: any) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card, maxHeight: '65%' }]}>
          <View style={s.handle} />
          <Text style={[s.title, { color: c.text }]}>Drafts ({drafts?.length || 0})</Text>
          <FlatList data={drafts || []} keyExtractor={(d: any) => d.id} renderItem={({ item }) => (
            <View style={s.row}>
              <TouchableOpacity onPress={() => { onClose(); onEdit?.(); }} style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '700' }}>{item.title || 'Untitled Draft'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onAction?.(item.id, 'Delete')}><Ionicons name="trash-outline" size={20} color="#EF4444" /></TouchableOpacity>
            </View>
          )} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 28 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#888', alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  iconBox: { width: 42, height: 42, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  av: { width: 40, height: 40, borderRadius: 20 },
  qrBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  qrCard: { borderRadius: 22, padding: 24, alignItems: 'center', width: '100%' },
  shareBtn: { marginTop: 14, backgroundColor: BRAND, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 22 },
});
