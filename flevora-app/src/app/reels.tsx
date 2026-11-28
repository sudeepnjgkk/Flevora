import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, Pressable, Image, Alert,
  StyleSheet, Dimensions, ActivityIndicator, AppState, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc,
  arrayUnion, arrayRemove, deleteField, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config';
import { CommentModal } from '../constants/CommentModal';
import { ShareModal } from '../constants/ShareModal';
import { LikesPlaysModal, RepostThoughtModal, ReelOptionsSheet } from '../constants/ReelModals';
import {
  AboutReelModal, AskFlevoraAIModal, AudioDetailModal, RemixSequenceModal,
  WhySeeingModal, NotInterestedModal, ReportReelModal,
} from '../constants/ReelMoreModals';
import { ReelInsightsModal, ReelOwnerEditModal } from '../constants/ReelsPart2Modals';
import { getAudioMeta, saveReelInterest } from '../constants/reelOptionsSystem';
import {
  canViewReelExtended, rankReelsForYou, recordDeduplicatedReelView, REEL_FILTERS,
} from '../constants/reelsSystem';
import { BRAND, NEON } from '../constants/theme';
import { AnimatedLikeButton } from '../constants/LikeComponents';
import { formatLikeCount, togglePostLike } from '../constants/likeSystem';
import { SaveButton, SaveCollectionSheet } from '../constants/SaveModals';
import { toggleSavePost } from '../constants/saveSystem';

const H = Dimensions.get('window').height - 56;

