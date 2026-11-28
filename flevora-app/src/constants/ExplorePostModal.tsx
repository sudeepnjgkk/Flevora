import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Image, ScrollView, StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { CommentModal } from './CommentModal';
import { ShareModal } from './ShareModal';
import { canViewPost, toggleFollowUser } from './searchHelpers';
import { AnimatedLikeButton, DoubleTapHeartOverlay } from './LikeComponents';
import { formatLikesLabel, togglePostLike } from './likeSystem';
import { RepostButton, RepostSheetModal, RepostersModal } from './RepostModals';
import { saveRepostThought, toggleRepost } from './repostSystem';
import { SaveButton, SaveCollectionSheet } from './SaveModals';
import { toggleSavePost } from './saveSystem';

const W = Dimensions.get('window').width;

function ModalVideo({ uri, onDoubleTap }: { uri: string; onDoubleTap: () => void }) {
  const [paused, setPaused] = useState(false);
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.play(); });
  return (
    <DoubleTapHeartOverlay
      onDoubleTap={onDoubleTap}
      onSingleTap={() => {
        if (paused) { player.play(); setPaused(false); }
        else { player.pause(); setPaused(true); }
      }}
    >
      <VideoView player={player} style={styles.media} nativeControls={false} contentFit="cover" />
      {paused && (
        <View style={styles.playOverlay}>
          <Ionicons name="play" size={44} color="#fff" />
        </View>
      )}
    </DoubleTapHeartOverlay>
  );
}

type Props = {
  post: any | null;
  author: any | null;
  me: any | null;
  onClose: () => void;
  onPressTag: (tag: string) => void;
  onPressPlace: (place: string) => void;
};

