import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, Image, Alert, Share, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../config';
import { BRAND, useTheme } from './theme';

const REASONS = ['Spam', 'Harassment or bullying', 'Hate or abusive content', 'Impersonation', 'Misinformation', 'Other'];
const POLICIES = [
  { key: 'everyone', label: 'Everyone', sub: 'Anyone who can view this post' },
  { key: 'followers', label: 'Your followers', sub: 'Only people who follow you' },
  { key: 'following', label: 'People you follow', sub: 'Only accounts you follow' },
  { key: 'off', label: 'Turn off commenting', sub: 'No new comments or replies allowed' },
];

export function CommentReportModal({ visible, target, postId, uid, onClose }: any) {
  const { c } = useTheme();
  const [reason, setReason] = useState('Spam');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!uid || !target || busy) return;
    setBusy(true);
    try {
      await addDoc(collection(db, 'reports'), {
        reporterUid: uid,
        postId: postId || '',
        commentId: target.commentId || target.id || '',
        targetUid: target.uid || '',
        type: 'post',
        reason: notes.trim() ? `${reason}: ${notes.trim()}` : reason,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      Alert.alert('Reported', 'Thank you. Moderators will review this comment.');
      setNotes(''); onClose();
    } catch {
      Alert.alert('Error', 'Could not submit report.');
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          <Text style={[s.title, { color: c.text }]}>Report Comment</Text>
          {REASONS.map((r) => (
            <TouchableOpacity key={r} style={s.row} onPress={() => setReason(r)}>
              <Text style={{ color: c.text, flex: 1, fontWeight: '600' }}>{r}</Text>
              <Ionicons name={reason === r ? 'radio-button-on' : 'radio-button-off'} size={20} color={BRAND} />
            </TouchableOpacity>
          ))}
          <TextInput value={notes} onChangeText={setNotes} placeholder="Optional details..." placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input }]} />
          <TouchableOpacity onPress={submit} disabled={busy} style={s.btn}><Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? 'Submitting...' : 'Submit Report'}</Text></TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function CommentSettingsModal({ visible, post, onClose }: any) {
  const { c } = useTheme();
  const current = post?.commentsDisabled ? 'off' : (post?.commentPolicy || 'everyone');
  const setPolicy = async (key: string) => {
    if (!post?.id) return;
    await updateDoc(doc(db, 'posts', post.id), { commentsDisabled: key === 'off', commentPolicy: key }).catch(() => Alert.alert('Error', 'Failed to update settings.'));
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          <Text style={[s.title, { color: c.text }]}>Comment Controls</Text>
          {POLICIES.map((p) => (
            <TouchableOpacity key={p.key} style={s.row} onPress={() => setPolicy(p.key)}>
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>{p.label}</Text><Text style={{ color: c.muted, fontSize: 12 }}>{p.sub}</Text></View>
              <Ionicons name={current === p.key ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={current === p.key ? BRAND : c.muted} />
            </TouchableOpacity>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function CommentActionMenu({ target, isAuthor, isPostOwner, onEdit, onDelete, onPin, onHide, onReport, onClose }: any) {
  const { c } = useTheme();
  if (!target) return null;
  const isReply = !!target.isReply;
  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          {isAuthor && <TouchableOpacity style={s.row} onPress={() => { onClose(); onEdit(target); }}><Ionicons name="create-outline" size={20} color={c.text} /><Text style={[s.mTxt, { color: c.text }]}>Edit</Text></TouchableOpacity>}
          {isPostOwner && !isReply && <TouchableOpacity style={s.row} onPress={() => { onClose(); onPin(target); }}><Ionicons name="pin-outline" size={20} color={BRAND} /><Text style={[s.mTxt, { color: c.text }]}>{target.isPinned ? 'Unpin comment' : 'Pin comment'}</Text></TouchableOpacity>}
          {isPostOwner && !isReply && <TouchableOpacity style={s.row} onPress={() => { onClose(); onHide(target); }}><Ionicons name="eye-off-outline" size={20} color={c.text} /><Text style={[s.mTxt, { color: c.text }]}>{target.isHidden ? 'Unhide comment' : 'Hide comment'}</Text></TouchableOpacity>}
          <TouchableOpacity style={s.row} onPress={() => { onClose(); Share.share({ message: target.text || '' }); }}><Ionicons name="share-outline" size={20} color={c.text} /><Text style={[s.mTxt, { color: c.text }]}>Copy / Share text</Text></TouchableOpacity>
          {(isAuthor || isPostOwner) && <TouchableOpacity style={s.row} onPress={() => { onClose(); onDelete(target); }}><Ionicons name="trash-outline" size={20} color="#EF4444" /><Text style={[s.mTxt, { color: '#EF4444' }]}>Delete</Text></TouchableOpacity>}
          {!isAuthor && <TouchableOpacity style={s.row} onPress={() => { onClose(); onReport(target); }}><Ionicons name="flag-outline" size={20} color="#EF4444" /><Text style={[s.mTxt, { color: '#EF4444' }]}>Report</Text></TouchableOpacity>}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function CommentLikesModal({ uids, usersMap, onClose }: { uids: string[] | null; usersMap: Record<string, any>; onClose: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  return (
    <Modal visible={!!uids} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card, maxHeight: '60%' }]}>
          <View style={s.handle} />
          <Text style={[s.title, { color: c.text }]}>Liked by</Text>
          <FlatList data={uids || []} keyExtractor={(id) => id} ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', padding: 20 }}>No likes yet</Text>} renderItem={({ item }) => {
            const u = usersMap[item];
            return (
              <TouchableOpacity style={s

.row} onPress={() => { onClose(); router.push(`/user/${item}` as any); }}>
                {u?.photoUrl ? <Image source={{ uri: u.photoUrl }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={16} color="#fff" /></View>}
                <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>@{u?.username || 'user'}</Text>
                <Ionicons name="heart" size={16} color="#EF4444" />
              </TouchableOpacity>
            );
          }} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 26 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#888', alignSelf: 'center', marginBottom: 10 },
  title: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  mTxt: { fontSize: 15, fontWeight: '600' },
  inp: { borderRadius: 12, padding: 11, marginTop: 8, marginBottom: 12 },
  btn: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  av: { width: 36, height: 36, borderRadius: 18 },
});
                              
