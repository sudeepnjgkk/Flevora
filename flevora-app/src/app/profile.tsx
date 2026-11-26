import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, Modal, StyleSheet, Alert, Linking, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, collection, query, where, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, NEON } from '../constants/theme';
import { GlossyIcon } from '../constants/GlossyIcon';
import { HighlightsRow } from '../constants/HighlightsRow';
import { AccountSwitcherModal } from '../constants/DmModals';
import { StoryCreatorModal } from '../constants/StoryCreatorModal';
import { CreateMenuModal, FollowersModal, ShareQrModal, DraftsModal } from '../constants/ProfileModals';
import { EditProfileModal } from '../constants/EditProfileModal';
import { DashboardModal } from '../constants/DashboardModal';
import SettingsScreen from './settings';
import UploadScreen from './upload';

const W = (Dimensions.get('window').width - 28) / 3;
const thumb = (p: any) => (p?.mediaType === 'video' && p?.mediaUrl ? p.mediaUrl.replace(/\.[^/.]+$/, '.jpg') : p?.mediaUrl);

export default function ProfileScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const uid = auth.currentUser?.uid || '';
  const [user, setUser] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [tab, setTab] = useState<'posts' | 'reels' | 'reposts' | 'collab'>('posts');
  const [uploadMode, setUploadMode] = useState<'POST' | 'REEL' | null>(null);
  const [m, setM] = useState({ create: false, acc: false, edit: false, qr: false, dash: false, drafts: false, story: false, settings: false, follow: '' as '' | 'followers' | 'following' });

  useEffect(() => {
    if (!uid) return;
    AsyncStorage.getItem('flevora_accounts').then((r) => r && setAccounts(JSON.parse(r)));
    AsyncStorage.getItem('flevora_drafts').then((r) => r && setDrafts(JSON.parse(r)));
    const u1 = onSnapshot(doc(db, 'users', uid), (s) => s.exists() && setUser(s.data()));
    const u2 = onSnapshot(collection(db, 'users'), (s) => setAllUsers(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u3 = onSnapshot(query(collection(db, 'posts'), where('uid', '==', uid)), (s) => {
      const list = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMyPosts(list);
    });
    const u4 = onSnapshot(collection(db, 'posts'), (s) => setAllPosts(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); };
  }, [uid]);

  const pickAvatar = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (res.canceled || !res.assets[0]) return;
    const data = new FormData();
    data.append('file', { uri: res.assets[0].uri, type: 'image/jpeg', name: `av_${uid}.jpg` } as any);
    data.append('upload_preset', 'flevora_upload');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://api.cloudinary.com/v1_1/faqfo0lu/image/upload');
    xhr.onload = () => { const j = JSON.parse(xhr.responseText); if (j.secure_url) updateDoc(doc(db, 'users', uid), { photoUrl: j.secure_url, avatar: j.secure_url }); };
    xhr.send(data);
  };

  const handleDraftAction = (id: string, act: string) => {
    let next = [...drafts];
    if (act === 'Delete') next = next.filter((d) => d.id !== id);
    if (act === 'Duplicate') { const f = next.find((d) => d.id === id); if (f) next.unshift({ ...f, id: `dr_${Date.now()}`, title: `${f.title || 'Draft'} copy` }); }
    if (act === 'Pin') next = next.map((d) => d.id === id ? { ...d, pinned: !d.pinned } : d);
    if (act === 'Rename') next = next.map((d) => d.id === id ? { ...d, title: `Reel ${new Date().toLocaleTimeString()}` } : d);
    if (act === 'Open in Edits') setUploadMode('REEL');
    setDrafts(next); AsyncStorage.setItem('flevora_drafts', JSON.stringify(next));
  };

  const uname = (user?.username || '').toLowerCase();
  const list = tab === 'posts' ? myPosts
    : tab === 'reels' ? myPosts.filter((p) => p.mediaType === 'video')
    : tab === 'reposts' ? allPosts.filter((p) => (p.reposts || []).includes(uid))
    : allPosts.filter((p) => (p.taggedUsers || []).includes(uname) || (p.collabs || []).includes(uid));

  const av = user?.photoUrl || user?.avatar;
  const noteTxt = typeof user?.note === 'string' ? user.note : (user?.note?.text || user?.note?.music?.title || '');

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.topBar}>
        <TouchableOpacity onPress={() => setM({ ...m, create: true })}><GlossyIcon name="add" size={20} boxSize={36} accent={NEON.purple} /></TouchableOpacity>
        <TouchableOpacity style={s.drop} onPress={() => setM({ ...m, acc: true })}><Text style={[s.uname, { color: c.text }]}>{user?.username || 'profile'}</Text><Ionicons name="chevron-down" size={16} color={c.text} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setM({ ...m, settings: true })}><GlossyIcon name="menu" size={20} boxSize={36} accent={NEON.pink} /></TouchableOpacity>
      </View>

      <FlatList
        data={list} numColumns={3} keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        columnWrapperStyle={{ paddingHorizontal: 10, gap: 4, marginBottom: 4 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 }}>
              <TouchableOpacity onPress={() => setM({ ...m, story: true })} style={s.avRing}>
                {!!noteTxt && <View style={[s.noteBbl, { backgroundColor: c.card, borderColor: c.border }]}><Text style={{ fontSize: 10, fontWeight: '700', color: c.text }} numberOfLines={1}>{noteTxt}</Text></View>}
                {av ? <Image source={{ uri: av }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={34} color="#fff" /></View>}
                <View style={[s.plusBadge, { borderColor: c.background }]}><Ionicons name="add" size={14} color="#fff" /></View>
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: c.text }}>{user?.fullName || user?.name || user?.username}</Text>
                  {user?.isVerified && <Ionicons name="checkmark-circle" size={16} color={NEON.purple} />}
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingRight: 10 }}>
                  <View><Text style={[s.cnt, { color: c.text }]}>{myPosts.length}</Text><Text style={{ fontSize: 12, color: c.muted }}>posts</Text></View>
                  <TouchableOpacity onPress={() => setM({ ...m, follow: 'followers' })}><Text style={[s.cnt, { color: c.text }]}>{(user?.followers || []).length}</Text><Text style={{ fontSize: 12, color: c.muted }}>followers</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setM({ ...m, follow: 'following' })}><Text style={[s.cnt, { color: c.text }]}>{(user?.following || []).length}</Text><Text style={{ fontSize: 12, color: c.muted }}>following</Text></TouchableOpacity>
                </View>
              </View>
            </View>

            {!!user?.category && <Text style={{ color: NEON.purple, fontSize: 12, fontWeight: '700', marginTop: 10 }}>{user.category}</Text>}
            {!!user?.bio && <Text style={{ color: c.text, fontSize: 13, marginTop: 3 }}>{user.bio}</Text>}
            {!!user?.website && <TouchableOpacity onPress={() => Linking.openURL(user.website.startsWith('http') ? user.website : `https://${user.website}`)}><Text style={{ color: NEON.pink, fontSize: 13, fontWeight: '600', marginTop: 3 }}>{user.website}</Text></TouchableOpacity>}

            {user?.proDashboard !== false && (
              <TouchableOpacity style={[s.dashCard, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => setM({ ...m, dash: true })}>
                <View><Text style={{ fontWeight: '800', color: c.text }}>Your dashboard</Text><Text style={{ fontSize: 12, color: c.muted }}>Insights and creator tools</Text></View>
                <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: NEON.pink }} />
              </TouchableOpacity>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginVertical: 12 }}>
              <TouchableOpacity style={[s.actBtn, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => setM({ ...m, edit: true })}><Text style={{ fontWeight: '700', color: c.text }}>Edit profile</Text></TouchableOpacity>
              <TouchableOpacity style={[s.actBtn, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => setM({ ...m, qr: true })}><Text style={{ fontWeight: '700', color: c.text }}>Share profile</Text></TouchableOpacity>
            </View>

            <HighlightsRow {...({ uid, user, isOwn: true, isOwner: true, highlights: user?.highlights || [], c } as any)} />

            <View style={[s.gridTabs, { borderTopColor: c.border }]}>
              {([['posts', 'grid'], ['reels', 'film'], ['reposts', 'repeat'], ['collab', 'person']] as const).map(([k, ic]) => (
                <TouchableOpacity key={k} style={[s.gTab, tab === k && { borderBottomWidth: 2.5, borderColor: NEON.purple }]} onPress={() => setTab(k)}>
                  <Ionicons name={(tab === k ? ic : `${ic}-outline`) as any} size={22} color={tab === k ? NEON.purple : c.muted} />
                </TouchableOpacity>
              ))}
            </View>

            {tab === 'reels' && drafts.length > 0 && (
              <TouchableOpacity style={[s.draftBar, { backgroundColor: c.card, borderColor: c.border }]} onPress={() => setM({ ...m, drafts: true })}>
                <Ionicons name="albums-outline" size={18} color={NEON.purple} />
                <Text style={{ flex: 1, marginLeft: 8, fontWeight: '700', color: c.text }}>Drafts ({drafts.length})</Text>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={s.tile} onPress={() => router.push(`/reels?startId=${item.id}` as any)} onLongPress={() => item.uid === uid && Alert.alert('Delete', 'Remove post?', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: () => deleteDoc(doc(db, 'posts', item.id)) }])}>
            <Image source={{ uri: thumb(item) }} style={{ width: '100%', height: '100%' }} />
            {item.mediaType === 'video' && <Ionicons name="play-circle" size={18} color="#fff" style={{ position: 'absolute', top: 6, right: 6 }} />}
          </TouchableOpacity>
        )}
      />

      <CreateMenuModal visible={m.create} onClose={() => setM({ ...m, create: false })} c={c} onSelect={(k: string) => {
        if (k === 'story') setM({ ...m, create: false, story: true });
        else if (k === 'reel' || k === 'edits') setUploadMode('REEL');
        else if (k === 'post') setUploadMode('POST');
        else Alert.alert(k.toUpperCase(), k === 'live' ? 'Live streaming Spark free tier par available nahi hai.' : 'Coming soon!');
      }} />
      <Modal visible={!!uploadMode} animationType="slide" onRequestClose={() => setUploadMode(null)}><UploadScreen initialMode={uploadMode || 'POST'} onClose={() => setUploadMode(null)} /></Modal>
      <AccountSwitcherModal visible={m.acc} onClose={() => setM({ ...m, acc: false })} accounts={accounts} currentUid={uid} onAddAccount={() => signOut(auth)} c={c} />
      <EditProfileModal visible={m.edit} onClose={() => setM({ ...m, edit: false })} uid={uid} user={user} onPickAvatar={pickAvatar} c={c} />
      <ShareQrModal visible={m.qr} onClose={() => setM({ ...m, qr: false })} uid={uid} username={user?.username} />
      <DashboardModal visible={m.dash} onClose={() => setM({ ...m, dash: false })} uid={uid} user={user} posts={myPosts} onOpenSettings={() => setM({ ...m, dash: false, settings: true })} c={c} />
      <DraftsModal visible={m.drafts} onClose={() => setM({ ...m, drafts: false })} drafts={drafts} onEdit={() => setUploadMode('REEL')} onAction={handleDraftAction} c={c} />
      <StoryCreatorModal {...({ visible: m.story, onClose: () => setM({ ...m, story: false }), uid, myUid: uid, me: user, user, c } as any)} />
      {!!m.follow && <FollowersModal visible={!!m.follow} onClose={() => setM({ ...m, follow: '' })} initialTab={m.follow} user={user} allUsers={allUsers} c={c} onOpenUser={(id: string) => router.push(`/user/${id}` as any)} onMessage={(u: any) => router.push({ pathname: '/messages', params: { uid: u.id, name: u.username } } as any)} onFollowToggle={(id: string) => updateDoc(doc(db, 'users', uid), { following: arrayUnion(id) })} onRemoveFollower={(id: string) => updateDoc(doc(db, 'users', uid), { followers: arrayRemove(id) })} />}
      <Modal visible={m.settings} animationType="slide" onRequestClose={() => setM({ ...m, settings: false })}><SettingsScreen onClose={() => setM({ ...m, settings: false })} /></Modal>
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingBottom: 10, paddingHorizontal: 16 },
  drop: { flexDirection: 'row', alignItems: 'center', gap: 4 }, uname: { fontSize: 19, fontWeight: '800' },
  avRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 2.5, borderColor: NEON.magenta, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  av: { width: 80, height: 80, borderRadius: 40 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  noteBbl: { position: 'absolute', top: -16, left: 6, zIndex: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1, elevation: 2 },
  plusBadge: { position: 'absolute', right: 0, bottom: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: NEON.pink, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  cnt: { fontSize: 17, fontWeight: '800' },
  dashCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 13, borderRadius: 16, borderWidth: 1, marginTop: 14 },
  actBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  gridTabs: { flexDirection: 'row', marginTop: 10, borderTopWidth: 0.5 },
  gTab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  draftBar: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, marginVertical: 8 },
  tile: { width: W, height: W * 1.25, borderRadius: 10, overflow: 'hidden' },
});
