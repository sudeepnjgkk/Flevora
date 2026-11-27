import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList, Modal, StyleSheet, Alert,
  Linking, Dimensions, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, onSnapshot, deleteDoc, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND } from '../constants/theme';
import { ExplorePostModal } from '../constants/ExplorePostModal';
import { getThumbUrl } from '../constants/searchHelpers';
import { fetchPostsByIds, fetchTaggedPostsPage, fetchUserPostsPage } from '../constants/profileHelpers';
import { EditProfileModal, FollowListModal, HighlightModal, ProfessionalModal, shareProfileLink } from '../constants/ProfileSubModals';
import { ProfileSettingsModal } from '../constants/ProfileSettingsModal';
import UploadScreen from './upload';

const W = (Dimensions.get('window').width - 4) / 3;

export default function ProfileScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const uid = auth.currentUser?.uid || '';

  const [user, setUser] = useState<any>(null);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [postsCursor, setPostsCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [postsHasMore, setPostsHasMore] = useState(false);

  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<any[]>([]);
  const [tab, setTab] = useState<'posts' | 'reels' | 'saved' | 'tagged'>('posts');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [followMode, setFollowMode] = useState<'followers' | 'following' | 'requests' | null>(null);
  const [hlModal, setHlModal] = useState<{ open: boolean; item: any | null }>({ open: false, item: null });
  const [selectedPost, setSelectedPost] = useState<any | null>(null);

  useEffect(() => {
    if (!uid) return;
    return onSnapshot(doc(db, 'users', uid), (s) => {
      if (s.exists()) setUser({ id: s.id, ...s.data() });
    });
  }, [uid]);

  const loadData = useCallback(async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const pPage = await fetchUserPostsPage(uid, null, 18);
      setMyPosts(pPage.items);
      setPostsCursor(pPage.lastDoc);
      setPostsHasMore(pPage.hasMore);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (tab === 'saved' && Array.isArray(user?.savedPosts)) {
      fetchPostsByIds(user.savedPosts).then(setSavedPosts);
    } else if (tab === 'tagged' && user?.username) {
      fetchTaggedPostsPage(user.username.toLowerCase(), null, 18).then((r) => setTaggedPosts(r.items));
    }
  }, [tab, user?.savedPosts, user?.username]);

  const loadMorePosts = async () => {
    if ((tab !== 'posts' && tab !== 'reels') || !postsHasMore || !postsCursor) return;
    const pPage = await fetchUserPostsPage(uid, postsCursor, 18);
    setMyPosts((prev) => {
      const seen = new Set(prev.map((x) => x.id));
      return [...prev, ...pPage.items.filter((x) => !seen.has(x.id))];
    });
    setPostsCursor(pPage.lastDoc);
    setPostsHasMore(pPage.hasMore);
  };

  const deletePost = (postId: string) => {
    Alert.alert('Delete Post', 'Remove this post permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDoc(doc(db, 'posts', postId));
          setMyPosts((p) => p.filter((x) => x.id !== postId));
        },
      },
    ]);
  };

  const displayList =
    tab === 'posts' ? myPosts.filter((p) => p.mediaType !== 'video') :
    tab === 'reels' ? myPosts.filter((p) => p.mediaType === 'video') :
    tab === 'saved' ? savedPosts : taggedPosts;

  const followListIds =
    followMode === 'followers' ? (user?.followers || []) :
    followMode === 'following' ? (user?.following || []) :
    (user?.followRequests || []);

  const highlights: any[] = Array.isArray(user?.highlights) ? user.highlights : [];

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.topBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {user?.isPrivate && <Ionicons name="lock-closed" size={16} color={c.text} />}
          <Text style={[styles.username, { color: c.text }]}>@{user?.username || 'profile'}</Text>
          {(user?.isVerified || user?.verified) && <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={() => setCreateOpen(true)}><Ionicons name="add-circle-outline" size={26} color={c.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setSettingsOpen(true)}><Ionicons name="menu-outline" size={28} color={c.text} /></TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={displayList}
        numColumns={3}
        keyExtractor={(item) => item.id}
        onEndReached={loadMorePosts}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={BRAND} />}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 14 }}>
            <View style={styles.infoRow}>
              <TouchableOpacity onPress={() => setEditOpen(true)}>
                {user?.avatar ? <Image source={{ uri: user.avatar }} style={styles.avatar} /> : (
                  <View style={[styles.avatar, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: '#fff', fontSize: 26, fontWeight: '700' }}>{(user?.username || 'U')[0].toUpperCase()}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.statsRow}>
                <View style={styles.stat}><Text style={[styles.statNum, { color: c.text }]}>{myPosts.length}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Posts</Text></View>
                <TouchableOpacity style={styles.stat} onPress={() => setFollowMode('followers')}><Text style={[styles.statNum, { color: c.text }]}>{user?.followers?.length || 0}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Followers</Text></TouchableOpacity>
                <TouchableOpacity style={styles.stat} onPress={() => setFollowMode('following')}><Text style={[styles.statNum, { color: c.text }]}>{user?.following?.length || 0}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Following</Text></TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.fullName, { color: c.text }]}>{user?.fullName || ''}</Text>
              {!!user?.pronouns && <Text style={{ color: c.muted, fontSize: 12 }}>{user.pronouns}</Text>}
            </View>
            {!!user?.category && <Text style={{ color: BRAND, fontSize: 12, fontWeight: '600' }}>{user.category}</Text>}
            {!!user?.bio && <Text style={{ color: c.text, marginTop: 2 }}>{user.bio}</Text>}
            {!!user?.website && (
              <TouchableOpacity onPress={() => Linking.openURL(user.website.startsWith('http') ? user.website : `https://${user.website}`)}>
                <Text style={{ color: BRAND, marginTop: 2 }}>{user.website}</Text>
              </TouchableOpacity>
            )}

            <View style={styles.btnRow}>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: c.input }]} onPress={() => setEditOpen(true)}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>Edit Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: c.input }]} onPress={() => shareProfileLink(uid, user?.username || 'user')}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>Share Profile</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actBtn, { backgroundColor: c.input }]} onPress={() => setProOpen(true)}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>Insights</Text>
              </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 10 }}>
              <TouchableOpacity onPress={() => setHlModal({ open: true, item: null })} style={{ alignItems: 'center', width: 62 }}>
                <View style={[styles.hlCircle, { borderColor: c.border }]}><Ionicons name="add" size={24} color={c.text} /></View>
                <Text style={{ color: c.text, fontSize: 11, marginTop: 4 }} numberOfLines={1}>New</Text>
              </TouchableOpacity>
              {highlights.map((h) => (
                <TouchableOpacity key={h.id} onPress={() => setHlModal({ open: true, item: h })} style={{ alignItems: 'center', width: 62 }}>
                  <Image source={{ uri: h.cover }} style={[styles.hlCircle, { borderColor: BRAND }]} />
                  <Text style={{ color: c.text, fontSize: 11, marginTop: 4 }} numberOfLines={1}>{h.title}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={[styles.tabs, { borderBottomColor: c.border }]}>
              {([
                { k: 'posts', icon: 'grid-outline' },
                { k: 'reels', icon: 'play-circle-outline' },
                { k: 'saved', icon: 'bookmark-outline' },
                { k: 'tagged', icon: 'person-outline' },
              ] as const).map((t) => (
                <TouchableOpacity key={t.k} onPress={() => setTab(t.k)} style={[styles.tabBtn, tab === t.k && { borderBottomColor: c.text, borderBottomWidth: 2 }]}>
                  <Ionicons name={t.icon} size={22} color={tab === t.k ? c.text : c.muted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        }
        ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 30 }} color={BRAND} /> : <Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>Nothing here yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedPost(item)} onLongPress={() => item.uid === uid && deletePost(item.id)} style={{ margin: 0.6 }}>
            <Image source={{ uri: getThumbUrl(item) }} style={styles.gridImg} />
            {item.mediaType === 'video' && <Ionicons name="play" size={16} color="#fff" style={styles.badge} />}
          </TouchableOpacity>
        )}
      />

      <EditProfileModal visible={editOpen} user={user} uid={uid} onClose={() => setEditOpen(false)} />
      <FollowListModal mode={followMode} ids={followListIds} ownerUid={uid} me={user} myUid={uid} onClose={() => setFollowMode(null)} />
      <HighlightModal visible={hlModal.open} uid={uid} user={user} activeHighlight={hlModal.item} onClose={() => setHlModal({ open: false, item: null })} />
      <ProfessionalModal visible={proOpen} uid={uid} user={user} posts={myPosts} onClose={() => setProOpen(false)} />
      <ProfileSettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} onOpenEdit={() => setEditOpen(true)} onOpenRequests={() => setFollowMode('requests')} />
      <ExplorePostModal post={selectedPost} author={user} me={user} onClose={() => setSelectedPost(null)} onPressTag={(t) => router.navigate({ pathname: '/explore', params: { q: t } } as any)} onPressPlace={(p) => router.navigate({ pathname: '/explore', params: { q: p } } as any)} />
      <Modal visible={createOpen} animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={{ flex: 1 }}>
          <TouchableOpacity onPress={() => setCreateOpen(false)} style={{ position: 'absolute', top: 46, right: 16, zIndex: 50, padding: 6 }}>
            <Ionicons name="close" size={26} color={c.text} />
          </TouchableOpacity>
          <UploadScreen />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 46 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10 },
  username: { fontSize: 19, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 10 },
  avatar: { width: 82, height: 82, borderRadius: 41 },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 17, fontWeight: '800' },
  fullName: { fontSize: 14, fontWeight: '700' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  hlCircle: { width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, marginTop: 4 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  gridImg: { width: W, height: W },
  badge: { position: 'absolute', top: 6, right: 6 },
});