function ReelItem({
  item, active, focused, appActive, me, owner, autoScroll, onToggleAutoScroll, onNextReel,
  onComment, onShare, onLikes, onRepostToast, onSaveSheet, onOpenMoreModal, onInterested,
  onHideCreator, onArchiveReel, onDeleteReel,
}: any) {
  const router = useRouter();
  const uid = auth.currentUser?.uid || '';
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const [videoErr, setVideoErr] = useState(false);
  const [progressRatio, setProgressRatio] = useState(0);
  const [liked, setLiked] = useState(Array.isArray(item.likes) && item.likes.includes(uid));
  const [likeCount, setLikeCount] = useState(Array.isArray(item.likes) ? item.likes.length : 0);
  const [reposted, setReposted] = useState(Array.isArray(item.reposts) && item.reposts.includes(uid));
  const [repostCount, setRepostCount] = useState(Array.isArray(item.reposts) ? item.reposts.length : 0);
  const [saved, setSaved] = useState(Array.isArray(me?.savedPosts) && me.savedPosts.includes(item.id));
  const [thoughtOpen, setThoughtOpen] = useState(false);
  const [optOpen, setOptOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [captions, setCaptions] = useState(false);
  const [speed, setSpeed] = useState(item.playbackSpeed || 1);
  const [speedLocked, setSpeedLocked] = useState(false);
  const [holdHint, setHoldHint] = useState('');
  const [heartPop, setHeartPop] = useState(false);

  const lastTap = useRef(0);
  const tapTimer = useRef<any>(null);
  const holdTimer = useRef<any>(null);
  const startY = useRef(0);
  const lockedRef = useRef(false);
  const holdingRef = useRef(false);
  const viewedRef = useRef(false);

  const player = useVideoPlayer(item.mediaUrl, (p) => {
    p.loop = !autoScroll;
    p.preservesPitch = true;
    p.timeUpdateEventInterval = 0.5;
  });

  useEffect(() => {
    setLiked(Array.isArray(item.likes) && item.likes.includes(uid));
    setLikeCount(Array.isArray(item.likes) ? item.likes.length : 0);
    setReposted(Array.isArray(item.reposts) && item.reposts.includes(uid));
    setRepostCount(Array.isArray(item.reposts) ? item.reposts.length : 0);
  }, [item.likes, item.reposts, uid]);

  useEffect(() => {
    setSaved(Array.isArray(me?.savedPosts) && me.savedPosts.includes(item.id));
  }, [me?.savedPosts, item.id]);

  useEffect(() => {
    const s1 = player.addListener('statusChange', ({ status }) => {
      setBuffering(status === 'loading');
      setVideoErr(status === 'error');
    });
    const s2 = player.addListener('timeUpdate', ({ currentTime }) => {
      const dur = player.duration || item.duration || 1;
      setProgressRatio(Math.min(1, Math.max(0, currentTime / dur)));
      if (!viewedRef.current && currentTime >= 2 && active && focused && appActive) {
        viewedRef.current = true;
        recordDeduplicatedReelView(item.id, uid, item.uid);
      }
    });
    return () => { s1.remove(); s2.remove(); };
  }, [player, active, focused, appActive, item.id, item.uid, item.duration, uid]);

  useEffect(() => { if (!active) { setSpeed(item.playbackSpeed || 1); setSpeedLocked(false); } }, [active]);
  useEffect(() => { player.loop = !autoScroll; }, [autoScroll]);
  useEffect(() => { player.playbackRate = speed; }, [speed]);
  useEffect(() => { player.muted = muted; }, [muted]);
  useEffect(() => {
    if (!autoScroll || !active || !focused) return;
    const sub = player.addListener('playToEnd', () => onNextReel?.());
    return () => sub.remove();
  }, [autoScroll, active, focused]);

  useEffect(() => {
    if (focused && appActive && active && !paused) player.play();
    else player.pause();
  }, [focused, appActive, active, paused]);

  const isOwner = !!uid && item.uid === uid;
  const following = Array.isArray(me?.following) && me.following.includes(item.uid);
  const isInterested = Array.isArray(me?.interestedPosts) && me.interestedPosts.includes(item.id);
  const myThought = item.repostThoughts?.[uid] || '';
  const myAv = me?.photoUrl || me?.avatar || '';
  const ownerAv = owner?.photoUrl || owner?.avatar || item.avatar || '';
  const audioMeta = getAudioMeta(item, owner);
  const filterPreset = REEL_FILTERS.find((f) => f.name === item.filter);

  const triggerLike = (forceLike = false) => {
    if (forceLike) { setHeartPop(true); setTimeout(() => setHeartPop(false), 650); }
    const prevCount = likeCount;
    togglePostLike({
      post: { ...item, likes: liked ? [uid] : [] },
      myUid: uid,
      me,
      targetUser: owner,
      forceLike,
      onOptimistic: (nextLiked) => { setLiked(nextLiked); setLikeCount(Math.max(0, prevCount + (nextLiked ? 1 : -1))); },
      onRollback: (wasLiked) => { setLiked(wasLiked); setLikeCount(prevCount); },
    });
  };

  const handleCenterPress = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      lastTap.current = 0;
      triggerLike(true);
    } else {
      lastTap.current = now;
      tapTimer.current = setTimeout(() => setPaused((p) => !p), 270);
    }
  };

  const onEdgeStart = (e: any) => {
    startY.current = e.nativeEvent.pageY;
    holdingRef.current = false;
    holdTimer.current = setTimeout(() => {
      holdingRef.current = true;
      lockedRef.current = false;
      setSpeed(2);
      setHoldHint('2x Speed • Slide down to lock');
    }, 220);
  };

  const onEdgeMove = (e: any) => {
    if (!holdingRef.current) return;
    const dy = e.nativeEvent.pageY - startY.current;
    if (dy > 45) { lockedRef.current = true; setHoldHint('🔒 Release to lock 2x speed'); }
    else if (dy < -25) { lockedRef.current = false; setSpeed(1); setSpeedLocked(false); setHoldHint('1x Normal speed'); }
    else { lockedRef.current = false; setHoldHint('2x Speed • Slide down to lock'); }
  };

  const onEdgeEnd = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (holdingRef.current) {
      if (lockedRef.current) { setSpeed(2); setSpeedLocked(true); }
      else { setSpeed(1); setSpeedLocked(false); }
    }
    holdingRef.current = false;
    setHoldHint('');
  };

  const toggleRepost = async () => {
    if (!uid) return;
    if (item.allowRepost === false && !isOwner) return Alert.alert('Disabled', 'Reposting is turned off for this Reel.');
    const next = !reposted; setReposted(next); setRepostCount((c) => Math.max(0, c + (next ? 1 : -1)));
    try {
      if (next) { await updateDoc(doc(db, 'posts', item.id), { reposts: arrayUnion(uid) }); onRepostToast(item.id); }
      else await updateDoc(doc(db, 'posts', item.id), { reposts: arrayRemove(uid), [`repostThoughts.${uid}`]: deleteField() });
    } catch { setReposted(!next); setRepostCount((c) => Math.max(0, c + (next ? -1 : 1))); }
  };

  const saveThought = async (txt: string) => { setThoughtOpen(false); if (uid) await updateDoc(doc(db, 'posts', item.id), { [`repostThoughts.${uid}`]: txt || deleteField() }).catch(() => {}); };
  const deleteRepost = async () => { setThoughtOpen(false); if (!uid) return; setReposted(false); setRepostCount((c) => Math.max(0, c - 1)); await updateDoc(doc(db, 'posts', item.id), { reposts: arrayRemove(uid), [`repostThoughts.${uid}`]: deleteField() }).catch(() => {}); };
  const toggleSave = () => toggleSavePost({ postId: item.id, myUid: uid, me, onOptimistic: setSaved, onRollback: setSaved });
  const toggleFollow = async () => {
    if (!uid || uid === item.uid) return;
    await updateDoc(doc(db, 'users', uid), { following: following ? arrayRemove(item.uid) : arrayUnion(item.uid) }).catch(() => {});
    await updateDoc(doc(db, 'users', item.uid), { followers: following ? arrayRemove(uid) : arrayUnion(uid) }).catch(() => {});
  };

  const renderCaption = (txt: string) => (
    <Text style={s.capTxt} numberOfLines={2}>
      {txt.split(/([@#][a-zA-Z0-9._]+)/g).map((part, idx) =>
        part.startsWith('#') ? (
          <Text key={idx} style={{ color: BRAND, fontWeight: '700' }} onPress={() => router.navigate({ pathname: '/explore', params: { q: part } } as any)}>{part}</Text>
        ) : part.startsWith('@') ? (
          <Text key={idx} style={{ color: '#93C5FD', fontWeight: '700' }} onPress={() => router.navigate({ pathname: '/explore', params: { q: part.slice(1) } } as any)}>{part}</Text>
        ) : (
          <Text key={idx}>{part}</Text>
        )
      )}
    </Text>
  );
    return (
    <View style={s.reel}>
      <VideoView player={player} style={StyleSheet.absoluteFill} surfaceType="textureView" nativeControls={false} contentFit="cover" />
      {!!filterPreset && filterPreset.opacity > 0 && (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: filterPreset.tint, opacity: filterPreset.opacity }]} />
      )}
      <Pressable onPress={handleCenterPress} onLongPress={() => setOptOpen(true)} delayLongPress={400} style={[StyleSheet.absoluteFill, { zIndex: 1 }]} />
      <View onTouchStart={onEdgeStart} onTouchMove={onEdgeMove} onTouchEnd={onEdgeEnd} style={[s.edgeZone, { left: 0 }]} />
      <View onTouchStart={onEdgeStart} onTouchMove={onEdgeMove} onTouchEnd={onEdgeEnd} style={[s.edgeZone, { right: 0, bottom: 320 }]} />

      {buffering && !videoErr && <ActivityIndicator size="large" color={BRAND} style={s.centerIcon} />}
      {videoErr && (
        <View style={[s.centerIcon, { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.75)', padding: 16, borderRadius: 14 }]}>
          <Ionicons name="alert-circle-outline" size={34} color="#EF4444" />
          <Text style={{ color: '#fff', fontWeight: '700', marginTop: 6 }}>Video failed to load</Text>
          <TouchableOpacity onPress={() => { setVideoErr(false); setBuffering(true); player.replace(item.mediaUrl); }} style={{ marginTop: 8, backgroundColor: BRAND, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 }}>
            <Text style={{ color: '#111', fontWeight: '800' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
      {paused && !videoErr && <Ionicons name="play" size={56} color="rgba(255,255,255,0.85)" style={s.centerIcon} pointerEvents="none" />}
      {heartPop && <Ionicons name="heart" size={86} color="#EF4444" style={s.centerIcon} pointerEvents="none" />}
      {!!holdHint && <View style={s.hintPill}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{holdHint}</Text></View>}
      {speedLocked && !holdHint && (
        <TouchableOpacity onPress={() => { setSpeed(1); setSpeedLocked(false); }} style={s.hintPill}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>2x 🔒 Tap for 1x</Text>
        </TouchableOpacity>
      )}
      {captions && (!!item.captionsList?.[0]?.text || !!item.caption) && (
        <View style={s.ccBox}><Text style={{ color: '#fff', fontSize: 13 }}>{item.captionsList?.[0]?.text || item.caption}</Text></View>
      )}

      {!fullscreen && (
        <>
          <TouchableOpacity onPress={() => setMuted((m) => !m)} style={s.muteBtn}>
            <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={18} color="#fff" />
          </TouchableOpacity>

          <View style={s.bottomInfo} pointerEvents="box-none">
            {reposted && (
              <TouchableOpacity onPress={() => setThoughtOpen(true)} style={s.thoughtTrigger}>
                <View style={s.thoughtPill}><Text style={{ color: '#111', fontSize: 12, fontWeight: '700' }} numberOfLines={1}>{myThought || 'Tag a friend...'}</Text></View>
                {myAv ? <Image source={{ uri: myAv }} style={s.thoughtMiniAv} /> : <View style={[s.thoughtMiniAv, { backgroundColor: BRAND }]} />}
              </TouchableOpacity>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => router.push(`/user/${item.uid}` as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {ownerAv ? <Image source={{ uri: ownerAv }} style={s.userAv} /> : <View style={[s.userAv, { backgroundColor: BRAND }]} />}
                <Text style={s.userTxt}>@{owner?.username || item.username}</Text>
                {(owner?.isVerified || owner?.verified) && <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />}
              </TouchableOpacity>
              {item.uid !== uid && <TouchableOpacity onPress={toggleFollow} style={s.followPill}><Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>{following ? 'Following' : 'Follow'}</Text></TouchableOpacity>}
            </View>
            {!!item.caption && renderCaption(item.caption)}
            <TouchableOpacity onPress={() => onOpenMoreModal('audio', item)} style={s.audioPill}>
              <Ionicons name="musical-notes" size={13} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }} numberOfLines={1}>{audioMeta.title} • {audioMeta.artist}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onComment} style={s.addCommentBar}><Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{item.commentsDisabled ? 'Comments disabled' : 'Add comment...'}</Text></TouchableOpacity>
          </View>

          <View style={s.rightCol}>
            <View style={s.actBtn}>
              <AnimatedLikeButton liked={liked} onPress={() => triggerLike(false)} size={30} inactiveColor="#fff" />
              <TouchableOpacity onPress={onLikes} hitSlop={8}>
                <Text style={s.actTxt}>{item.hideLikeCount && !isOwner ? 'Likes' : formatLikeCount(likeCount)}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={onComment} style={s.actBtn} hitSlop={8}><Ionicons name="chatbubble-outline" size={28} color="#fff" /><Text style={s.actTxt}>{item.commentsCount || 0}</Text></TouchableOpacity>
            <TouchableOpacity onPress={toggleRepost} style={s.actBtn} hitSlop={8}><Ionicons name="repeat" size={29} color={reposted ? BRAND : '#fff'} /><Text style={s.actTxt}>{repostCount}</Text></TouchableOpacity>
            <View style={s.actBtn}><SaveButton saved={saved} size={27} color="#fff" onPress={toggleSave} onLongPress={onSaveSheet} /></View>
            <TouchableOpacity onPress={onShare} style={s.actBtn} hitSlop={8}><Ionicons name="paper-plane-outline" size={26} color="#fff" /></TouchableOpacity>
            <TouchableOpacity onPress={() => setOptOpen(true)} style={s.actBtn} hitSlop={10}><Ionicons name="ellipsis-vertical" size={23} color="#fff" /></TouchableOpacity>
          </View>

          <View style={s.progTrack}>
            <View style={[s.progFill, { width: `${Math.round(progressRatio * 100)}%` }]} />
          </View>
        </>
      )}

      <RepostThoughtModal visible={thoughtOpen} avatar={myAv} initialText={myThought} onSave={saveThought} onDelete={deleteRepost} onClose={() => setThoughtOpen(false)} />
      <ReelOptionsSheet
        visible={optOpen}
        onClose={() => setOptOpen(false)}
        isOwner={isOwner}
        isArchived={Boolean(item.isArchived)}
        fullscreen={fullscreen}
        onToggleFullscreen={() => setFullscreen((f) => !f)}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        muted={muted}
        onToggleMute={() => setMuted((m) => !m)}
        speed={speed}
        onChangeSpeed={(sp: number) => { setSpeed(sp); setSpeedLocked(sp !== 1); }}
        autoScroll={autoScroll}
        onToggleAutoScroll={onToggleAutoScroll}
        captions={captions}
        onToggleCaptions={() => setCaptions((c) => !c)}
        isInterested={isInterested}
        onOpenAbout={() => onOpenMoreModal('about', item)}
        onOpenAskAI={() => onOpenMoreModal('ai', item)}
        onOpenAudio={() => onOpenMoreModal('audio', item)}
        onOpenRemix={() => onOpenMoreModal('remix', item)}
        onCopyLink={() => Share.share({ message: `flevora://reels?startId=${item.id}` })}
        onOpenWhy={() => onOpenMoreModal('why', item)}
        onInterested={() => onInterested(item)}
        onNotInterested={() => onOpenMoreModal('notInterested', item)}
        onHideCreator={() => onHideCreator(item.uid)}
        onEditReel={() => onOpenMoreModal('edit', item)}
        onInsights={() => onOpenMoreModal('insights', item)}
        onArchive={() => onArchiveReel(item)}
        onDelete={() => onDeleteReel(item)}
        onReport={() => onOpenMoreModal('report', item)}
      />
    </View>
  );
}

export default function ReelsScreen() {
  const { startId } = useLocalSearchParams<{ startId?: string }>();
  const uid = auth.currentUser?.uid || '';
  const listRef = useRef<FlatList>(null);
  const [focused, setFocused] = useState(true);
  const [appActive, setAppActive] = useState(true);
  const [autoScroll, setAutoScroll] = useState(false);
  const [feedTab, setFeedTab] = useState<'forYou' | 'following'>('forYou');
  const [reels, setReels] = useState<any[]>([]);
  const [me, setMe] = useState<any>(null);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [activeId, setActiveId] = useState('');
  const [commentPost, setCommentPost] = useState<any>(null);
  const [shareReel, setShareReel] = useState<any>(null);
  const [likesPost, setLikesPost] = useState<any>(null);
  const [saveTarget, setSaveTarget] = useState<any>(null);
  const [moreModal, setMoreModal] = useState<{ type: string; reel: any } | null>(null);
  const [toastReelId, setToastReelId] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => setAppActive(st === 'active'));
    return () => sub.remove();
  }, []);

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

  const hiddenIds = new Set(Array.isArray(me?.notInterestedPosts) ? me.notInterestedPosts : []);
  const shownReels = useMemo(() => {
    const filtered = reels.filter((r) => {
      if (hiddenIds.has(r.id)) return false;
      if (!canViewReelExtended(r, usersMap[r.uid], me, uid)) return false;
      if (feedTab === 'following') return Array.isArray(me?.following) && me.following.includes(r.uid);
      return true;
    });
    if (feedTab === 'forYou' && !startId) return rankReelsForYou(filtered, me);
    return filtered;
  }, [reels, usersMap, me, uid, feedTab, startId]);

  const goNext = (curId: string) => {
    const idx = shownReels.findIndex((r) => r.id === curId);
    if (idx >= 0 && idx + 1 < shownReels.length) listRef.current?.scrollToIndex({ index: idx + 1, animated: true });
  };
  const showRepostToast = (rid: string) => { setToastReelId(rid); if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => setToastReelId(null), 4000); };
  const undoRepost = async () => { if (!uid || !toastReelId) return; const r = toastReelId; setToastReelId(null); await updateDoc(doc(db, 'posts', r), { reposts: arrayRemove(uid), [`repostThoughts.${uid}`]: deleteField() }).catch(() => {}); };
  const onView = useRef(({ viewableItems }: any) => { if (viewableItems[0]?.item?.id) setActiveId(viewableItems[0].item.id); }).current;

  const handleInterested = async (reel: any) => {
    try {
      const res = await saveReelInterest({ reel, myUid: uid, me, interested: true });
      Alert.alert('Preference Saved', res.alreadyMarked ? 'Already marked as Interested.' : 'We will show more Reels like this.');
    } catch (e: any) { Alert.alert('Error', e?.message || 'Could not save preference.'); }
  };

  const handleNotInterested = async (reason: string) => {
    if (!moreModal?.reel) return;
    try {
      await saveReelInterest({ reel: moreModal.reel, myUid: uid, me, interested: false, reason });
      goNext(moreModal.reel.id);
      Alert.alert('Feedback Recorded', 'We will show fewer Reels like this.');
    } catch (e: any) { Alert.alert('Error', e?.message || 'Could not record feedback.'); }
  };

  const handleHideCreator = async (targetUid: string) => {
    if (!uid || !targetUid || targetUid === uid) return;
    await updateDoc(doc(db, 'users', uid), { hiddenCreators: arrayUnion(targetUid) }).catch(() => {});
    Alert.alert('Creator Hidden', 'Reels from this creator are hidden.');
  };

  const handleArchiveReel = async (reel: any) => {
    await updateDoc(doc(db, 'posts', reel.id), { isArchived: !reel.isArchived, updatedAt: serverTimestamp() }).catch(() => {});
    Alert.alert(reel.isArchived ? 'Restored' : 'Archived', reel.isArchived ? 'Reel restored to feed.' : 'Reel moved to your private Archive.');
  };

  const handleDeleteReel = (reel: any) => {
    Alert.alert('Delete Reel?', 'This permanently removes the Reel from Flevora.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDoc(doc(db, 'posts', reel.id)).catch(() => Alert.alert('Error', 'Could not delete Reel.')) },
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <View style={s.topTabs}>
        {(['forYou', 'following'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setFeedTab(t)} style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: feedTab === t ? '#fff' : 'rgba(255,255,255,0.6)', fontWeight: '800', fontSize: 15 }}>{t === 'forYou' ? 'For You' : 'Following'}</Text>
            {feedTab === t && <View style={{ height: 2, backgroundColor: BRAND, marginTop: 3, borderRadius: 1 }} />}
          </TouchableOpacity>
        ))}
      </View>
      <FlatList ref={listRef} data={shownReels} pagingEnabled windowSize={3} maxToRenderPerBatch={2} showsVerticalScrollIndicator={false} keyExtractor={(i) => i.id} onViewableItemsChanged={onView} viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <ReelItem
            item={item} active={item.id === activeId} focused={focused} appActive={appActive}
            me={me} owner={usersMap[item.uid]} autoScroll={autoScroll}
            onToggleAutoScroll={() => setAutoScroll((v) => !v)} onNextReel={() => goNext(item.id)}
            onComment={() => setCommentPost(item)} onShare={() => setShareReel(item)} onLikes={() => setLikesPost(item)}
            onRepostToast={showRepostToast} onSaveSheet={() => setSaveTarget(item)}
            onOpenMoreModal={(type: string, reel: any) => setMoreModal({ type, reel })}
            onInterested={handleInterested} onHideCreator={handleHideCreator}
            onArchiveReel={handleArchiveReel} onDeleteReel={handleDeleteReel}
          />
        )}
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
      <SaveCollectionSheet visible={!!saveTarget} post={saveTarget} myUid={uid} me={me} onClose={() => setSaveTarget(null)} />
      <AboutReelModal visible={moreModal?.type === 'about'} reel={moreModal?.reel} owner={usersMap[moreModal?.reel?.uid]} onClose={() => setMoreModal(null)} />
      <AskFlevoraAIModal visible={moreModal?.type === 'ai'} reel={moreModal?.reel} onClose={() => setMoreModal(null)} />
      <AudioDetailModal visible={moreModal?.type === 'audio'} reel={moreModal?.reel} owner={usersMap[moreModal?.reel?.uid]} me={me} myUid={uid} usersMap={usersMap} onSelectReel={(rid: string) => { const idx = shownReels.findIndex((r) => r.id === rid); if (idx >= 0) listRef.current?.scrollToIndex({ index: idx, animated: true }); }} onClose={() => setMoreModal(null)} />
      <RemixSequenceModal visible={moreModal?.type === 'remix'} reel={moreModal?.reel} owner={usersMap[moreModal?.reel?.uid]} me={me} myUid={uid} onClose={() => setMoreModal(null)} />
      <WhySeeingModal visible={moreModal?.type === 'why'} reel={moreModal?.reel} owner={usersMap[moreModal?.reel?.uid]} me={me} feedTab={feedTab} onClose={() => setMoreModal(null)} />
      <NotInterestedModal visible={moreModal?.type === 'notInterested'} onSubmit={handleNotInterested} onClose={() => setMoreModal(null)} />
      <ReportReelModal visible={moreModal?.type === 'report'} reel={moreModal?.reel} myUid={uid} onClose={() => setMoreModal(null)} />
      <ReelOwnerEditModal visible={moreModal?.type === 'edit'} reel={moreModal?.reel} onClose={() => setMoreModal(null)} />
      <ReelInsightsModal visible={moreModal?.type === 'insights'} reel={moreModal?.reel} onClose={() => setMoreModal(null)} />
    </View>
  );
}

