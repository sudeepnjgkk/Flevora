import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, FlatList, Image, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { useLang } from './i18n';
import { broadcastT, canViewChannel, getChannelRole, joinChannelIdempotent } from './broadcastCapabilities';
import { CreateChannelModal } from './BroadcastModals';
import { BroadcastRoomModal } from './BroadcastRoomModal';

export function BroadcastChannelsHub({ visible, myUid, me, allUsers = [], onClose }: any) {
  const { c } = useTheme();
  const { lang } = useLang();
  const L = broadcastT(lang);

  const [tab, setTab] = useState<'joined' | 'discover'>('joined');
  const [joined, setJoined] = useState<any[]>([]);
  const [discover, setDiscover] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [showInviteInp, setShowInviteInp] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [activeCh, setActiveCh] = useState<any>(null);

  useEffect(() => {
    if (!visible || !myUid) return;
    setLoading(true);
    const u1 = onSnapshot(query(collection(db, 'channels'), where('members', 'array-contains', myUid)), (s) => {
      setJoined(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((ch: any) => ch.status !== 'deleted').sort((a: any, b: any) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0)));
      setLoading(false);
    }, () => setLoading(false));
    const u2 = onSnapshot(query(collection(db, 'channels'), where('visibility', '==', 'public')), (s) => {
      setDiscover(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((ch: any) => canViewChannel(ch, myUid, me)));
    }, () => {});
    return () => { u1(); u2(); };
  }, [visible, myUid]);

  const joinByCode = async () => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    const sn = await getDocs(query(collection(db, 'channels'), where('inviteCode', '==', code)));
    if (sn.empty) return Alert.alert('Invalid Code', 'No channel found with this invite code.');
    const ch: any = { id: sn.docs[0].id, ...sn.docs[0].data() };
    if (!ch.inviteActive || ch.status === 'deleted') return Alert.alert('Expired', 'This invite link is no longer active.');
    await joinChannelIdempotent(ch, myUid);
    setInviteCode(''); setShowInviteInp(false); setActiveCh(ch);
  };

  const list = (tab === 'joined' ? joined : discover).filter((ch) => {
    const s = q.trim().toLowerCase();
    return !s || (ch.name || '').toLowerCase().includes(s) || (ch.description || '').toLowerCase().includes(s) || (ch.ownerUsername || '').toLowerCase().includes(s);
  });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[s.title, { color: c.text }]}>{L.channels}</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => setShowInviteInp((v) => !v)}><Ionicons name="key-outline" size={22} color={c.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => setCreateOpen(true)}><Ionicons name="add-circle-outline" size={25} color={BRAND} /></TouchableOpacity>
          </View>
        </View>

        {showInviteInp && (
          <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
            <TextInput value={inviteCode} onChangeText={setInviteCode} placeholder="Enter invite code..." placeholderTextColor={c.muted} autoCapitalize="characters" style={[s.inp, { flex: 1, backgroundColor: c.input, color: c.text }]} />
            <TouchableOpacity onPress={joinByCode} style={{ backgroundColor: BRAND, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10 }}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>{L.join}</Text></TouchableOpacity>
          </View>
        )}

        <View style={{ paddingHorizontal: 12, paddingTop: 10 }}>
          <TextInput value={q} onChangeText={setQ} placeholder="Search channels..." placeholderTextColor={c.muted} style={[s.inp, { backgroundColor: c.input, color: c.text }]} />
        </View>

        <View style={s.tabs}>
          {(['joined', 'discover'] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.pill, { backgroundColor: tab === t ? BRAND : c.card }]}>
              <Text style={{ color: tab === t ? BRAND_TEXT : c.text, fontWeight: '800' }}>{L[t]}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={BRAND} /> : (
          <FlatList
            data={list}
            keyExtractor={(i) => i.id}
            ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No channels yet. Tap + to create one!</Text>}
            renderItem={({ item }) => {
              const role = getChannelRole(item, myUid);
              const isMem = role !== 'none';
              return (
                <TouchableOpacity style={[s.row, { borderBottomColor: c.border }]} onPress={() => setActiveCh(item)}>
                  {item.avatarUrl ? <Image source={{ uri: item.avatarUrl }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="megaphone" size={22} color={BRAND_TEXT} /></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{item.name} {item.visibility === 'private' ? '🔒' : ''}</Text>
                    <Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>{item.lastMessage || item.description || `@${item.ownerUsername}`}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={async () => { if (!isMem) await joinChannelIdempotent(item, myUid); setActiveCh(item); }}
                    style={{ backgroundColor: isMem ? c.input : BRAND, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12 }}
                  >
                    <Text style={{ color: isMem ? c.text : BRAND_TEXT, fontWeight: '800', fontSize: 12 }}>{isMem ? L.open : L.join}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              );
            }}
          />
        )}

        <CreateChannelModal visible={createOpen} myUid={myUid} me={me} onCreated={(ch: any) => setActiveCh(ch)} onClose={() => setCreateOpen(false)} />
        <BroadcastRoomModal visible={!!activeCh} channel={activeCh} myUid={myUid} me={me} allUsers={allUsers} onClose={() => setActiveCh(null)} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 46 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 17, fontWeight: '800' },
  inp: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  tabs: { flexDirection: 'row', gap: 8, padding: 12 },
  pill: { flex: 1, paddingVertical: 9, borderRadius: 12, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 0.5 },
  av: { width: 48, height: 48, borderRadius: 24 },
});
