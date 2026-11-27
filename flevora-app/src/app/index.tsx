import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, Pressable, FlatList, Dimensions, StyleSheet, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useFocusEffect, useRouter } from 'expo-router';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { FeedHeader, CommentModal } from '../constants/FeedHeader';
import { ShareModal } from '../constants/ShareModal';
import { StoryViewerModal } from '../constants/StoryViewerModal';
import { useTheme, BRAND, NEON } from '../constants/theme';
import { AnimatedLikeButton, DoubleTapHeartOverlay } from '../constants/LikeComponents';
import { formatLikesLabel, togglePostLike } from '../constants/likeSystem';

const W = Dimensions.get('window').width;

const formatTime = (ts: any) => {
  const date = ts?.toDate ? ts.toDate() : null;
  if (!date) return 'Just now';
  const diff = Math.floor((Date.now() - date.getTime()) / 60000);
  if (diff < 1) return 'Just now';
  if (diff < 60) return `${diff}m ago`;
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
  return `${Math.floor(diff / 1440)}d ago`;
};

function PostVideo({ uri, active, focused, onOpenReel, onDoubleTap }: { uri: string; active: boolean; focused: boolean; onOpenReel: () => void; onDoubleTap: () => void }) {
  const [muted, setMuted] = useState(false);
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = false; });

  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => {
    if (focused && active) { player.muted = muted; player.play(); } else { player.pause(); }
  }, [focused, active, muted, player]);

  return (
    <View style={s.mediaWrap}>
      <DoubleTapHeartOverlay onDoubleTap={onDoubleTap} onSingleTap={() => { player.pause(); onOpenReel(); }}>
        <VideoView player={player} style={s.media} surfaceType="textureView" nativeControls={false} contentFit="cover" />
      </DoubleTapHeartOverlay>
      <TouchableOpacity onPress={() => setMuted((m) => !m)} style={s.volBtn} hitSlop={10}>
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={17} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const uid = auth.currentUser?.uid || '';
  const [focused, setFocused] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [userMap, setUserMap] = useState<Record<string, any>>({});
  const [me, setMe] = useState<any>(null);
  const [activeId, setActiveId] = useState('');
  const [limitCount, setLimitCount] = useState(10);
  const [commentPost, setCommentPost] = useState<any>(null);
  const [sharePost, setSharePost] = useState<any>(null);
  const [storyList, setStoryList] = useState<any[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(limitCount)), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPosts(list);
      if (list[0] && !activeId) setActiveId(list[0].id);
    }, () => {});
    const u2 = onSnapshot(collection(db, 'users'), (snap) => {
      const m: Record<string, any> = {};
      snap.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
      setUserMap(m);
      if (uid && m[uid]) setMe(m[uid]);
    }, () => {});
    const u3 = onSnapshot(query(collection(db, 'stories'), orderBy('createdAt', 'desc')), (snap) => {
      const now = Date.now();
      setStories(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((st: any) => !st.expiresAt || st.expiresAt > now));
    }, () => {});
    return () => { u1(); u2(); u3(); };
  }, [uid, limitCount]);

  const toggleLike = (post: any, forceLike = false) => {
    const prevLikes: string[] = Array.isArray(post.likes) ? post.likes : [];
    togglePostLike({
      post,
      myUid: uid,
      me,
      targetUser: userMap[post.uid],
      forceLike,
      onOptimistic: (nextLiked) => {
        const nextLikes = nextLiked ? Array.from(new Set([...prevLikes, uid])) : prevLikes.filter((x) => x !== uid);
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes: nextLikes } : p)));
      },
      onRollback: () => {
        setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, likes: prevLikes } : p)));
      },
    });
  };
    const onAvatarLongPress = (targetUid: string, userStories: any[]) => {
    const isMuted = Array.isArray(me?.mutedUsers) && me.mutedUsers.includes(targetUid);
    const btns: any[] = [];
    if (userStories.length > 0) btns.push({ text: 'View Story', onPress: () => setStoryList(userStories) });
    btns.push({ text: 'View Profile', onPress: () => router.push(`/user/${targetUid}` as any) });
    if (targetUid !== uid) btns.push({ text: isMuted ? 'Unmute' : 'Mute', onPress: () => updateDoc(doc(db, 'users', uid), { mutedUsers: isMuted ? arrayRemove(targetUid) : arrayUnion(targetUid) }) });
    btns.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Account Options', undefined, btns);
  };

  const openPostOptions = (post: any) => {
    const btns: any[] = [{ text: 'Report Post', style: 'destructive', onPress: () => addDoc(collection(db, 'reports'), { postId: post.id, type: 'post', status: 'pending', reportedBy: uid, createdAt: serverTimestamp() }) }];
    if (post.uid === uid) btns.unshift({ text: 'Delete Post', style: 'destructive', onPress: () => deleteDoc(doc(db, 'posts', post.id)) });
    btns.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert('Post Options', undefined, btns);
  };

  const onView = useRef(({ viewableItems }: any) => { if (viewableItems[0]?.item?.id) setActiveId(viewableItems[0].item.id); }).current;

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <FlatList
        data={posts}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={<FeedHeader />}
        onViewableItemsChanged={onView}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        onEndReached={() => setLimitCount((n) => n + 10)}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); }} />}
        renderItem={({ item }) => {
          const owner = userMap[item.uid];
          const dp = owner?.photoUrl || owner?.avatar || item.avatar || '';
          const uname = owner?.username || item.username || 'user';
          const userStories = stories.filter((st) => st.uid === item.uid);
          const hasStory = userStories.length > 0;
          const liked = Array.isArray(item.likes) && item.likes.includes(uid);
          const saved = Array.isArray(me?.savedPosts) && me.savedPosts.includes(item.id);

          return (
            <View style={[s.card, { borderBottomColor: c.border }]}>
              <View style={s.rowHead}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity onPress={() => (hasStory ? setStoryList(userStories) : router.push(`/user/${item.uid}` as any))} onLongPress={() => onAvatarLongPress(item.uid, userStories)} style={[s.avRing, { borderColor: hasStory ? NEON.pink : 'transparent' }]}>
                    {dp ? <Image source={{ uri: dp }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={18} color="#111827" /></View>}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => router.push(`/user/${item.uid}` as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>@{uname}</Text>
                    {owner?.verified && <Ionicons name="checkmark-circle" size={14} color={BRAND} />}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => openPostOptions(item)} hitSlop={8}><Ionicons name="ellipsis-vertical" size={18} color={c.muted} /></TouchableOpacity>
              </View>

              {item.mediaType === 'video' ? (
                <PostVideo uri={item.mediaUrl} active={item.id === activeId} focused={focused} onOpenReel={() => router.push(`/reels?startId=${item.id}` as any)} onDoubleTap={() => toggleLike(item, true)} />
              ) : (
                <DoubleTapHeartOverlay onDoubleTap={() => toggleLike(item, true)}>
                  <Image source={{ uri: item.mediaUrl }} style={s.media} resizeMode="cover" />
                </DoubleTapHeartOverlay>
              )}

              <View style={s.actions}>
                <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
                  <AnimatedLikeButton liked={liked} onPress={() => toggleLike(item, false)} />
                  <TouchableOpacity onPress={() => setCommentPost(item)}><Ionicons name="chatbubble-outline" size={23} color={c.text} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => setSharePost(item)}><Ionicons name="paper-plane-outline" size={23} color={c.text} /></TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => uid && updateDoc(doc(db, 'users', uid), { savedPosts: saved ? arrayRemove(item.id) : arrayUnion(item.id) })}>
                  <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={23} color={saved ? BRAND : c.text} />
                </TouchableOpacity>
              </View>

              <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>{formatLikesLabel(item.likes?.length || 0)}</Text>
                {!!item.caption && <Text style={{ color: c.text, marginTop: 3 }}><Text style={{ fontWeight: '700' }}>@{uname} </Text>{item.caption}</Text>}
                {!!item.commentsCount && <TouchableOpacity onPress={() => setCommentPost(item)}><Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>View all {item.commentsCount} comments</Text></TouchableOpacity>}
                <Text style={{ color: c.muted, fontSize: 11, marginTop: 3 }}>{formatTime(item.createdAt)}</Text>
              </View>
            </View>
          );
        }}
      />
      <CommentModal postId={commentPost?.id || null} post={commentPost} onClose={() => setCommentPost(null)} />
      <ShareModal post={sharePost} onClose={() => setSharePost(null)} />
      <StoryViewerModal visible={!!storyList} stories={storyList || []} onClose={() => setStoryList(null)} onAddStory={() => {}} />
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderBottomWidth: 0.5 },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10 },
  avRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, justifyContent: 'center', alignItems: 'center', padding: 2 },
  av: { width: 32, height: 32, borderRadius: 16 },
  mediaWrap: { width: W, height: W * 1.15, backgroundColor: '#000' },
  media: { width: W, height: W * 1.15, backgroundColor: '#000' },
  volBtn: { position: 'absolute', right: 12, bottom: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', zIndex: 20, elevation: 20 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
});
