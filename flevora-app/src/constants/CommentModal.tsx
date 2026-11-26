import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, FlatList, Image, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, updateDoc, arrayUnion, arrayRemove, increment, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND } from './theme';

const EMOJIS = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮', '😂'];
const CLOUD_NAME = 'faqfo0lu';
const UPLOAD_PRESET = 'flevora_upload';

export function CommentModal({ postId, post, onClose }: { postId: string | null; post?: any; onClose: () => void }) {
  const { c } = useTheme();
  const uid = auth.currentUser?.uid || '';
  const [comments, setComments] = useState<any[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    if (!postId) return setComments([]);
    return onSnapshot(query(collection(db, 'posts', postId, 'comments'), orderBy('createdAt', 'asc')), (s) => {
      setComments(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [postId]);

  const send = async (customText?: string, mediaUrl = '') => {
    const body = (customText ?? text).trim();
    if (!postId || !uid || (!body && !mediaUrl)) return;
    if (!customText) setText('');
    const u = await getDoc(doc(db, 'users', uid));
    const uname = u.data()?.username || 'user';
    await addDoc(collection(db, 'posts', postId, 'comments'), {
      uid, username: uname, text: body, mediaUrl, likes: [], createdAt: serverTimestamp(),
    });
    updateDoc(doc(db, 'posts', postId), { commentsCount: increment(1) }).catch(() => {});
    const ownerUid = post?.uid;
    if (ownerUid && ownerUid !== uid) {
      addDoc(collection(db, 'notifications'), {
        toUid: ownerUid, fromUid: uid, fromUsername: uname, type: 'comment', postId,
        message: `commented: ${body || '📷 Photo'}`, read: false, createdAt: serverTimestamp(),
      }).catch(() => {});
    }
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.65 });
    if (res.canceled || !res.assets[0]) return;
    const data = new FormData();
    data.append('file', { uri: res.assets[0].uri, type: 'image/jpeg', name: `cmt_${Date.now()}.jpg` } as any);
    data.append('upload_preset', UPLOAD_PRESET);
    const r = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: data });
    const j = await r.json();
    if (j.secure_url) send('', j.secure_url);
  };

  const toggleLike = (item: any) => {
    if (!postId || !uid) return;
    const liked = Array.isArray(item.likes) && item.likes.includes(uid);
    updateDoc(doc(db, 'posts', postId, 'comments', item.id), { likes: liked ? arrayRemove(uid) : arrayUnion(uid) }).catch(() => {});
  };

  return (
    <Modal visible={!!postId} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'padding'} style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={[s.hdr, { borderBottomColor: c.border }]}>
            <Text style={{ color: c.text, fontSize: 16, fontWeight: '800' }}>Comments ({comments.length})</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={c.text} /></TouchableOpacity>
          </View>
          <FlatList
            data={comments}
            keyExtractor={(i) => i.id}
            style={{ flex: 1 }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No comments yet</Text>}
            renderItem={({ item }) => {
              const liked = Array.isArray(item.likes) && item.likes.includes(uid);
              return (
                <View style={s.cmtRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: 14 }}><Text style={{ fontWeight: '700' }}>@{item.username} </Text>{item.text}</Text>
                    {!!item.mediaUrl && <Image source={{ uri: item.mediaUrl }} style={s.cmtImg} />}
                    <TouchableOpacity onPress={() => setText(`@${item.username} `)}><Text style={{ color: c.muted, fontSize: 12, marginTop: 3 }}>Reply</Text></TouchableOpacity>
                  </View>
                  <TouchableOpacity onPress={() => toggleLike(item)} style={{ alignItems: 'center', paddingLeft: 10 }}>
                    <Ionicons name={liked ? 'heart' : 'heart-outline'} size={17} color={liked ? '#EF4444' : c.muted} />
                    {!!item.likes?.length && <Text style={{ color: c.muted, fontSize: 11 }}>{item.likes.length}</Text>}
                  </TouchableOpacity>
                </View>
              );
            }}
          />
          <View style={[s.emoRow, { borderTopColor: c.border }]}>
            {EMOJIS.map((e) => <TouchableOpacity key={e} onPress={() => send(e)}><Text style={{ fontSize: 22 }}>{e}</Text></TouchableOpacity>)}
          </View>
          <View style={s.inpRow}>
            <TextInput value={text} onChangeText={setText} placeholder="Add a comment..." placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.background }]} />
            <TouchableOpacity onPress={pickPhoto}><Ionicons name="image-outline" size={23} color={c.text} /></TouchableOpacity>
            <TouchableOpacity onPress={() => send('🎁✨ Super Gift!')}><Ionicons name="gift-outline" size={23} color={BRAND} /></TouchableOpacity>
            <TouchableOpacity onPress={() => send()}><Ionicons name="send" size={22} color={BRAND} /></TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { height: '72%', borderTopLeftRadius: 20, borderTopRightRadius: 20, overflow: 'hidden' },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1 },
  cmtRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 14, paddingVertical: 10 },
  cmtImg: { width: 120, height: 120, borderRadius: 10, marginTop: 6 },
  emoRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: 1 },
  inpRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingBottom: 14, paddingTop: 4 },
  inp: { flex: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 9, fontSize: 14 },
});
