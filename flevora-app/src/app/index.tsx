import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, FlatList, ScrollView, Dimensions, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { FeedHeader, CommentModal } from '../constants/FeedHeader';
import { ShareModal } from '../constants/ShareModal';
import { useTheme, BRAND } from '../constants/theme';
import { sendPush } from '../constants/push';

const W = Dimensions.get('window').width;
const fmtTime = (ts: any) => {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return 'Just now';
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  return m < 1 ? 'Just now' : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.floor(m / 60)}h ago` : `${Math.floor(m / 1440)}d ago`;
};

function PostVideo({ uri, onOpenReel }: { uri: string; onOpenReel: () => void }) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; p.play(); });
  const toggleMute = () => { const n = !muted; setMuted(n); player.muted = n; };
  return (
    <TouchableOpacity activeOpacity={0.95} onPress={onOpenReel} style={styles.media}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} surfaceType="textureView" />
      <TouchableOpacity onPress={toggleMute} style={styles.muteBtn} hitSlop={8}>
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={17} color="#fff" />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const uid = auth.currentUser?.uid || '';
  const [posts, setPosts] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, any>>({});
  const [me, setMe] = useState<any>(null);
  const [limitCount, setLimitCount] = useState(12);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(limitCount)), (s) => setPosts(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = onSnapshot(collection(db, 'users'), (s) => {
      const m: Record<string, any> = {};
      s.docs.forEach((d) => { m[d.id] = d.data(); });
      setUserMap(m);
      if (uid && m[uid]) setMe(m[uid]);
    });
    return () => { u1(); u2(); };
  }, [uid, limitCount]);

  const toggleLike = async (post: any) => {
    if (!uid) return;
    const liked = Array.isArray(post.likes) && post.likes.includes(uid);
    await updateDoc(doc(db, 'posts', post.id), { likes: liked ? arrayRemove(uid) : arrayUnion(uid) });
    if (!liked && post.uid !== uid) {
      await addDoc(collection(db, 'notifications'), { toUid: post.uid, fromUid: uid, fromUsername: me?.username || 'user', type: 'like', message: 'liked your post.', read: false, createdAt: serverTimestamp() });
      const token = userMap[post.uid]?.expoPushToken;
      if (token) sendPush(token, 'Flevora', `@${me?.username || 'Someone'} liked your post.`);
    }
  };

  const handleTap = (post: any) => { const now = Date.now(); if (now - lastTap.current < 300) toggleLike(post); lastTap.current = now; };
  const toggleFollow = async (targetUid: string) => {
    if (!uid || uid === targetUid) return;
    const following = Array.isArray(me?.following) && me.following.includes(targetUid);
    await updateDoc(doc(db, 'users', uid), { following: following ? arrayRemove(targetUid) : arrayUnion(targetUid) });
    await updateDoc(doc(db, 'users', targetUid), { followers: following ? arrayRemove(uid) : arrayUnion(uid) });
  };

  const openOptions = (postId: string) => Alert.alert('Post Options', 'Choose an action', [
    { text: 'Not Interested / Hide', onPress: () => uid && updateDoc(doc(db, 'users', uid), { hiddenPosts: arrayUnion(postId) }) },
    { text: 'Report Post', style: 'destructive', onPress: async () => { await addDoc(collection(db, 'reports'), { postId, type: 'post', status: 'pending', reportedBy: uid, createdAt: serverTimestamp() }); Alert.alert('Reported', 'Thank you.'); } },
    { text: 'Cancel', style: 'cancel' },
  ]);

  const blocked = new Set(me?.blockedUsers || []), hidden = new Set(me?.hiddenPosts || []), myFollowing = new Set(me?.following || []);
  const visiblePosts = posts.filter((p) => {
    if (blocked.has(p.uid) || hidden.has(p.id)) return false;
    const owner = userMap[p.uid];
    if (owner?.status === 'deactivated' || owner?.status === 'suspended') return false;
    if (owner?.isPrivate && p.uid !== uid && !myFollowing.has(p.uid)) return false;
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <FlatList
        data={visiblePosts} keyExtractor={(i) => i.id}
        ListHeaderComponent={<FeedHeader />}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: c.muted }}>No posts yet.</Text>}
        onEndReached={() => setLimitCount((n) => n + 10)} onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); }} />}
        renderItem={({ item }) => {
          const liked = Array.isArray(item.likes) && item.likes.includes(uid);
          const saved = Array.isArray(me?.savedPosts) && me.savedPosts.includes(item.id);
          const isFollowing = myFollowing.has(item.uid);
          const imgs: string[] = item.media?.length ? item.media : [item.mediaUrl];
          const firstTag = Array.isArray(item.hashtags) && item.hashtags[0];
          const av = item.userPhoto || item.userAvatar || userMap[item.uid]?.photoUrl;

          return (
            <View style={[styles.card, { borderBottomColor: c.border }]}>
              <View style={styles.head}>
                <TouchableOpacity style={styles.userRow} onPress={() => router.navigate(`/user/${item.uid}` as any)}>
                  {av ? <Image source={{ uri: av }} style={styles.avatar} /> : <View style={[styles.avatar, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Text style={{ color: '#fff', fontWeight: '700' }}>{(item.username || 'U')[0].toUpperCase()}</Text></View>}
                  <View><Text style={{ color: c.text, fontWeight: '700' }}>@{item.username}</Text>{!!item.location && <Text style={{ color: c.muted, fontSize: 11 }}>{item.location}</Text>}</View>
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {item.uid !== uid && <TouchableOpacity onPress={() => toggleFollow(item.uid)}><Text style={{ color: isFollowing ? c.muted : BRAND, fontWeight: '700', fontSize: 13 }}>{isFollowing ? 'Following' : 'Follow'}</Text></TouchableOpacity>}
                  <TouchableOpacity onPress={() => openOptions(item.id)}><Ionicons name="ellipsis-vertical" size={18} color={c.muted} /></TouchableOpacity>
                </View>
              </View>

              {item.mediaType === 'video' ? (
                <PostVideo uri={item.mediaUrl} onOpenReel={() => router.push({ pathname: '/reels', params: { startId: item.id } } as any)} />
              ) : (
                <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                  {imgs.map((url, idx) => <TouchableOpacity key={idx} activeOpacity={0.95} onPress={() => handleTap(item)}><Image source={{ uri: url }} style={styles.media} /></TouchableOpacity>)}
                </ScrollView>
              )}

              <View style={styles.actions}>
                <View style={{ flexDirection: 'row', gap: 16 }}>
                  <TouchableOpacity onPress={() => toggleLike(item)}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={25} color={liked ? '#EF4444' : c.text} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => setCommentPostId(item.id)}><Ionicons name="chatbubble-outline" size={23} color={c.text} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => setSharePost(item)}><Ionicons name="paper-plane-outline" size={23} color={c.text} /></TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => uid && updateDoc(doc(db, 'users', uid), { savedPosts: saved ? arrayRemove(item.id) : arrayUnion(item.id) })}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={23} color={saved ? BRAND : c.text} /></TouchableOpacity>
              </View>

              <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{item.likes?.length || 0} likes</Text>
                {!!item.caption && <Text style={{ color: c.text, marginTop: 3 }}><Text style={{ fontWeight: '700' }}>@{item.username} </Text>{item.caption}</Text>}
                {!!firstTag && <TouchableOpacity onPress={() => router.navigate({ pathname: '/explore' as any, params: { q: firstTag } })}><Text style={{ color: BRAND, fontSize: 12, marginTop: 3, fontWeight: '600' }}>{item.hashtags.join(' ')}</Text></TouchableOpacity>}
                <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>{formatTime(item.createdAt)}</Text>
              </View>
            </View>
          );
        }}
      />
      <CommentModal postId={commentPostId} onClose={() => setCommentPostId(null)} />
      <ShareModal post={sharePost} onClose={() => setSharePost(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }, card: { borderBottomWidth: 1, marginBottom: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 36, height: 36, borderRadius: 18 },
  media: { width: W, height: W * 1.15, backgroundColor: '#000' },
  muteBtn: { position: 'absolute', right: 12, bottom: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10 },
});
