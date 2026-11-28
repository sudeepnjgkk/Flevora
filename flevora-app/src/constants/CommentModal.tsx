import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, TextInput, FlatList, Image,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import {
  collection, query, orderBy, limit, onSnapshot, addDoc, doc, getDoc, getDocs,
  updateDoc, deleteDoc, arrayUnion, arrayRemove, increment, serverTimestamp, where,
} from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { sendNotification } from './notify';
import { AnimatedLikeButton } from './LikeComponents';
import { CommentActionMenu, CommentLikesModal, CommentReportModal, CommentSettingsModal } from './CommentExtras';

const EMOJIS = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];
const CLOUD = 'faqfo0lu';
const PRESET = 'flevora_upload';

const relTime = (ts: any) => {
  const d = ts?.toDate ? ts.toDate() : typeof ts === 'number' ? new Date(ts) : null;
  if (!d) return 'now';
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  return m < 1 ? 'now' : m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`;
};

const getMs = (ts: any) => (ts?.toMillis ? ts.toMillis() : typeof ts === 'number' ? ts : Date.now());

const CommentItemRow = memo(function CommentItemRow({
  item, u, uid, c, expanded, onToggleExpand, onReply, onMenu, onLike, onOpenLikes, onOpenUser,
}: any) {
  const liked = (item.likes || []).includes(uid);
  const reps: any[] = Array.isArray(item.replies) ? item.replies : [];
  const showAll = !!expanded;
  const shownReps = showAll ? reps : reps.slice(0, 2);

  const renderText = (txt: string) =>
    txt.split(/(@[a-zA-Z0-9._]+)/g).map((part, i) =>
      part.startsWith('@') ? (
        <Text key={i} style={{ color: BRAND, fontWeight: '700' }} onPress={() => onOpenUser(part.slice(1).toLowerCase(), true)}>
          {part}
        </Text>
      ) : (
        <Text key={i}>{part}</Text>
      )
    );

  return (
    <View style={s.cmtWrap}>
      <TouchableOpacity style={s.cmtRow} onLongPress={() => onMenu(item)} activeOpacity={0.9}>
        <TouchableOpacity onPress={() => onOpenUser(item.uid)}>
          {u?.photoUrl || u?.avatar ? (
            <Image source={{ uri: u.photoUrl || u.avatar }} style={s.av} />
          ) : (
            <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={16} color={BRAND_TEXT} />
            </View>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <TouchableOpacity onPress={() => onOpenUser(item.uid)}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 13 }}>@{item.username}</Text>
            </TouchableOpacity>
            {(u?.isVerified || u?.verified) && <Ionicons name="checkmark-circle" size={13} color="#3B82F6" />}
            <Text style={{ color: c.muted, fontSize: 11 }}>{relTime(item.createdAt)}</Text>
            {item.isPinned && <Text style={{ color: BRAND, fontSize: 10, fontWeight: '800' }}>Pinned</Text>}
            {!!item.editedAt && <Text style={{ color: c.muted, fontSize: 10 }}>(edited)</Text>}
          </View>
          {!!item.text && <Text style={{ color: c.text, fontSize: 14, marginTop: 2 }}>{renderText(item.text)}</Text>}
          {!!item.mediaUrl && <Image source={{ uri: item.mediaUrl }} style={s.cmtImg} />}
          <View style={{ flexDirection: 'row', gap: 14, marginTop: 4 }}>
            <TouchableOpacity onPress={() => onReply(item)}><Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>Reply</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => onMenu(item)}><Text style={{ color: c.muted, fontSize: 12 }}>More</Text></TouchableOpacity>
          </View>
        </View>
        <View style={{ alignItems: 'center', paddingLeft: 8 }}>
          <AnimatedLikeButton liked={liked} size={17} inactiveColor={c.muted} onPress={() => onLike(item)} />
          {!!item.likes?.length && (
            <TouchableOpacity onPress={() => onOpenLikes(item.likes)}>
              <Text style={{ color: c.muted, fontSize: 11 }}>{item.likes.length}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>

      {shownReps.map((r) => {
        const rLiked = (r.likes || []).includes(uid);
        return (
          <View key={r.id} style={s.repRow}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontSize: 13 }}>
                <Text style={{ fontWeight: '800' }} onPress={() => onOpenUser(r.uid)}>@{r.username} </Text>
                {renderText(r.text || '')}{' '}
                <Text style={{ color: c.muted, fontSize: 10 }}>{relTime(r.createdAt)}{r.editedAt ? ' (edited)' : ''}</Text>
              </Text>
            </View>
            <View style={{ paddingHorizontal: 6 }}>
              <AnimatedLikeButton liked={rLiked} size={14} inactiveColor={c.muted} onPress={() => onLike(r, item)} />
            </View>
            <TouchableOpacity onPress={() => onMenu({ ...r, isReply: true, parent: item, commentId: item.id })}>
              <Ionicons name="ellipsis-horizontal" size={14} color={c.muted} />
            </TouchableOpacity>
          </View>
        );
      })}

      {reps.length > 2 && (
        <TouchableOpacity onPress={() => onToggleExpand(item.id)} style={{ marginLeft: 44, marginTop: 4 }}>
          <Text style={{ color: BRAND, fontSize: 12, fontWeight: '700' }}>
            {showAll ? 'Hide replies' : `View all ${reps.length} replies`}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
});
export function CommentModal({ postId, post, onClose }: { postId: string | null; post?: any; onClose: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const uid = auth.currentUser?.uid || '';

  const [comments, setComments] = useState<any[]>([]);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [lim, setLim] = useState(25);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [err, setErr] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [replyParent, setReplyParent] = useState<any>(null);
  const [editTarget, setEditTarget] = useState<any>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showHidden, setShowHidden] = useState(false);
  const [menuTarget, setMenuTarget] = useState<any>(null);
  const [reportTarget, setReportTarget] = useState<any>(null);
  const [likesUids, setLikesUids] = useState<string[] | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const loadedPostRef = useRef<string | null>(null);

  // One-time bounded user fetch (no live users listener = zero random re-renders!)
  useEffect(() => {
    if (!postId) return;
    getDocs(query(collection(db, 'users'), limit(50))).then((snap) => {
      const m: Record<string, any> = {};
      snap.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
      setUsersMap(m);
    }).catch(() => {});
    if (uid) {
      getDoc(doc(db, 'users', uid)).then((s) => {
        if (s.exists()) setUsersMap((prev) => ({ ...prev, [s.id]: { id: s.id, ...s.data() } }));
      }).catch(() => {});
    }
  }, [postId, uid]);

  // Single stable listener: initialLoading runs ONLY when postId changes, NEVER on pagination or updates!
  useEffect(() => {
    if (!postId) {
      setComments([]);
      setReplyParent(null);
      setEditTarget(null);
      loadedPostRef.current = null;
      return;
    }
    if (loadedPostRef.current !== postId) {
      setInitialLoading(true);
      setLim(25);
      loadedPostRef.current = postId;
    }
    setErr(false);
    const unsub = onSnapshot(
      query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc'), limit(lim)),
      (s) => {
        setComments(s.docs.map((d) => ({ id: d.id, ...d.data() })));
        setInitialLoading(false);
        setLoadingMore(false);
      },
      () => {
        setErr(true);
        setInitialLoading(false);
        setLoadingMore(false);
      }
    );
    return () => unsub();
  }, [postId, lim]);

  const me = usersMap[uid] || {};
  const owner = usersMap[post?.uid] || {};
  const isPostOwner = !!uid && post?.uid === uid;
  const blocked = (me.blockedUsers || []).includes(post?.uid) || (owner.blockedUsers || []).includes(uid);
  const policy = post?.commentsDisabled ? 'off' : (post?.commentPolicy || 'everyone');
  const canComment = !blocked && (isPostOwner || policy === 'everyone' || (policy === 'followers' && (owner.followers || []).includes(uid)) || (policy === 'following' && (owner.following || []).includes(uid)));

  const mentionMatch = text.match(/@([a-zA-Z0-9._]*)$/);
  const mentionSuggestions = useMemo(() => {
    if (!mentionMatch) return [];
    const q = mentionMatch[1].toLowerCase();
    return Object.values(usersMap).filter((u: any) => u.id !== uid && !(me.blockedUsers || []).includes(u.id) && (u.username || '').toLowerCase().includes(q)).slice(0, 5);
  }, [text, usersMap, uid, me.blockedUsers]);

  const visibleComments = useMemo(() => {
    const filtered = comments.filter((cm) => {
      if ((me.blockedUsers || []).includes(cm.uid) || (usersMap[cm.uid]?.blockedUsers || []).includes(uid)) return false;
      if (cm.isHidden && !isPostOwner) return false;
      if (cm.isHidden && isPostOwner && !showHidden) return false;
            if (Array.isArray(me.hiddenWords) && me.hiddenWords.some((w: string) => w && (cm.text || '').toLowerCase().includes(w.toLowerCase()))) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const pinDiff = (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0);
      return pinDiff !== 0 ? pinDiff : getMs(a.createdAt) - getMs(b.createdAt);
    });
  }, [comments, me.blockedUsers, usersMap, uid, isPostOwner, showHidden]);

  const submit = async (customText?: string, mediaUrl = '') => {
    const body = (customText ?? text).trim();
    if (!postId || !uid || sending || (!body && !mediaUrl) || body.length > 2200) return;
    if (!canComment && !editTarget) return Alert.alert('Restricted', 'Comments are restricted on this post.');
    setSending(true);
    const savedDraft = text;
    try {
      const uname = me.username || 'user';
      if (editTarget) {
        if (editTarget.isReply) {
          const nextReplies = (editTarget.parent.replies || []).map((r: any) => (r.id === editTarget.id ? { ...r, text: body, editedAt: Date.now() } : r));
          await updateDoc(doc(db, 'posts', postId, 'comments', editTarget.parent.id), { replies: nextReplies });
        } else {
          await updateDoc(doc(db, 'posts', postId, 'comments', editTarget.id), { text: body, editedAt: serverTimestamp() });
        }
        setEditTarget(null); setText('');
      } else if (replyParent) {
        const rep = { id: `r_${Date.now()}`, uid, username: uname, text: body, likes: [], createdAt: Date.now() };
        await updateDoc(doc(db, 'posts', postId, 'comments', replyParent.id), { replies: arrayUnion(rep) });
        sendNotification({ toUid: replyParent.uid, fromUid: uid, fromUsername: uname, type: 'reply', message: `replied: ${body.slice(0, 60)}`, postId, commentId: replyParent.id });
        setReplyParent(null); setText('');
      } else {
        setText('');
        const ref = await addDoc(collection(db, 'posts', postId, 'comments'), { uid, username: uname, text: body, mediaUrl, likes: [], replies: [], isPinned: false, isHidden: false, createdAt: serverTimestamp() });
        updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) }).catch(() => {});
        if (post?.uid) sendNotification({ toUid: post.uid, fromUid: uid, fromUsername: uname, type: 'comment', message: `commented: ${body.slice(0, 60) || 'Photo'}`, postId, commentId: ref.id });
      }
      const seen = new Set<string>();
      (body.match(/@[a-zA-Z0-9._]+/g) || []).forEach((m) => {
        const target = Object.values(usersMap).find((u: any) => (u.username || '').toLowerCase() === m.slice(1).toLowerCase());
        if (target && !seen.has(target.id)) {
          seen.add(target.id);
          sendNotification({ toUid: target.id, fromUid: uid, fromUsername: uname, type: 'mention', message: `mentioned you in a comment: ${body.slice(0, 50)}`, postId });
        }
      });
    } catch {
      setText(savedDraft);
      Alert.alert('Failed', 'Could not post comment. Please retry.');
    } finally {
      setSending(false);
    }
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.65 });
    if (res.canceled || !res.assets[0]) return;
    const data = new FormData();
    data.append('file', { uri: res.assets[0].uri, type: 'image/jpeg', name: `c_${Date.now()}.jpg` } as any);
    data.append('upload_preset', PRESET);
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: 'POST', body: data });
    const j = await r.json();
    if (j.secure_url) submit('', j.secure_url);
  };

  const toggleLike = useCallback(async (item: any, parent?: any) => {
    if (!postId || !uid) return;
    if (parent) {
      const next = (parent.replies || []).map((r: any) => r.id === item.id ? { ...r, likes: (r.likes || []).includes(uid) ? r.likes.filter((x: string) => x !== uid) : [...(r.likes || []), uid] } : r);
      await updateDoc(doc(db, 'posts', postId, 'comments', parent.id), { replies: next }).catch(() => {});
    } else {
      const liked = (item.likes || []).includes(uid);
      await updateDoc(doc(db, 'posts', postId, 'comments', item.id), { likes: liked ? arrayRemove(uid) : arrayUnion(uid) }).catch(() => {});
      if (!liked) sendNotification({ toUid: item.uid, fromUid: uid, fromUsername: me.username || 'user', type: 'like', message: 'liked your comment.', postId, commentId: item.id });
    }
  }, [postId, uid, me.username]);

  const handlePin = async (cm: any) => {
    if (!postId) return;
    if (!cm.isPinned && comments.filter((x) => x.isPinned).length >= 3) return Alert.alert('Pin Limit', 'Maximum 3 comments can be pinned.');
    await updateDoc(doc(db, 'posts', postId, 'comments', cm.id), { isPinned: !cm.isPinned }).catch(() => {});
  };

  const handleDelete = (t: any) => Alert.alert('Delete', 'Remove this comment?', [{ text: 'Cancel', style: 'cancel' }, {
    text: 'Delete', style: 'destructive', onPress: async () => {
      if (!postId) return;
      if (t.isReply) {
        const next = (t.parent.replies || []).filter((r: any) => r.id !== t.id);
        await updateDoc(doc(db, 'posts', postId, 'comments', t.parent.id), { replies: next }).catch(() => {});
      } else {
        await deleteDoc(doc(db, 'posts', postId, 'comments', t.id)).catch(() => {});
        if ((post?.commentsCount ?? comments.length) > 0) updateDoc(doc(db, 'posts', postId), { commentsCount: increment(-1) }).catch(() => {});
      }
    },
  }]);

  const openUser = useCallback(async (val: string, byUsername = false) => {
    onClose();
    if (!byUsername) return router.push(`/user/${val}` as any);
    const cached = Object.values(usersMap).find((x: any) => (x.username || '').toLowerCase() === val);
    if (cached) return router.push(`/user/${cached.id}` as any);
    const snap = await getDocs(query(collection(db, 'users'), where('username', '==', val), limit(1)));
    if (!snap.empty) router.push(`/user/${snap.docs[0].id}` as any);
  }, [onClose, router, usersMap]);

  return (
    <Modal visible={!!postId} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={[s.hdr, { borderBottomColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>Comments ({post?.commentsCount ?? comments.length})</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              {isPostOwner && <TouchableOpacity onPress={() => setShowHidden((v) => !v)}><Text style={{ color: BRAND, fontSize: 12, fontWeight: '700' }}>{showHidden ? 'Hide hidden' : 'Hidden'}</Text></TouchableOpacity>}
              {isPostOwner && <TouchableOpacity onPress={() => setSettingsOpen(true)}><Ionicons name="settings-outline" size={20} color={c.text} /></TouchableOpacity>}
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={c.text} /></TouchableOpacity>
            </View>
          </View>

          {initialLoading ? (
            <ActivityIndicator size="large" color={BRAND} style={{ flex: 1 }} />
          ) : err ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: c.muted }}>Failed to load comments</Text>
              <TouchableOpacity onPress={() => setLim((n) => n)} style={{ marginTop: 10 }}><Text style={{ color: BRAND, fontWeight: '700' }}>Retry</Text></TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={visibleComments}
              keyExtractor={(i) => i.id}
              style={{ flex: 1 }}
              keyboardShouldPersistTaps="handled"
              onEndReached={() => {
                if (!loadingMore && comments.length >= lim) { setLoadingMore(true); setLim((n) => n + 20); }
              }}
              onEndReachedThreshold={0.4}
              ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No comments yet. Be the first!</Text>}
              ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={BRAND} style={{ marginVertical: 10 }} /> : null}
              renderItem={({ item }) => (
                <CommentItemRow
                  item={item} u={usersMap[item.uid]} uid={uid} c={c}
                  expanded={!!expanded[item.id]}
                  onToggleExpand={(id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }))}
                  onReply={(cm: any) => { setReplyParent(cm); setEditTarget(null); }}
                  onMenu={setMenuTarget} onLike={toggleLike} onOpenLikes={setLikesUids} onOpenUser={openUser}
                />
              )}
            />
          )}

          {mentionSuggestions.length > 0 && (
            <View style={[s.mStrip, { borderTopColor: c.border }]}>
              {mentionSuggestions.map((u: any) => (
                <TouchableOpacity key={u.id} onPress={() => setText((t) => t.replace(/@[a-zA-Z0-9._]*$/, `@${u.username} `))} style={[s.mChip, { backgroundColor: c.surface || c.input }]}>
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>@{u.username}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {(replyParent || editTarget) && (
            <View style={[s.banner, { backgroundColor: c.surface || c.input }]}>
              <Text style={{ color: c.text, fontSize: 12, flex: 1 }}>{editTarget ? 'Editing comment' : `Replying to @${replyParent.username}`}</Text>
              <TouchableOpacity onPress={() => { setReplyParent(null); setEditTarget(null); setText(''); }}><Ionicons name="close" size={18} color={c.muted} /></TouchableOpacity>
            </View>
          )}

          <View style={[s.emoRow, { borderTopColor: c.border }]}>{EMOJIS.map((e) => <TouchableOpacity key={e} onPress={() => submit(e)}><Text style={{ fontSize: 21 }}>{e}</Text></TouchableOpacity>)}</View>
          <View style={s.inpRow}>
            {me.photoUrl ? <Image source={{ uri: me.photoUrl }} style={s.miniAv} /> : null}
            <TextInput value={text} onChangeText={setText} onSubmitEditing={() => submit()} editable={canComment || !!editTarget} placeholder={canComment ? 'Add a comment...' : 'Comments restricted'} placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.background }]} />
            <TouchableOpacity onPress={pickPhoto}><Ionicons name="image-outline" size={22} color={c.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => submit()} disabled={sending}><Ionicons name="send" size={21} color={sending ? c.muted : BRAND} /></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      <CommentActionMenu target={menuTarget} isAuthor={menuTarget?.uid === uid} isPostOwner={isPostOwner} onEdit={(t: any) => { setEditTarget(t); setReplyParent(null); setText(t.text || ''); }} onDelete={handleDelete} onPin={handlePin} onHide={(cm: any) => postId && updateDoc(doc(db, 'posts', postId, 'comments', cm.id), { isHidden: !cm.isHidden })} onReport={(t: any) => setReportTarget(t)} onClose={() => setMenuTarget(null)} />
      <CommentReportModal visible={!!reportTarget} target={reportTarget} postId={postId} uid={uid} onClose={() => setReportTarget(null)} />
      <CommentSettingsModal visible={settingsOpen} post={post} onClose={() => setSettingsOpen(false)} />
      <CommentLikesModal uids={likesUids} usersMap={usersMap} onClose={() => setLikesUids(null)} />
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { height: '78%', borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 0.5 },
  cmtWrap: { paddingHorizontal: 14, paddingVertical: 8 },
  cmtRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  av: { width: 34, height: 34, borderRadius: 17 },
  cmtImg: { width: 120, height: 120, borderRadius: 10, marginTop: 6 },
  repRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 44, marginTop: 6 },
  mStrip: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 0.5 },
  mChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  banner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7 },
  emoRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 7, borderTopWidth: 0.5 },
  inpRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingBottom: 14, paddingTop: 4 },
  miniAv: { width: 28, height: 28, borderRadius: 14 },
  inp: { flex: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 8, fontSize: 14 },
});
              