const s = StyleSheet.create({
  topTabs: { position: 'absolute', top: 46, alignSelf: 'center', flexDirection: 'row', gap: 14, zIndex: 40 },
  reel: { height: H, backgroundColor: '#000', justifyContent: 'flex-end' },
  edgeZone: { position: 'absolute', top: 90, bottom: 160, width: 52, zIndex: 10 },
  centerIcon: { position: 'absolute', alignSelf: 'center', top: '44%', zIndex: 15 },
  muteBtn: { position: 'absolute', top: 48, right: 14, backgroundColor: 'rgba(0,0,0,0.45)', padding: 8, borderRadius: 18, zIndex: 40 },
  hintPill: { position: 'absolute', bottom: 150, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, zIndex: 45 },
  ccBox: { position: 'absolute', bottom: 180, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.75)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, maxWidth: '80%', zIndex: 25 },
  rightCol: { position: 'absolute', right: 12, bottom: 26, alignItems: 'center', gap: 16, zIndex: 40, elevation: 40 },
  actBtn: { alignItems: 'center' },
  actTxt: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 2, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 3 },
  bottomInfo: { padding: 14, paddingRight: 74, zIndex: 25, elevation: 25 },
  thoughtTrigger: { alignSelf: 'flex-start', alignItems: 'center', marginBottom: 8 },
  thoughtPill: { backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, marginBottom: 4, maxWidth: 180 },
  thoughtMiniAv: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: '#fff' },
  userAv: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#fff' },
  userTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  followPill: { borderWidth: 1, borderColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3 },
  capTxt: { color: '#fff', fontSize: 14, marginTop: 6 },
  audioPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, backgroundColor: 'rgba(0,0,0,0.45)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, maxWidth: '85%' },
  addCommentBar: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  progTrack: { height: 2.5, backgroundColor: 'rgba(255,255,255,0.25)', width: '100%', zIndex: 35 },
  progFill: { height: 2.5, backgroundColor: BRAND },
  toast: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: '#262626', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 50, elevation: 50 },
  empty: { height: H, justifyContent: 'center', alignItems: 'center' },
});
