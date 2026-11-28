import React, { memo, useState } from 'react';
import {
  View, Text, TouchableOpacity, Image, Modal, TextInput, ScrollView, StyleSheet, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { AnimatedLikeButton } from './LikeComponents';
import { formatLikeCount, toggleCommentLike } from './likeSystem';
import { fetchRepliesList, editCommentDoc, deleteCommentDoc } from './commentHelpers';

const REPORT_CATS = ['Spam', 'Harassment', 'Impersonation', 'Inappropriate content', 'Other'];

export const CommentRow = memo(function CommentRow({
  item, postId, myUid, me, isPostOwner, onReply, onPin, onHide, onDelete, onReport, onOpenProfile,
}: {
  item: any; postId: string; myUid: string; me: any; isPostOwner: boolean;
  onReply: (c: any) => void; onPin: (c: any) => void; onHide: (c: any) => void;
  onDelete: (c: any, replyId?: string) => void; onReport: (c: any, replyId?: string) => void;
  onOpenProfile: (uidOrUsername: string, isUsername?: boolean) => void;
}) {
  const { c } = useTheme();
  const [editing, setEditing] = useState(false);
  const [editTxt, setEditTxt] = useState(item.text || '');
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replies, setReplies] = useState<any[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const isAuthor = item.uid === myUid;
  const liked = Array.isArray(item.likes) && item.likes.includes(myUid);
  const pinned = Boolean(item.isPinned || item.pinned);
  const hidden = Boolean(item.isHidden || item.hidden);

  if (hidden && !isPostOwner && !isAuthor) return null;

  const toggleReplies = async () => {
    if (repliesOpen) { setRepliesOpen(false); return; }
    setRepliesOpen(true);
    setLoadingReplies(true);
    try { setReplies(await fetchRepliesList(postId, item.id)); } finally { setLoadingReplies(false); }
  };

  const openMenu = () => {
    const opts: any[] = [];
    if (isPostOwner) {
      opts.push({ text: pinned ? 'Unpin Comment' : 'Pin Comment', onPress: () => onPin(item) });
      opts.push({ text: hidden ? 'Unhide Comment' : 'Hide Comment', onPress: () => onHide(item) });
    }
    if (isAuthor) opts.push({ text: 'Edit Comment', onPress: () => { setEditTxt(item.text || ''); setEditing(true); } });
    if (isAuthor || isPostOwner) opts.push({ text: 'Delete Comment', style: 'destructive', onPress: () => onDelete(item) });
    if (!isAuthor) opts.push({ text: 'Report Comment', style: 'destructive', onPress: () => onReport(item) });
    opts.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(`@${item.username}`, undefined, opts);
  };

  const renderMentions = (txt: string) => {
    const parts = txt.split(/(@[a-zA-Z0-9._]+)/g);
    return (
      <Text style={{ color: c.text, fontSize: 13.5, lineHeight: 19, opacity: hidden ? 0.5 : 1 }}>
        {parts.map((part, i) =>
          part.startsWith('@') ? (
            <Text key={i} style={{ color: BRAND, fontWeight: '700' }} onPress={() => onOpenProfile(part.slice(1).toLowerCase(), true)}>
              {part}
            </Text>
          ) : (
            <Text key={i}>{part}</Text>
          )
        )}
      </Text>
    );
  };

  return (
    <View style={styles.rowWrap}>
      <View style={styles.row}>
        <TouchableOpacity onPress={() => onOpenProfile(item.uid)}>
          {item.userAvatar ? <Image source={{ uri: item.userAvatar }} style={styles.av} /> : (
            <View style={[styles.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
              <Text style={{ color: BRAND_TEXT, fontWeight: '700', fontSize: 12 }}>{(item.username || 'U')[0].toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <TouchableOpacity onPress={() => onOpenProfile(item.uid)}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>@{item.username}</Text>
            </TouchableOpacity>
            {pinned && <Text style={{ color: BRAND, fontSize: 11, fontWeight: '700' }}>Pinned</Text>}
            {hidden && <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700' }}>Hidden</Text>}
            {item.isEdited && <Text style={{ color: c.muted, fontSize: 11 }}>edited</Text>}
          </View>

          {editing ? (
            <View style={{ marginTop: 4, gap: 6 }}>
              <TextInput
                value={editTxt}
                onChangeText={setEditTxt}
                style={[styles.editIn, { backgroundColor: c.input, color: c.text, borderColor: c.border }]}
                multiline
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity onPress={() => setEditing(false)}><Text style={{ color: c.muted, fontWeight: '700', fontSize: 12 }}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={async () => {
                  if (!editTxt.trim()) return;
                  await editCommentDoc(postId, item.id, editTxt);
                  setEditing(false);
                }}><Text style={{ color: BRAND, fontWeight: '800', fontSize: 12 }}>Save</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            renderMentions(item.text || '')
          )}

          <View style={styles.metaRow}>
            <TouchableOpacity onPress={() => onReply(item)}><Text style={{ color: c.muted, fontSize: 12, fontWeight: '600' }}>Reply</Text></TouchableOpacity>
            {(item.likes?.length || 0) > 0 && <Text style={{ color: c.muted, fontSize: 12 }}>{formatLikeCount(item.likes.length)} likes</Text>}
            <TouchableOpacity onPress={openMenu}><Ionicons name="ellipsis-horizontal" size={14} color={c.muted} /></TouchableOpacity>
          </View>

          {(item.repliesCount || 0) > 0 && (
            <TouchableOpacity onPress={toggleReplies} style={{ marginTop: 6 }}>
              <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>
                {repliesOpen ? 'Hide replies' : `View ${item.repliesCount} replies`}
              </Text>
            </TouchableOpacity>
          )}

          {repliesOpen && (
            <View style={{ marginTop: 8, gap: 8 }}>
              {loadingReplies ? <Text style={{ color: c.muted, fontSize: 12 }}>Loading replies...</Text> : replies.map((r) => {
                const rLiked = Array.isArray(r.likes) && r.likes.includes(myUid);
                return (
                  <View key={r.id} style={styles.replyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>@{r.username}</Text>
                      {renderMentions(r.text || '')}
                      <View style={{ flexDirection: 'row', gap: 12, marginTop: 2 }}>
                        {(r.uid === myUid || isPostOwner) && (
                          <TouchableOpacity onPress={() => {
                            Alert.alert('Delete Reply?', undefined, [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCommentDoc(postId, item.id, 0, r.id); setReplies((p) => p.filter((x) => x.id !== r.id)); } },
                            ]);
                          }}><Text style={{ color: '#EF4444', fontSize: 11 }}>Delete</Text></TouchableOpacity>
                        )}
                        {r.uid !== myUid && <TouchableOpacity onPress={() => onReport(item, r.id)}><Text style={{ color: c.muted, fontSize: 11 }}>Report</Text></TouchableOpacity>}
                      </View>
                    </View>
                    <AnimatedLikeButton
                      liked={rLiked}
                      size={16}
                      onPress={async () => {
                        const next = await toggleCommentLike({ postId, comment: { ...r, id: item.id }, replyId: r.id, myUid, me });
                        setReplies((prev) => prev.map((x) => x.id === r.id ? { ...x, likes: next ? [...(x.likes || []), myUid] : (x.likes || []).filter((u: string) => u !== myUid) } : x));
                      }}
                    />
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <AnimatedLikeButton liked={liked} size={18} onPress={() => toggleCommentLike({ postId, comment: item, myUid, me })} />
      </View>
    </View>
  );
});

export function CommentSettingsModal({
  visible, post, onClose,
}: {
  visible: boolean; post: any; onClose: () => void;
}) {
  const { c } = useTheme();
  const [disabled, setDisabled] = useState(!!post?.commentsDisabled);
  if (!visible || !post) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.bg} activeOpacity={1} onPress={onClose}>
        <View style={[styles.card, { backgroundColor: c.background }]}>
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, marginBottom: 12 }}>Comment Controls</Text>
          <View style={styles.setRow}>
            <Text style={{ color: c.text, flex: 1 }}>Turn off commenting</Text>
            <Switch value={disabled} trackColor={{ true: BRAND }} onValueChange={async (v) => {
              setDisabled(v);
              await updateDoc(doc(db, 'posts', post.id), { commentsDisabled: v }).catch(() => {});
            }} />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function ReportCommentModal({
  target, postId, myUid, onClose,
}: {
  target: { comment: any; replyId?: string } | null; postId: string; myUid: string; onClose: () => void;
}) {
  const { c } = useTheme();
  const [cat, setCat] = useState(REPORT_CATS[0]);
  const [note, setNote] = useState('');
  if (!target) return null;
  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={[styles.card, { backgroundColor: c.background }]}>
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16, marginBottom: 10 }}>Report Comment</Text>
          <ScrollView style={{ maxHeight: 220 }}>
            {REPORT_CATS.map((r) => (
              <TouchableOpacity key={r} onPress={() => setCat(r)} style={styles.setRow}>
                <Text style={{ color: c.text, flex: 1 }}>{r}</Text>
                <Ionicons name={cat === r ? 'radio-button-on' : 'radio-button-off'} size={18} color={cat === r ? BRAND : c.muted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TextInput style={[styles.editIn, { backgroundColor: c.input, color: c.text, borderColor: c.border, marginTop: 8 }]} placeholder="Optional details..." placeholderTextColor={c.muted} value={note} onChangeText={setNote} />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity onPress={onClose} style={[styles.btn, { backgroundColor: c.input }]}><Text style={{ color: c.text }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={async () => {
              await addDoc(collection(db, 'reports'), {
                postId, commentId: target.replyId || target.comment.id, type: 'comment',
                category: cat, reason: note.trim() ? `${cat}: ${note.trim()}` : cat,
                reporterUid: myUid, reportedBy: myUid, status: 'pending', createdAt: serverTimestamp(),
              });
              setNote('');
              onClose();
              Alert.alert('Reported', 'Thank you. Our team will review this comment.');
            }} style={[styles.btn, { backgroundColor: '#EF4444' }]}><Text style={{ color: '#fff', fontWeight: '700' }}>Submit</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  rowWrap: { paddingHorizontal: 14, paddingVertical: 10 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  av: { width: 34, height: 34, borderRadius: 17 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4 },
  replyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingLeft: 10, borderLeftWidth: 1.5, borderLeftColor: '#E5E7EB' },
  editIn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 13 },
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  btn: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
});
      
