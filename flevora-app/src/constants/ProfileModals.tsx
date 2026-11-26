import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, Image, StyleSheet, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND } from './theme';
import UploadScreen from '../app/upload';

const CREATE_ITEMS = [
  { key: 'REEL', label: 'Reel', sub: 'Short vertical video', icon: 'film', color: '#EC4899' },
  { key: 'POST', label: 'Post', sub: 'Photo or video feed post', icon: 'grid', color: '#8B5CF6' },
  { key: 'STORY', label: 'Story', sub: '24-hour photo or video', icon: 'add-circle', color: '#3B82F6' },
  { key: 'HIGHLIGHT', label: 'Highlights', sub: 'Save past stories to profile', icon: 'heart-circle', color: '#F59E0B' },
  { key: 'LIVE', label: 'Live', sub: 'Broadcast to followers', icon: 'radio', color: '#EF4444' },
  { key: 'EDITS', label: 'Edits', sub: 'Create & edit video reel', icon: 'cut', color: '#10B981' },
  { key: 'AD', label: 'Ad', sub: 'View reach & insights', icon: 'trending-up', color: '#06B6D4' },
  { key: 'CHANNEL', label: 'Channel', sub: 'Open chats & messages', icon: 'chatbubbles', color: '#6366F1' },
];

export function CreateMenuModal({ visible, onClose, onCreateHighlight }: { visible: boolean; onClose: () => void; onCreateHighlight?: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const [uploadMode, setUploadMode] = useState<'POST' | 'STORY' | 'REEL' | 'LIVE' | null>(null);

  const handleTap = (key: string) => {
    onClose();
    if (key === 'POST' || key === 'STORY' || key === 'REEL' || key === 'LIVE') setUploadMode(key);
    else if (key === 'EDITS') setUploadMode('REEL');
    else if (key === 'HIGHLIGHT') onCreateHighlight ? onCreateHighlight() : Alert.alert('Highlights', 'Profile me "+ New" circle par tap karke highlight banao.');
    else if (key === 'AD') Alert.alert('Creator Insights', 'Profile me "Your dashboard" par tap karke insights dekho.');
    else if (key === 'CHANNEL') router.navigate('/messages' as any);
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
          <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card }]}>
            <View style={s.handle} />
            <Text style={[s.title, { color: c.text }]}>Create</Text>
            {CREATE_ITEMS.map((it) => (
              <TouchableOpacity key={it.key} style={s.row} onPress={() => handleTap(it.key)}>
                <View style={[s.iconBox, { backgroundColor: `${it.color}20` }]}>
                  <Ionicons name={it.icon as any} size={22} color={it.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{it.label}</Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>{it.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </TouchableOpacity>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
      <Modal visible={!!uploadMode} animationType="slide" onRequestClose={() => setUploadMode(null)}>
        <UploadScreen initialMode={uploadMode || 'POST'} onClose={() => setUploadMode(null)} />
      </Modal>
    </>
  );
}

export function AccountSwitcherModal({ visible, onClose, me }: { visible: boolean; onClose: () => void; me: any }) {
  const { c } = useTheme();
  const dp = me?.photoUrl || me?.avatar || '';
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          <View style={s.row}>
            {dp ? <Image source={{ uri: dp }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={20} color="#fff" /></View>}
            <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{me?.username || 'user'}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Active account</Text></View>
            <Ionicons name="checkmark-circle" size={24} color={BRAND} />
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function FollowersModal({ visible, title, uids, onClose }: { visible: boolean; title: string; uids: string[]; onClose: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  useEffect(() => {
    if (!visible || !uids?.length) return setList([]);
    Promise.all(uids.slice(0, 60).map((id) => getDoc(doc(db, 'users', id)).then((d) => (d.exists() ? { id: d.id, ...d.data() } : null)).catch(() => null))).then((r) => setList(r.filter(Boolean)));
  }, [visible, uids?.length]);
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card, maxHeight: '70%' }]}>
          <View style={s.handle} />
          <Text style={[s.title, { color: c.text }]}>{title}</Text>
          <FlatList data={list} keyExtractor={(i) => i.id} ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', padding: 20 }}>No users yet</Text>} renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => { onClose(); router.push(`/user/${item.id}` as any); }}>
              {item.photoUrl || item.avatar ? <Image source={{ uri: item.photoUrl || item.avatar }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={18} color="#fff" /></View>}
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>@{item.username}</Text>{!!item.name && <Text style={{ color: c.muted, fontSize: 12 }}>{item.name}</Text>}</View>
            </TouchableOpacity>
          )} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function ShareProfileModal({ visible, onClose, me }: { visible: boolean; onClose: () => void; me: any }) {
  const { c } = useTheme();
  const url = `https://flevora.app/u/${me?.username || 'user'}`;
  const qr = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(url)}`;
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.qrBg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.qrCard, { backgroundColor: c.card }]}>
          <Image source={{ uri: qr }} style={{ width: 200, height: 200, borderRadius: 12 }} />
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 18, marginTop: 12 }}>@{me?.username || 'user'}</Text>
          <TouchableOpacity onPress={() => Share.share({ message: `Follow @${me?.username} on Flevora: ${url}` })} style={s.shareBtn}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Share Profile</Text>
          </TouchableOpacity>
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
  av: { width: 42, height: 42, borderRadius: 21 },
  qrBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  qrCard: { borderRadius: 22, padding: 24, alignItems: 'center', width: '100%' },
  shareBtn: { marginTop: 14, backgroundColor: BRAND, paddingHorizontal: 24, paddingVertical: 11, borderRadius: 22 },
});