export function ExplorePostModal({ post, author, me, onClose, onPressTag, onPressPlace }: Props) {
  const { c } = useTheme();
  const router = useRouter();
  const myUid = auth.currentUser?.uid || '';
  const [livePost, setLivePost] = useState<any>(post);
  const [liveAuthor, setLiveAuthor] = useState<any>(author);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [commentPostId, setCommentPostId] = useState<string | null>(null);
  const [sharePost, setSharePost] = useState<any | null>(null);
  const [repostOpen, setRepostOpen] = useState(false);
  const [repostersOpen, setRepostersOpen] = useState(false);
  const [saveColOpen, setSaveColOpen] = useState(false);

  useEffect(() => {
    if (!post) { setLivePost(null); setBlockedMsg(null); return; }
    setLivePost(post);
    setLiveAuthor(author);
    setBlockedMsg(null);
    let active = true;
    (async () => {
      try {
        const pSnap = await getDoc(doc(db, 'posts', post.id));
        if (!active) return;
        if (!pSnap.exists()) { setBlockedMsg('This post is no longer available.'); return; }
        const pData = { id: pSnap.id, ...pSnap.data() };
        const aSnap = await getDoc(doc(db, 'users', pData.uid || post.uid));
        const aData = aSnap.exists() ? { id: aSnap.id, ...aSnap.data() } : author;
        if (!active) return;
        if (!canViewPost(pData, aData, me, myUid)) {
          setBlockedMsg('You do not have permission to view this post.');
          return;
        }
        setLivePost(pData);
        setLiveAuthor(aData);
      } catch {}
    })();
    return () => { active = false; };
  }, [post?.id]);

  if (!post) return null;

  const p = livePost || post;
  const liked = Array.isArray(p.likes) && p.likes.includes(myUid);
  const reposted = Array.isArray(p.reposts) && p.reposts.includes(myUid);
  const saved = Array.isArray(me?.savedPosts) && me.savedPosts.includes(p.id);
  const isFollowing = Array.isArray(me?.following) && me.following.includes(p.uid);
  const mediaList: string[] = Array.isArray(p.media) && p.media.length > 0 ? p.media : (p.mediaUrl ? [p.mediaUrl] : []);

  const triggerLike = (forceLike = false) => {
    const prevLikes: string[] = Array.isArray(p.likes) ? p.likes : [];
    togglePostLike({
      post: p, myUid, me, targetUser: liveAuthor, forceLike,
      onOptimistic: (nextLiked) => setLivePost({ ...p, likes: nextLiked ? Array.from(new Set([...prevLikes, myUid])) : prevLikes.filter((x) => x !== myUid) }),
      onRollback: () => setLivePost({ ...p, likes: prevLikes }),
    });
  };

  const renderCaptionWithTags = (caption: string) => {
    const parts = caption.split(/(#\w+)/g);
    return (
      <Text style={{ color: c.text, lineHeight: 20 }}>
        <Text style={{ fontWeight: '700' }}>@{p.username} </Text>
        {parts.map((part, idx) =>
          part.startsWith('#') ? (
            <Text key={idx} style={{ color: BRAND, fontWeight: '600' }} onPress={() => { onClose(); onPressTag(part.toLowerCase()); }}>
              {part}
            </Text>
          ) : (
            <Text key={idx}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  return (
    <Modal visible={!!post} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: c.background }]}>
        <View style={[styles.topBar, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.topTitle, { color: c.text }]}>{p.mediaType === 'video' ? 'Reel' : 'Post'}</Text>
          <View style={{ width: 32 }} />
        </View>

        {blockedMsg ? (
          <View style={styles.center}>
            <Ionicons name="lock-closed-outline" size={44} color={c.muted} />
            <Text style={{ color: c.text, fontWeight: '700', marginTop: 10 }}>{blockedMsg}</Text>
          </View>
        ) : (
          <ScrollView>
            <View style={styles.authorRow}>
              <TouchableOpacity style={styles.authorLeft} onPress={() => { onClose(); router.navigate(`/user/${p.uid}` as any); }}>
                {liveAuthor?.avatar || p.userAvatar ? (
                  <Image source={{ uri: liveAuthor?.avatar || p.userAvatar }} style={styles.av} />
                ) : (
                  <View style={[styles.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: BRAND_TEXT, fontWeight: '700' }}>{(p.username || 'U')[0].toUpperCase()}</Text>
                  </View>
                )}
                <View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>@{p.username}</Text>
                    {(liveAuthor?.isVerified || liveAuthor?.verified) && <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />}
                  </View>
                  {!!p.location && (
                    <TouchableOpacity onPress={() => { onClose(); onPressPlace(p.location); }}>
                      <Text style={{ color: c.muted, fontSize: 12 }}>{p.location}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
              {p.uid !== myUid && liveAuthor && (
                <TouchableOpacity onPress={() => toggleFollowUser(liveAuthor, me, myUid)} style={[styles.followBtn, { backgroundColor: isFollowing ? c.input : BRAND }]}>
                  <Text style={{ color: isFollowing ? c.text : BRAND_TEXT, fontWeight: '700', fontSize: 12 }}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {p.mediaType === 'video' && mediaList[0] ? (
              <ModalVideo uri={mediaList[0]} onDoubleTap={() => triggerLike(true)} />
            ) : mediaList.length > 1 ? (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
                {mediaList.map((uri, i) => (
                  <DoubleTapHeartOverlay key={i} onDoubleTap={() => triggerLike(true)}>
                    <Image source={{ uri }} style={styles.media} resizeMode="cover" />
                  </DoubleTapHeartOverlay>
                ))}
              </ScrollView>
            ) : mediaList[0] ? (
              <DoubleTapHeartOverlay onDoubleTap={() => triggerLike(true)}>
                <Image source={{ uri: mediaList[0] }} style={styles.media} resizeMode="cover" />
              </DoubleTapHeartOverlay>
            ) : (
              <View style={[styles.media, { backgroundColor: c.input, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="image-outline" size={40} color={c.muted} />
              </View>
            )}

            <View style={styles.actions}>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <AnimatedLikeButton liked={liked} onPress={() => triggerLike(false)} />
                <TouchableOpacity onPress={() => setCommentPostId(p.id)}>
                  <Ionicons name="chatbubble-outline" size={24} color={c.text} />
                </TouchableOpacity>
                <RepostButton reposted={reposted} count={p.reposts?.length || 0} onPress={() => setRepostOpen(true)} onLongPressCount={() => setRepostersOpen(true)} />
                <TouchableOpacity onPress={() => setSharePost(p)}>
                  <Ionicons name="paper-plane-outline" size={24} color={c.text} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                {p.mediaType === 'video' && (
                  <TouchableOpacity
                    onPress={() => { onClose(); router.navigate({ pathname: '/reels', params: { postId: p.id } } as any); }}
                    style={[styles.reelJump, { backgroundColor: BRAND }]}
                  >
                    <Ionicons name="play" size={13} color={BRAND_TEXT} />
                    <Text style={{ color: BRAND_TEXT, fontSize: 12, fontWeight: '700' }}>Reels</Text>
                  </TouchableOpacity>
                )}
                <SaveButton
                  saved={saved}
                  onPress={() => toggleSavePost({ postId: p.id, myUid, me })}
                  onLongPress={() => setSaveColOpen(true)}
                />
              </View>
            </View>

            <View style={{ paddingHorizontal: 14, paddingBottom: 24, gap: 6 }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>
                {formatLikesLabel(Array.isArray(p.likes) ? p.likes.length : 0)}
              </Text>
              {!!p.repostThoughts?.[myUid] && (
                <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '600' }}>Your thought: "{p.repostThoughts[myUid]}"</Text>
              )}
              {!!p.caption && renderCaptionWithTags(p.caption)}
            </View>
          </ScrollView>
        )}

        <CommentModal postId={commentPostId} post={p} onClose={() => setCommentPostId(null)} />
        <ShareModal post={sharePost} onClose={() => setSharePost(null)} />
        <RepostSheetModal
          visible={repostOpen} post={p} myUid={myUid} onClose={() => setRepostOpen(false)}
          onRepost={(th) => toggleRepost({ post: p, myUid, me, owner: liveAuthor, thought: th, onOptimistic: (rep, t) => setLivePost({ ...p, reposts: rep ? [...(p.reposts || []), myUid] : (p.reposts || []).filter((x: string) => x !== myUid), repostThoughts: { ...(p.repostThoughts || {}), [myUid]: t } }) })}
          onSaveThought={(th) => saveRepostThought(p.id, myUid, th)}
          onRemoveRepost={() => toggleRepost({ post: p, myUid, me, forceRemove: true, onOptimistic: () => setLivePost({ ...p, reposts: (p.reposts || []).filter((x: string) => x !== myUid) }) })}
          onOpenReposters={() => setRepostersOpen(true)}
        />
        <RepostersModal visible={repostersOpen} uids={p.reposts || []} me={me} myUid={myUid} onClose={() => setRepostersOpen(false)} />
        <SaveCollectionSheet visible={saveColOpen} post={p} myUid={myUid} me={me} onClose={() => setSaveColOpen(false)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 42 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1 },
  topTitle: { fontSize: 16, fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  authorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  authorLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  av: { width: 38, height: 38, borderRadius: 19 },
  followBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  media: { width: W, height: W * 1.1 },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  reelJump: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
});
