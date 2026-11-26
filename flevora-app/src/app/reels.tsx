import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Pressable, Image, StyleSheet, Dimensions, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, increment, addDoc, deleteField, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { CommentModal } from '../constants/CommentModal';
import { ShareModal } from '../constants/ShareModal';
import { LikesPlaysModal, RepostThoughtModal } from '../constants/ReelModals';
import { BRAND, NEON } from '../constants/theme';

const H = Dimensions.get('window').height - 70;

function ReelItem({ item, active, focused, me, owner, onComment, onShare, onLikes, onRepostToast }: any) {
  const router = useRouter();
  const uid = auth.currentUser?.uid || '';
  const [paused, setPaused] = useState(false);
  const [liked, setLiked] = useState(Array.isArray(item.likes) && item.likes.includes(uid));
  const [reposted, setReposted] = useState(Array.isArray(item.reposts) && item.reposts.includes(uid));
  const [repostCount, setRepostCount] = useState(Array.isArray(item.reposts) ? item.reposts.length : 0);
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const player = useVideoPlayer(item.mediaUrl, (p) => { p.loop = true; });

  useEffect(() => {
    setLiked(Array.isArray(item.likes) && item.likes.includes(uid));
    setReposted(Array.isArray(item.reposts) && item.reposts.includes(uid));
    setRepostCount(Array.isArray(item.reposts) ? item.reposts.length : 0);
  }, [item.likes, item.reposts, uid]);

  useEffect(() => {
    if (focused && active && !paused) { player.play(); updateDoc(doc(db, 'posts', item.id), { views: increment(1) }).catch(() => {}); }
    else player.pause();
  }, [focused, active, paused]);

  const saved = Array.isArray(me?.savedPosts) && me.savedPosts.includes(item.id);
  const following = Array.isArray(me?.following) && me.following.includes(item.uid);
  const myThought = item.repostThoughts?.[uid] || '';
  const myAv = me?.photoUrl || me?.avatar || '';
  const ownerAv = owner?.photoUrl || owner?.avatar || item.avatar || '';

  const toggleLike = async () => {
    if (!uid) return;
    const next = !liked; setLiked(next);
    try {
      await updateDoc(doc(db, 'posts', item.id), { likes: next ? arrayUnion(uid) : arrayRemove(uid) });
      if (next && item.uid && item.uid !== uid) {
        addDoc(collection(db, 'notifications'), { toUid: item.uid, fromUid: uid, fromUsername: me?.username || 'user', type: 'like', postId: item.id, message: 'liked your reel', read: false, createdAt: serverTimestamp() }).catch(() => {});
      }
    } catch { setLiked(!next); }
  };

  const toggleRepost = async () => {
    if (!uid) return;
    const next = !reposted; setReposted(next); setRepostCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) { await updateDoc(doc(db, 'posts', item.id), { reposts: arrayUnion(uid) }); onRepostToast(item.id); }
      else await updateDoc(doc(db, 'posts', item.id), { reposts: arrayRemove(uid), [`repostThoughts.${uid}`]: deleteField() });
    } catch { setReposted(!next); setRepostCount((c) => Math.max(0, c + (next ? -1 : 1))); }
  };

  const saveThought = async (txt: string) => { setThoughtOpen(false); if (uid) await updateDoc(doc(db, 'posts', item.id), { [`repostThoughts.${uid}`]: txt || deleteField() }).catch(() => {}); };
  const deleteRepost = async () => { setThoughtOpen(false); if (!uid) return; setReposted(false); setRepostCount((c) => Math.max(0, c - 1)); await updateDoc(doc(db, 'posts', item.id), { reposts: arrayRemove(uid), [`repostThoughts.${uid}`]: deleteField() }).catch(() => {}); };
  const toggleSave = () => uid && updateDoc(doc(db, 'users', uid), { savedPosts: saved ? arrayRemove(item.id) : arrayUnion(item.id) }).catch(() => {});
  const toggleFollow = async () => {
    if (!uid || uid === item.uid) return;
    await updateDoc(doc(db, 'users', uid), { following: following ? arrayRemove(item.uid) : arrayUnion(item.uid) }).catch(() => {});
    await updateDoc(doc(db, 'users', item.uid), { followers: following ? arrayRemove(uid) : arrayUnion(uid) }).catch(() => {});
  };

  return (
    <View style={s.reel}>
      <VideoView player={player} style={StyleSheet.absoluteFill} surfaceType="textureView" nativeControls={false} contentFit="cover" />
      <Pressable onPress={() => setPaused((p) => !p)} style={[StyleSheet.absoluteFill, { zIndex: 1 }]} />
      {paused && <Ionicons name="play" size={56} color="rgba(255,255,255,0.85)" style={s.pauseIcon} pointerEvents="none" />}

      <View style={s.rightCol}>
        <View style={s.actBtn}>
          <TouchableOpacity onPress={toggleLike} style={[s.glossyPill, liked && { backgroundColor: NEON.pink }]}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={24} color="#fff" /></TouchableOpacity>
          <TouchableOpacity onPress={onLikes}><Text style={s.actTxt}>Likes</Text></TouchableOpacity>
        </View>
        <TouchableOpacity onPress={onComment} style={s.actBtn}><View style={s.glossyPill}><Ionicons name="chatbubble-outline" size={22} color="#fff" /></View><Text style={s.actTxt}>{item.commentsCount || 0}</Text></TouchableOpacity>
        <TouchableOpacity onPress={toggleRepost} style={s.actBtn}><View style={[s.glossyPill, reposted && { backgroundColor: NEON.purple }]}><Ionicons name="repeat" size={23} color="#fff" /></View><Text style={s.actTxt}>{repostCount}</Text></TouchableOpacity>
        <TouchableOpacity onPress={toggleSave} style={s.actBtn}><View style={[s.glossyPill, saved && { backgroundColor: NEON.magenta }]}><Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={22} color="#fff" /></View></TouchableOpacity>
        <TouchableOpacity onPress={onShare} style={s.actBtn}><View style={s.glossyPill}><Ionicons name="paper-plane-outline" size={21} color="#fff" /></View></TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Report Reel', 'Report as inappropriate?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', style: 'destructive', onPress: () => addDoc(collection(db, 'reports'), { postId: item.id, type: 'reel', status: 'pending', reportedBy: uid, createdAt: serverTimestamp() }) }])} style={s.actBtn}>
          <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={s.bottomInfo}>
        {reposted && (
          <TouchableOpacity onPress={() => setThoughtOpen(true)} style={s.thoughtTrigger}>
            <View style={s.thoughtPill}><Text style={{ color: '#111', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{myThought || 'Tag a friend...'}</Text></View>
            {myAv ? <Image source={{ uri: myAv }} style={s.thoughtMiniAv} /> : <View style={[s.thoughtMiniAv, { backgroundColor: BRAND }]} />}
          </TouchableOpacity>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={() => router.push(`/user/${item.uid}` as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {ownerAv ? <Image source={{ uri: ownerAv }} style={s.userAv} /> : <View style={[s.userAv, { backgroundColor: BRAND }]} />}
            <Text style={s.userTxt}>@{owner?.username || item.username}</Text>
          </TouchableOpacity>
          {item.uid !== uid && <TouchableOpacity onPress={toggleFollow} style={[s.followPill, following && { backgroundColor: 'rgba(255,255,255,0.22)' }]}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{following ? 'Following' : 'Follow'}</Text></TouchableOpacity>}
        </View>
        {!!item.caption && <Text style={s.capTxt} numberOfLines={2}>{item.caption}</Text>}
        <TouchableOpacity onPress={onComment} style={s.addCommentBar}><Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Add comment...</Text></TouchableOpacity>
      </View>

      <RepostThoughtModal visible={thoughtOpen} avatar={myAv} initialText={myThought} onSave={saveThought} onDelete={deleteRepost} onClose={() => setThoughtOpen(false)} />
    </View>
  );
}

export default function ReelsScreen() {
  const { startId } = useLocalSearchParams<{ startId?: string }>();
  const uid = auth.currentUser?.uid || '';
  const [focused, setFocused] = useState(true);
  const [feedTab, setFeedTab] = useState<'forYou' | 'following'>('forYou');
  const [reels, setReels] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [activeId, setActiveId] = useState('');
  const [commentPost, setCommentPost] = useState<any>(null);
  const [shareReel, setShareReel] = useState<any>(null);
  const [likesPost, setLikesPost] = useState<any>(null);
  const [toastReelId, setToastReelId] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));

  useEffect(() => {
    const q = query(collection(db, 'posts'), where('mediaType', '==', 'video'), orderBy('createdAt', 'desc'));
    const u1 = onSnapshot(q, (snap) => {
      let list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (startId) { const idx = list.findIndex((r) => r.id === startId); if (idx > 0) list = [list[idx], ...list.slice(0, idx), ...list.slice(idx + 1)]; }
      setReels(list);
      if (list[0] && !activeId) setActiveId(list[0].id);
    }, () => {});
    const u2 = onSnapshot(collection(db, 'users'), (snap) => {
      const m: Record<string, any> = {}; snap.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
      setUsersMap(m); if (uid && m[uid]) setMe(m[uid]);
    }, () => {});
    return () => { u1(); u2(); };
  }, [uid, startId]);

  const shownReels = feedTab === 'following' ? reels.filter((r) => Array.isArray(me?.following) && me.following.includes(r.uid)) : reels;
  const showRepostToast = (rid: string) => { setToastReelId(rid); if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => setToastReelId(null), 4000); };
  const undoRepost = async () => { if (!uid || !toastReelId) return; const r = toastReelId; setToastReelId(null); await updateDoc(doc(db, 'posts', r), { reposts: arrayRemove(uid), [`repostThoughts.${uid}`]: deleteField() }).catch(() => {}); };
  const onView = useRef(({ viewableItems }: any) => { if (viewableItems[0]?.item?.id) setActiveId(viewableItems[0].item.id); }).current;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={s.topTabs}>
        {(['forYou', 'following'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setFeedTab(t)} style={[s.topPill, feedTab === t && { backgroundColor: 'rgba(139,92,246,0.85)' }]}>
            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{t === 'forYou' ? 'For You' : 'Following'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <FlatList data={shownReels} pagingEnabled windowSize={3} maxToRenderPerBatch={2} showsVerticalScrollIndicator={false} keyExtractor={(i) => i.id} onViewableItemsChanged={onView} viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => <ReelItem item={item} active={item.id === activeId} focused={focused} me={me} owner={usersMap[item.uid]} onComment={() => setCommentPost(item)} onShare={() => setShareReel(item)} onLikes={() => setLikesPost(item)} onRepostToast={showRepostToast} />}
        ListEmptyComponent={<View style={s.empty}><Ionicons name="videocam-outline" size={48} color="#666" /><Text style={{ color: '#888', marginTop: 10 }}>No reels yet</Text></View>}
      />
      {!!toastReelId && (
        <View style={s.toast}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="repeat" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '600' }}>Reposted</Text></View>
          <TouchableOpacity onPress={undoRepost}><Text style={{ color: NEON.pink, fontWeight: '800' }}>Undo</Text></TouchableOpacity>
        </View>
      )}
      <CommentModal postId={commentPost?.id || null} post={commentPost} onClose={() => setCommentPost(null)} />
      <ShareModal post={shareReel} onClose={() => setShareReel(null)} />
      <LikesPlaysModal post={likesPost} onClose={() => setLikesPost(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  topTabs: { position: 'absolute', top: 46, alignSelf: 'center', flexDirection: 'row', gap: 8, backgroundColor: 'rgba(0,0,0,0.45)', padding: 4, borderRadius: 20, zIndex: 40 },
  topPill: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  reel: { height: H, backgroundColor: '#000', justifyContent: 'flex-end' },
  pauseIcon: { position: 'absolute', alignSelf: 'center', top: '45%', zIndex: 2 },
  rightCol: { position: 'absolute', right: 12, bottom: 30, alignItems: 'center', gap: 14, zIndex: 30, elevation: 30 },
  glossyPill: { width: 42, height: 42, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)', justifyContent: 'center', alignItems: 'center' },
  actBtn: { alignItems: 'center' },
  actTxt: { color: '#fff', fontSize: 11, fontWeight: '700', marginTop: 3, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
  bottomInfo: { padding: 14, paddingRight: 76, backgroundColor: 'rgba(0,0,0,0.28)', zIndex: 30, elevation: 30 },
  thoughtTrigger: { alignSelf: 'flex-start', alignItems: 'center', marginBottom: 10 },
  thoughtPill: { backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginBottom: 4, maxWidth: 180 },
  thoughtMiniAv: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#fff' },
  userAv: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#fff' },
  userTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  followPill: { borderWidth: 1, borderColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  capTxt: { color: '#fff', fontSize: 14, marginTop: 6 },
  addCommentBar: { marginTop: 10, backgroundColor: 'rgba(0,0,0,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  toast: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#1E1B2E', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 50, elevation: 50 },
  empty: { height: H, justifyContent: 'center', alignItems: 'center' },
});
