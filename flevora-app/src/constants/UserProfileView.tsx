import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ScrollView, StyleSheet, Alert, Share, Linking, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, onSnapshot, collection, query, where, updateDoc, addDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, NEON } from './theme';
import { sendPush } from './push';
import { GlossyIcon } from './GlossyIcon';
import { FollowersModal, ShareQrModal } from './ProfileModals';
import { StoryViewerModal } from './StoryViewerModal';
import { FollowingOptionsModal, MuteOptionsModal, UserMenuModal, UserNotifModal, SuggestedFullModal } from './UserProfileModals';

const W = (Dimensions.get('window').width - 28) / 3;
const thumb = (p: any) => (p?.mediaType === 'video' && p?.mediaUrl ? p.mediaUrl.replace(/\.[^/.]+$/, '.jpg') : p?.mediaUrl);
const fmtV = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n || 0));

export function UserProfileView({ id }: { id: string }) {
  const router = useRouter();
  const { c } = useTheme();
  const myUid = auth.currentUser?.uid || '';
  const [me, setMe] = useState<any>({});
  const [target, setTarget] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [allPosts, setAllPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [tab, setTab] = useState<'posts' | 'reels' | 'reposts' | 'collab'>('posts');
  const [showSug, setShowSug] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [m, setM] = useState({ following: false, mute: false, menu: false, notif: false, sugAll: false, qr: false, story: false, follow: '' as '' | 'followers' | 'following' });

  useEffect(() => {
    if (!id) return;
    const u1 = onSnapshot(doc(db, 'users', id), (s) => s.exists() && setTarget({ id: s.id, ...s.data() }));
    const u2 = myUid ? onSnapshot(doc(db, 'users', myUid), (s) => s.exists() && setMe(s.data())) : () => {};
    const u3 = onSnapshot(collection(db, 'users'), (s) => setAllUsers(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(query(collection(db, 'posts'), where('uid', '==', id)), (s) => {
      const l = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      l.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(l);
    });
    const u5 = onSnapshot(collection(db, 'posts'), (s) => setAllPosts(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u6 = onSnapshot(query(collection(db, 'stories'), where('uid', '==', id)), (s) => setStories(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); u5(); u6(); };
  }, [id, myUid]);

  const toggleFollow = async (tid = id) => {
    if (!myUid || !tid) return;
    const isF = (me.following || []).includes(tid);
    await updateDoc(doc(db, 'users', myUid), { following: isF ? arrayRemove(tid) : arrayUnion(tid) });
    await updateDoc(doc(db, 'users', tid), { followers: isF ? arrayRemove(myUid) : arrayUnion(myUid) });
    if (!isF && tid === id) {
      await addDoc(collection(db, 'notifications'), { toUid: id, fromUid: myUid, fromUsername: me.username || 'User', type: 'follow', createdAt: serverTimestamp() });
      if (target?.expoPushToken) sendPush(target.expoPushToken, 'New Follower', `@${me.username || 'Someone'} started following you`);
    }
  };

  const handleMenu = async (k: string) => {
    if (!myUid || !id) return;
    if (k === 'about') Alert.alert('About', `@${target?.username}\n${target?.category || 'Creator'}`);
    if (k === 'hideStory') await updateDoc(doc(db, 'users', myUid), { hiddenStoryFrom: (me.hiddenStoryFrom || []).includes(id) ? arrayRemove(id) : arrayUnion(id) });
    if (k === 'copy') Alert.alert('Profile URL', `flevora://user/${id}`);
    if (k === 'share') Share.share({ message: `flevora://user/${id}` });
    if (k === 'qr') setM({ ...m, qr: true });
    if (k === 'restrict') await updateDoc(doc(db, 'users', myUid), { restrictedUsers: (me.restrictedUsers || []).includes(id) ? arrayRemove(id) : arrayUnion(id) });
    if (k === 'block') await updateDoc(doc(db, 'users', myUid), { blockedUsers: (me.blockedUsers || []).includes(id) ? arrayRemove(id) : arrayUnion(id) });
    if (k === 'report') { await addDoc(collection(db, 'reports'), { targetUid: id, reporterUid: myUid, reason: 'Profile report', createdAt: serverTimestamp() }); Alert.alert('Reported', 'Admin will review.'); }
  };

  const isF = (me.following || []).includes(id);
  const sug = allUsers.filter((u) => u.id !== id && u.id !== myUid && !dismissed.includes(u.id));
  const uname = (target?.username || '').toLowerCase();
  const list = tab === 'posts' ? posts : tab === 'reels' ? posts.filter((p) => p.mediaType === 'video') : tab === 'reposts' ? allPosts.filter((p) => (p.reposts || []).includes(id)) : allPosts.filter((p) => (p.taggedUsers || []).includes(uname) || (p.collabs || []).includes(id));
  const av = target?.photoUrl || target?.avatar;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 14, gap: 5 }}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: c.text }}>{target?.username || 'Profile'}</Text>
          {target?.isVerified && <Ionicons name="checkmark-circle" size={16} color={NEON.purple} />}
        </View>
        {isF && <TouchableOpacity onPress={() => setM({ ...m, notif: true })} style={{ marginRight: 10 }}><GlossyIcon name="notifications" size={17} boxSize={34} accent={NEON.purple} /></TouchableOpacity>}
        <TouchableOpacity onPress={() => setM({ ...m, menu: true })}><GlossyIcon name="ellipsis-horizontal" size={17} boxSize={34} accent={NEON.pink} /></TouchableOpacity>
      </View>

      <FlatList
        data={list} numColumns={3} keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        columnWrapperStyle={{ paddingHorizontal: 10, gap: 4, marginBottom: 4 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 }}>
              <TouchableOpacity onPress={() => stories.length && setM({ ...m, story: true })} style={[s.ring, { borderColor: stories.length > 0 ? NEON.magenta : c.border, borderWidth: 2.5 }]}>
                {av

 ? <Image source={{ uri: av }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={32} color="#fff" /></View>}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: c.text, marginBottom: 8 }}>{target?.fullName || target?.name || target?.username}</Text>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingRight: 10 }}>
                  <View><Text style={[s.cnt, { color: c.text }]}>{posts.length}</Text><Text style={{ fontSize: 12, color: c.muted }}>posts</Text></View>
                  <TouchableOpacity onPress={() => setM({ ...m, follow: 'followers' })}><Text style={[s.cnt, { color: c.text }]}>{(target?.followers || []).length}</Text><Text style={{ fontSize: 12, color: c.muted }}>followers</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => setM({ ...m, follow: 'following' })}><Text style={[s.cnt, { color: c.text }]}>{(target?.following || []).length}</Text><Text style={{ fontSize: 12, color: c.muted }}>following</Text></TouchableOpacity>
                </View>
              </View>
            </View>
            {!!target?.category && <Text style={{ color: NEON.purple, fontSize: 12, fontWeight: '700', marginTop: 10 }}>{target.category}</Text>}
            {!!target?.bio && <Text style={{ color: c.text, fontSize: 13, marginTop: 3 }}>{target.bio}</Text>}
            {!!target?.website && <TouchableOpacity onPress={() => Linking.openURL(target.website.startsWith('http') ? target.website : `https://${target.website}`)}><Text style={{ color: NEON.pink, fontSize: 13, fontWeight: '600', marginTop: 3 }}>{target.website}</Text></TouchableOpacity>}
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 14 }}>
              <TouchableOpacity style={[s.actBtn, { backgroundColor: isF ? c.surface : NEON.purple, borderColor: isF ? c.border : NEON.purple }]} onPress={() => (isF ? setM({ ...m, following: true }) : toggleFollow())}><Text style={{ fontWeight: '800', color: isF ? c.text : '#fff' }}>{isF ? 'Following ⌄' : 'Follow'}</Text></TouchableOpacity>
              <TouchableOpacity style={[s.actBtn, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => router.push({ pathname: '/messages', params: { uid: id, name: target?.username } } as any)}><Text style={{ fontWeight: '800', color: c.text }}>Message</Text></TouchableOpacity>
              <TouchableOpacity style={[s.sugT, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => setShowSug((p) => !p)}><Ionicons name={showSug ? 'person-add' : 'person-add-outline'} size={18} color={NEON.purple} /></TouchableOpacity>
            </View>
            {showSug && (
              <View style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}><Text style={{ fontWeight: '800', color: c.text }}>Suggested for you</Text><TouchableOpacity onPress={() => setM({ ...m, sugAll: true })}><Text style={{ color: NEON.pink, fontWeight: '700' }}>See all</Text></TouchableOpacity></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {sug.slice(0, 10).map((u) => (
                    <TouchableOpacity key={u.id} style={[s.sugC, { borderColor: c.border, backgroundColor: c.card }]} onPress={() => router.push(`/user/${u.id}` as any)}>
                      <TouchableOpacity style={{ alignSelf: 'flex-end' }} onPress={() => setDismissed((p) => [...p, u.id])}><Ionicons name="close" size={16} color={c.muted} /></TouchableOpacity>
                      {u.photoUrl ? <Image source={{ uri: u.photoUrl }} style={s.sugAv} /> : <View style={[s.sugAv, s.ph]}><Ionicons name="person" size={24} color="#fff" /></View>}
                      <Text style={{ fontWeight: '700', color: c.text, marginTop: 6 }} numberOfLines={1}>{u.username}</Text>
                      <TouchableOpacity style={[s.sugB, { backgroundColor: (me.following || []).includes(u.id) ? c.surface : NEON.purple }]} onPress={() => toggleFollow(u.id)}><Text style={{ color: (me.following || []).includes(u.id) ? c.text : '#fff', fontWeight: '700', fontSize: 12 }}>{(me.following || []).includes(u.id) ? 'Following' : 'Follow'}</Text></TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={[s.gTabs, { borderTopColor: c.border }]}>
              {([['posts', 'grid'], ['reels', 'film'], ['reposts', 'repeat'], ['collab', 'person']] as const).map(([k, ic]) => (
                <TouchableOpacity key={k} style={[s.gTab, tab === k && { borderBottomWidth: 2.5, borderColor: NEON.purple }]} onPress={() => setTab(k)}>
                  <Ionicons name={(tab === k ? ic : `${ic}-outline`) as any} size={22} color={tab === k ? NEON.purple : c.muted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={s.tile} onPress={() => router.push(`/reels?startId=${item.id}` as any)}>
            <Image source={{ uri: thumb(item) }} style={{ width: '100%', height: '100%' }} />
            {item.mediaType === 'video' && <View style={s.vBadge}><Ionicons name="eye-outline" size={12} color="#fff" /><Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{fmtV(item.views || 0)}</Text></View>}
          </TouchableOpacity>
        )}
      />

      <FollowingOptionsModal visible={m.following} onClose={() => setM({ ...m, following: false })} username={target?.username} isCF={(me.closeFriends || []).includes(id)} isFav={(me.favorites || []).includes(id)} isRestr={(me.restrictedUsers || []).includes(id)} c={c} onToggleCF={() => updateDoc(doc(db, 'users', myUid), { closeFriends: (me.closeFriends || []).includes(id) ? arrayRemove(id) : arrayUnion(id) })} onToggleFav={() => updateDoc(doc(db, 'users', myUid), { favorites: (me.favorites || []).includes(id) ? arrayRemove(id) : arrayUnion(id) })} onOpenMute={() => setM({ ...m, following: false, mute: true })} onToggleRestr={() => handleMenu('restrict')} onUnfollow={() => toggleFollow()} />
      <MuteOptionsModal visible={m.mute} onClose={() => setM({ ...m, mute: false })} prefs={me?.mutedPrefs?.[id] || {}} c={c} onToggle={(k: string) => updateDoc(doc(db, 'users', myUid), { [`mutedPrefs.${id}.${k}`]: !me?.mutedPrefs?.[id]?.[k] })} />
      <UserMenuModal visible={m.menu} onClose={() => setM({ ...m, menu: false })} isHiddenStory={(me.hiddenStoryFrom || []).includes(id)} isRestr={(me.restrictedUsers || []).includes(id)} isBlocked={(me.blockedUsers || []).includes(id)} onAction={handleMenu} c={c} />
      <UserNotifModal visible={m.notif} onClose={() => setM({ ...m, notif: false })} username={target?.username} prefs={me?.notifPrefs?.[id] || {}} c={c} onSetPref={(k: string, v: string) => updateDoc(doc(db, 'users', myUid), { [`notifPrefs.${id}.${k}`]: v })} />
      <SuggestedFullModal visible={m.sugAll} onClose={() => setM({ ...m, sugAll: false })} username={target?.username} list={sug} myFollowing={me.following || []} onFollow={toggleFollow} onDismiss={(uid: string) => setDismissed((p) => [...p, uid])} onOpenUser={(uid: string) => router.push(`/user/${uid}` as any)} c={c} />
      <ShareQrModal visible={m.qr} onClose={() => setM({ ...m, qr: false })} uid={id} username={target?.username} />
      {m.story && <StoryViewerModal {...({ visible: m.story, onClose: () => setM({ ...m, story: false }), stories, initialIndex: 0, myUid, me, c } as any)} />}
      {!!m.follow && <FollowersModal visible={!!m.follow} onClose={() => setM({ ...m, follow: '' })} initialTab={m.follow} user={target} allUsers={allUsers} c={c} onOpenUser={(uid: string) => router.push(`/user/${uid}` as any)} onMessage={(u: any) => router.push({ pathname: '/messages', params: { uid: u.id, name: u.username } } as any)} onFollowToggle={(uid: string) => toggleFollow(uid)} onRemoveFollower={() => {}} />}
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { flexDirection: 'row', alignItems: 'center', paddingTop: 48, paddingBottom: 10, paddingHorizontal: 16 },
  ring: { padding: 3, borderRadius: 46 }, av: { width: 80, height: 80, borderRadius: 40 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  cnt: { fontSize: 17, fontWeight: '800' }, actBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14, borderWidth: 1 },
  sugT: { paddingHorizontal: 12, justifyContent: 'center', borderRadius: 14, borderWidth: 1 },
  sugC: { width: 134, padding: 10, borderRadius: 16, borderWidth: 1, alignItems: 'center' }, sugAv: { width: 58, height: 58, borderRadius: 29 }, sugB: { width: '100%', alignItems: 'center', paddingVertical: 6, borderRadius: 10, marginTop: 6 },
  gTabs: { flexDirection: 'row', borderTopWidth: 0.5 }, gTab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tile: { width: W, height: W * 1.25, borderRadius: 10, overflow: 'hidden' },
  vBadge: { position: 'absolute', bottom: 6, left: 6, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
});
