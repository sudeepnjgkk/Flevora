import React, { useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList, StyleSheet, Linking,
  Dimensions, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, addDoc, collection, serverTimestamp,
  QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { auth, db } from '../../config';
import { useTheme, BRAND } from '../../constants/theme';
import { ExplorePostModal } from '../../constants/ExplorePostModal';
import { getThumbUrl, isBlockedBetween, toggleFollowUser } from '../../constants/searchHelpers';
import { fetchTaggedPostsPage, fetchUserPostsPage } from '../../constants/profileHelpers';
import { FollowListModal, shareProfileLink } from '../../constants/ProfileSubModals';

const W = (Dimensions.get('window').width - 4) / 3;

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const myUid = auth.currentUser?.uid || '';

  const [profile, setProfile] = useState<any>(null);
  const [notFound, setNotFound] = useState(false);
  const [me, setMe] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<any[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [tab, setTab] = useState<'posts' | 'reels' | 'tagged'>('posts');
  const [followMode, setFollowMode] = useState<'followers' | 'following' | null>(null);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    const u1 = onSnapshot(doc(db, 'users', id), (s) => {
      if (!s.exists() || s.data()?.status === 'deleted') { setNotFound(true); setProfile(null); }
      else { setNotFound(false); setProfile({ id: s.id, ...s.data() }); }
    });
    const u2 = myUid ? onSnapshot(doc(db, 'users', myUid), (s) => { if (s.exists()) setMe({ id: s.id, ...s.data() }); }) : () => {};
    fetchUserPostsPage(id, null, 18).then((p) => { setPosts(p.items); setCursor(p.lastDoc); setHasMore(p.hasMore); });
    return () => { u1(); u2(); };
  }, [id, myUid]);

  useEffect(() => {
    if (tab === 'tagged' && profile?.username) {
      fetchTaggedPostsPage(profile.username.toLowerCase(), null, 18).then((r) => setTaggedPosts(r.items));
    }
  }, [tab, profile?.username]);

  if (notFound) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Ionicons name="person-remove-outline" size={44} color={c.muted} />
        <Text style={{ color: c.text, fontWeight: '700', marginTop: 10 }}>Account Unavailable</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 14 }}>
          <Text style={{ color: BRAND, fontWeight: '700' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!profile) {
    return <View style={[styles.center, { backgroundColor: c.background }]}><ActivityIndicator size="large" color={BRAND} /></View>;
  }

  const blocked = isBlockedBetween(me, profile, myUid);
  const isFollowing = Array.isArray(profile.followers) && profile.followers.includes(myUid);
  const isRequested = Array.isArray(profile.followRequests) && profile.followRequests.includes(myUid);
  const canView = !blocked && (!profile.isPrivate || isFollowing || myUid === id);
  const followLabel = isFollowing ? 'Following' : isRequested ? 'Requested' : profile.isPrivate ? 'Request' : 'Follow';

  const openMenu = () => {
    const iBlocked = Array.isArray(me?.blockedUsers) && me.blockedUsers.includes(id);
    Alert.alert(`@${profile.username}`, 'Options', [
      { text: 'Share Profile', onPress: () => shareProfileLink(id, profile.username || 'user') },
      {
        text: iBlocked ? 'Unblock User' : 'Block User',
        style: 'destructive',
        onPress: async () => {
          if (!myUid) return;
          await updateDoc(doc(db, 'users', myUid), {
            blockedUsers: iBlocked ? arrayRemove(id) : arrayUnion(id),
            following: arrayRemove(id),
          });
          if (!iBlocked) await updateDoc(doc(db, 'users', id), { followers: arrayRemove(myUid) }).catch(() => {});
        },
      },
      {
        text: 'Report User',
        style: 'destructive',
        onPress: async () => {
          await addDoc(collection(db, 'reports'), { targetUid: id, type: 'user', reporterUid: myUid, reportedBy: myUid, status: 'pending', createdAt: serverTimestamp() });
          Alert.alert('Reported', 'Thank you. Our team will review this account.');
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const displayList = !canView ? [] : tab === 'posts' ? posts.filter((p) => p.mediaType !== 'video') : tab === 'reels' ? posts.filter((p) => p.mediaType === 'video') : taggedPosts;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={[styles.topTitle, { color: c.text }]}>@{profile.username}</Text>
          {(profile.isVerified || profile.verified) && <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />}
        </View>
        {myUid !== id && <TouchableOpacity onPress={openMenu}><Ionicons name="ellipsis-vertical" size={22} color={c.text} /></TouchableOpacity>}
      </View>

      <FlatList
        data={displayList}
        numColumns={3}
        keyExtractor={(item) => item.id}
        onEndReached={() => {
          if (canView && hasMore && cursor && tab !== 'tagged') {
            fetchUserPostsPage(id, cursor, 18).then((p) => { setPosts((prev) => [...prev, ...p.items]); setCursor(p.lastDoc); setHasMore(p.hasMore); });
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 14 }}>
            <View style={styles.infoRow}>
              {profile.avatar ? <Image source={{ uri: profile.avatar }} style={styles.avatar} /> : (
                <View style={[styles.avatar, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
                  <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>{(profile.username || 'U')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.statsRow}>
                <View style={styles.stat}><Text style={[styles.statNum, { color: c.text }]}>{canView ? posts.length : '—'}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Posts</Text></View>
                <TouchableOpacity style={styles.stat} disabled={!canView} onPress={() => setFollowMode('followers')}><Text style={[styles.statNum, { color: c.text }]}>{profile.followers?.length || 0}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Followers</Text></TouchableOpacity>
                <TouchableOpacity style={styles.stat} disabled={!canView} onPress={() => setFollowMode('following')}><Text style={[styles.statNum, { color: c.text }]}>{profile.following?.length || 0}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Following</Text></TouchableOpacity>
              </View>
            </View>

            <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{profile.fullName || ''}</Text>
            {!!profile.category && <Text style={{ color: BRAND, fontSize: 12, fontWeight: '600' }}>{profile.category}</Text>}
            {!!profile.bio && !blocked && <Text style={{ color: c.text, marginTop: 2 }}>{profile.bio}</Text>}
            {!!profile.website && !blocked && <TouchableOpacity onPress={() => Linking.openURL(profile.website)}><Text style={{ color: BRAND, marginTop: 2 }}>{profile.website}</Text></TouchableOpacity>}

            {myUid !== id && !blocked && (
              <View style={styles.btnRow}>
                <TouchableOpacity style={[styles.btn, { backgroundColor: isFollowing || isRequested ? c.input : BRAND }]} onPress={() => toggleFollowUser(profile, me, myUid)}>
                  <Text style={{ color: isFollowing || isRequested ? c.text : '#fff', fontWeight: '700' }}>{followLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: c.input }]} onPress={() => router.navigate({ pathname: '/messages' as any, params: { uid: id, name: profile.username } })}>
                  <Text style={{ color: c.text, fontWeight: '700' }}>Message</Text>
                </TouchableOpacity>
              </View>
            )}

            {blocked ? (
              <View style={styles.lockBox}><Ionicons name="ban-outline" size={38} color={c.muted} /><Text style={{ color: c.text, fontWeight: '700', marginTop: 8 }}>Account Blocked</Text></View>
            ) : !canView ? (
              <View style={styles.lockBox}><Ionicons name="lock-closed-outline" size={38} color={c.muted} /><Text style={{ color: c.text, fontWeight: '700', marginTop: 8 }}>This Account is Private</Text><Text style={{ color: c.muted, fontSize: 13 }}>Follow this account to see their posts.</Text></View>
            ) : (
              <View style={[styles.tabs, { borderBottomColor: c.border }]}>
                {([{ k: 'posts', icon: 'grid-outline' }, { k: 'reels', icon: 'play-circle-outline' }, { k: 'tagged', icon: 'person-outline' }] as const).map((t) => (
                  <TouchableOpacity key={t.k} onPress={() => setTab(t.k)} style={[styles.tabBtn, tab === t.k && { borderBottomColor: c.text, borderBottomWidth: 2 }]}>
                    <Ionicons name={t.icon} size={22} color={tab === t.k ? c.text : c.muted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedPost(item)} style={{ margin: 0.6 }}>
            <Image source={{ uri: getThumbUrl(item) }} style={styles.gridImg} />
            {item.mediaType === 'video' && <Ionicons name="play" size={16} color="#fff" style={styles.badge} />}
          </TouchableOpacity>
        )}
      />

      <FollowListModal mode={followMode} ids={followMode === 'followers' ? (profile.followers || []) : (profile.following || [])} ownerUid={id} me={me} myUid={myUid} onClose={() => setFollowMode(null)} />
      <ExplorePostModal post={selectedPost} author={profile} me={me} onClose={() => setSelectedPost(null)} onPressTag={(t) => router.navigate({ pathname: '/explore', params: { q: t } } as any)} onPressPlace={(p) => router.navigate({ pathname: '/explore', params: { q: p } } as any)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 46 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 10 },
  topTitle: { fontSize: 18, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 10 },
  avatar: { width: 82, height: 82, borderRadius: 41 },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 17, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  lockBox: { alignItems: 'center', paddingVertical: 48 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, marginTop: 10 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  gridImg: { width: W, height: W },
  badge: { position: 'absolute', top: 6, right: 6 },
});
