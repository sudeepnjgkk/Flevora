import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, Image, TouchableOpacity, Modal, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, NEON } from '../constants/theme';
import { GlossyIcon } from '../constants/GlossyIcon';
import { SavedView } from '../constants/SavedView';

const W = (Dimensions.get('window').width - 30) / 3;

export default function ExploreScreen() {
  const router = useRouter();
  const { q: paramQ } = useLocalSearchParams<{ q?: string }>();
  const { c } = useTheme();
  const uid = auth.currentUser?.uid || '';
  const [search, setSearch] = useState(paramQ || '');
  const [tab, setTab] = useState<'all' | 'reels' | 'photos' | 'accounts'>('all');
  const [users, setUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc')), (s) => setPosts(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = uid ? onSnapshot(doc(db, 'users', uid), (s) => { if (s.exists()) setMe({ id: s.id, ...s.data() }); }) : () => {};
    return () => { u1(); u2(); u3(); };
  }, [uid]);

  const term = search.trim().toLowerCase();
  const matchedUsers = users.filter((u) => u.id !== uid && (!term || (u.username || '').toLowerCase().includes(term) || (u.fullName || '').toLowerCase().includes(term)));
  const matchedPosts = posts.filter((p) => {
    if (tab === 'reels' && p.mediaType !== 'video') return false;
    if (tab === 'photos' && p.mediaType === 'video') return false;
    if (!term) return true;
    return (p.caption || '').toLowerCase().includes(term) || (p.username || '').toLowerCase().includes(term);
  });

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.top}>
        <View style={[s.searchBox, { backgroundColor: c.input, borderColor: c.border }]}>
          <Ionicons name="search" size={18} color={NEON.purple} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search reels, people, tags..." placeholderTextColor={c.muted} style={{ flex: 1, color: c.text, fontSize: 14 }} />
          {!!search && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={c.muted} /></TouchableOpacity>}
        </View>
        <TouchableOpacity onPress={() => setShowSaved(true)}><GlossyIcon name="bookmark" size={18} boxSize={40} accent={NEON.magenta} /></TouchableOpacity>
      </View>

      <View style={s.tabs}>
        {(['all', 'reels', 'photos', 'accounts'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.pill, { backgroundColor: tab === t ? NEON.purple : c.card, borderColor: c.border }]}>
            <Text style={{ color: tab === t ? '#fff' : c.text, fontWeight: '700', fontSize: 12 }}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'accounts' ? (
        <FlatList data={matchedUsers} keyExtractor={(u) => u.id} renderItem={({ item }) => (
          <TouchableOpacity style={s.uRow} onPress={() => router.push(`/user/${item.id}` as any)}>
            {item.photoUrl || item.avatar ? <Image source={{ uri: item.photoUrl || item.avatar }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={20} color="#fff" /></View>}
            <View><Text style={{ color: c.text, fontWeight: '800' }}>@{item.username}</Text>{!!item.fullName && <Text style={{ color: c.muted, fontSize: 12 }}>{item.fullName}</Text>}</View>
          </TouchableOpacity>
        )} />
      ) : (
        <FlatList
          numColumns={3}
          data={matchedPosts}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 10, gap: 4 }}
          columnWrapperStyle={{ gap: 4 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.tile, { backgroundColor: c.card }]} onPress={() => (item.mediaType === 'video' ? router.push(`/reels?startId=${item.id}` as any) : router.push(`/user/${item.uid}` as any))}>
              <Image source={{ uri: item.mediaUrl }} style={s.thumb} resizeMode="cover" />
              {item.mediaType === 'video' && (
                <View style={s.vBadge}><Ionicons name="play" size={12} color="#fff" /><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{item.views || 0}</Text></View>
              )}
            </TouchableOpacity>
          )}
        />
      )}

      <Modal visible={showSaved} animationType="slide" onRequestClose={() => setShowSaved(false)}>
        <SavedView me={me} posts={posts} onClose={() => setShowSaved(false)} />
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 48, paddingHorizontal: 14, paddingBottom: 10 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, borderRadius: 14, borderWidth: 1, paddingHorizontal: 12 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginBottom: 10 },
  pill: { flex: 1, paddingVertical: 7, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  uRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  av: { width: 44, height: 44, borderRadius: 22 },
  tile: { width: W, height: W * 1.25, borderRadius: 10, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  vBadge: { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
});
