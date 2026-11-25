import React, { useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Pressable, Image, Dimensions, StyleSheet, Animated, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, increment, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { BRAND, useTheme } from '../constants/theme';
import { CommentModal } from '../constants/CommentModal';
import { ShareModal } from '../constants/ShareModal';
import { StoryViewerModal } from '../constants/StoryViewerModal';
import { RepostModal, ReelMenuModal, LikesPlaysModal } from '../constants/ReelModals';

const { height: H } = Dimensions.get('window');
const useIsFocused = () => { const [f, sF] = useState(true); useFocusEffect(React.useCallback(() => { sF(true); return () => sF(false); }, [])); return f; };

function ReelItem({ item, owner, active, me, hasStory, onOpenStory, onComment, onRepost, onOpenLikes, onShare, onSave, onMenu, captions, fullscreen }: any) {
  const router = useRouter();
  const uid = auth.currentUser?.uid || '';
  const player = useVideoPlayer(item.mediaUrl, (p) => { p.loop = true; });
  const [tapPos, setTapPos] = useState({ x: 180, y: 320 });
  const [showHeart, setShowHeart] = useState(false);
  const scale = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);

  useEffect(() => {
    if (active) { player.play(); updateDoc(doc(db, 'posts', item.id), { views: increment(1) }).catch(() => {}); }
    else player.pause();
  }, [active]);

  const liked = (item.likes || []).includes(uid);
  const reposted = (item.reposts || []).includes(uid);
  const saved = (me?.savedPosts || []).includes(item.id);
  const isF = (me?.following || []).includes(item.uid);
  const av = owner?.photoUrl || owner?.avatar || item.userPhoto || item.userAvatar;
  const openProf = () => router.push((item.uid === uid ? '/profile' : `/user/${item.uid}`) as any);

  const toggleLike = () => updateDoc(doc(db, 'posts', item.id), { likes: liked ? arrayRemove(uid) : arrayUnion(uid) }).catch((e) => Alert.alert('Error', e?.message));

  const handleTap = (e: any) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setTapPos({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
      setShowHeart(true); scale.setValue(0.3);
      Animated.sequence([Animated.spring(scale, { toValue: 1.2, useNativeDriver: true }), Animated.timing(scale, { toValue: 0, duration: 350, useNativeDriver: true })]).start(() => setShowHeart(false));
      if (!liked) toggleLike();
    }
    lastTap.current = now;
  };

  return (
    <View style={s.reel}>
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} surfaceType="textureView" />
      <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} />
      {showHeart && <Animated.View pointerEvents="none" style={[s.tapHeart, { left: tapPos.x - 42, top: tapPos.y - 42, transform: [{ scale }] }]}><Ionicons name="heart" size={84} color="#F97316" /></Animated.View>}

      {!fullscreen && (
        <View style={s.actions}>
          <TouchableOpacity onPress={toggleLike} hitSlop={8} style={s.actBtn}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={30} color={liked ? '#EF4444' : '#fff'} /></TouchableOpacity>
          <TouchableOpacity onPress={() => onOpenLikes(item)} hitSlop={8} style={s.actBtn}><Text style={s.cnt}>Likes</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => onComment(item)} hitSlop={8} style={s.actBtn}><Ionicons name="chatbubble-outline" size={28} color="#fff" /><Text style={s.cnt}>{item.commentsCount || 0}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => onRepost(item, reposted)} hitSlop={8} style={s.actBtn}><Ionicons name="repeat" size={28} color={reposted ? '#10B981' : '#fff'} /><Text style={s.cnt}>{(item.reposts || []).length}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => onShare(item)} hitSlop={8} style={s.actBtn}><Ionicons name="paper-plane-outline" size={27} color="#fff" /></TouchableOpacity>
          <TouchableOpacity onPress={() => onSave(item)} hitSlop={8} style={s.actBtn}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={27} color={saved ? BRAND : '#fff'} /></TouchableOpacity>
          <TouchableOpacity onPress={() => onMenu(item)} hitSlop={8} style={s.actBtn}><Ionicons name="reorder-two-outline" size={28} color="#fff" /></TouchableOpacity>
        </View>
      )}

      {!fullscreen && (
        <View style={s.bottom}>
          {reposted && <TouchableOpacity onPress={() => onRepost(item, false)} style={s.thoughtPill}><Text style={{ color: '#fff', fontSize: 12 }}>{item.repostThoughts?.[uid] || 'Add a thought...'}</Text></TouchableOpacity>}
          <View style={s.userRow}>
            <TouchableOpacity onPress={() => (hasStory ? onOpenStory(item.uid) : openProf())} style={[s.ring, hasStory && { borderColor: BRAND, borderWidth: 2 }]}>
              {av ? <Image source={{ uri: av }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={16} color="#fff" /></View>}
            </TouchableOpacity>
            <TouchableOpacity onPress={openProf}><Text style={s.uname}>@{owner?.username || item.username}</Text></TouchableOpacity>
            {item.uid !== uid && <TouchableOpacity onPress={() => updateDoc(doc(db, 'users', uid), { following: isF ? arrayRemove(item.uid) : arrayUnion(item.uid) })} style={s.fBtn}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{isF ? 'Following' : 'Follow'}</Text></TouchableOpacity>}
          </View>
          <Text style={s.cap} numberOfLines={2}>{item.caption}</Text>
          {captions && !!item.caption && <Text style={s.ccBox}>{item.caption}</Text>}
          <TouchableOpacity onPress={() => onComment(item)} style={s.addCmt}><Text style={{ color: '#D1D5DB', fontSize: 13 }}>Add comment...</Text></TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function ReelsScreen() {
  const router = useRouter();
  const { startId } = useLocalSearchParams<{ startId?: string }>();
  const { c } = useTheme();
  const isFocused = useIsFocused();
  const uid = auth.currentUser?.uid || '';
  const [me, setMe] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [reels, setReels] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [commentPost, setCommentPost] = useState<any>(null);
  const [repostItem, setRepostItem] = useState<any>(null);
  const [likesItem, setLikesItem] = useState<any>(null);
  const [sharePost, setSharePost] = useState<any>(null);
  const [menuItem, setMenuItem] = useState<any>(null);
  const [storyOpen, setStoryOpen] = useState<any[]>([]);
  const [captions, setCaptions] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'posts'), where('mediaType', '==', 'video'), orderBy('createdAt', 'desc')), (s) => setReels(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u2 = uid ? onSnapshot(doc(db, 'users', uid), (s) => s.exists() && setMe(s.data())) : () => {};
    const u3 = onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(collection(db, 'stories'), (s) => setStories(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); };
  }, [uid]);

  const ordered = startId ? [...reels.filter((r) => r.id === startId), ...reels.filter((r) => r.id !== startId)] : reels;

  const handleRepost = async (item: any, alreadyReposted: boolean) => {
    if (!uid) return;
    if (alreadyReposted) {
      await updateDoc(doc(db, 'posts', item.id), { reposts: arrayRemove(uid) }).catch((e) => Alert.alert('Error', e?.message));
    } else {
      await updateDoc(doc(db, 'posts', item.id), { reposts: arrayUnion(uid) }).catch((e) => Alert.alert('Error', e?.message));
      setRepostItem(item);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <FlatList data={ordered} keyExtractor={(i) => i.id} pagingEnabled showsVerticalScrollIndicator={false}
        onViewableItemsChanged={({ viewableItems }) => viewableItems[0] && setActiveIdx(viewableItems[0].index || 0)}
        renderItem={({ item, index }) => <ReelItem item={item} owner={users.find((u) => u.id === item.uid)} active={isFocused && index === activeIdx} me={me} hasStory={stories.some((st) => st.uid === item.uid)} captions={captions} fullscreen={fullscreen} onOpenStory={(u: string) => setStoryOpen(stories.filter((st) => st.uid === u))} onComment={setCommentPost} onRepost={handleRepost} onOpenLikes={setLikesItem} onShare={setSharePost} onSave={(p: any) => updateDoc(doc(db, 'users', uid), { savedPosts: (me.savedPosts || []).includes(p.id) ? arrayRemove(p.id) : arrayUnion(p.id) }).catch((e) => Alert.alert('Error', e?.message))} onMenu={setMenuItem} />}
      />
      {commentPost && <CommentModal {...({ visible: !!commentPost, post: commentPost, postId: commentPost.id, onClose: () => setCommentPost(null) } as any)} />}
      {sharePost && <ShareModal visible={!!sharePost} post={sharePost} onClose={() => setSharePost(null)} />}
      {repostItem && <RepostModal visible={!!repostItem} item={repostItem} uid={uid} me={me} c={c} onClose={() => setRepostItem(null)} />}
      {likesItem && <LikesPlaysModal visible={!!likesItem} item={likesItem} allUsers={users} myUid={uid} myFollowing={me.following || []} c={c} onClose={() => setLikesItem(null)} onOpenUser={(id: string) => router.push(`/user/${id}` as any)} onFollow={(id: string) => updateDoc(doc(db, 'users', uid), { following: (me.following || []).includes(id) ? arrayRemove(id) : arrayUnion(id) })} />}
      {menuItem && <ReelMenuModal visible={!!menuItem} item={menuItem} captions={captions} setCaptions={setCaptions} fullscreen={fullscreen} setFullscreen={setFullscreen} autoScroll={autoScroll} setAutoScroll={setAutoScroll} c={c} onClose={() => setMenuItem(null)} onReport={async () => { await addDoc(collection(db, 'reports'), { postId: menuItem.id, reporterUid: uid, reason: 'Reel report', createdAt: serverTimestamp() }); Alert.alert('Reported', 'Thank you.'); }} />}
      {storyOpen.length > 0 && <StoryViewerModal {...({ visible: true, stories: storyOpen, initialIndex: 0, myUid: uid, me, c, onClose: () => setStoryOpen([]) } as any)} />}
    </View>
  );
}

const s = StyleSheet.create({
  reel: { height: H - 56, backgroundColor: '#000', justifyContent: 'flex-end' },
  tapHeart: { position: 'absolute', zIndex: 20 },
  actions: { position: 'absolute', right: 12, bottom: 56, alignItems: 'center', gap: 12, zIndex: 25, elevation: 12 },
  actBtn: { alignItems: 'center', padding: 2 }, cnt: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2 },
  bottom: { padding: 14, paddingRight: 72, zIndex: 15 },
  thoughtPill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, alignSelf: 'flex-start', marginBottom: 8 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  ring: { padding: 2, borderRadius: 20 }, av: { width: 32, height: 32, borderRadius: 16 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  uname: { color: '#fff', fontWeight: '700', fontSize: 15 },
  fBtn: { borderWidth: 1, borderColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  cap: { color: '#fff', fontSize: 13 }, ccBox: { backgroundColor: 'rgba(0,0,0,0.65)', color: '#fff', padding: 6, borderRadius: 6, marginTop: 6, fontSize: 12 },
  addCmt: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10, width: '115%' },
});
