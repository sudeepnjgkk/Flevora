import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Image, Modal, TextInput, FlatList, StyleSheet, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { STORY_TTL_MS } from './storiesCapabilities';

export function ShareModal({ visible, post, onClose }: { visible?: boolean; post: any | null; onClose: () => void }) {
  const { c } = useTheme();
  const uid = auth.currentUser?.uid || '';
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');
  const isOpen = visible !== undefined ? Boolean(visible && post) : Boolean(post);

  useEffect(() => {
    if (!isOpen) return;
    return onSnapshot(collection(db, 'users'), (s) => {
      setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== uid));
    }, () => {});
  }, [isOpen, uid]);

  const sendToUser = async (targetUid: string, uname: string) => {
    if (!uid || !post) return;
    const chatId = [uid, targetUid].sort().join('_');
    await addDoc(collection(db, 'conversations', chatId, 'messages'), {
      senderUid: uid, text: post.caption || 'Shared a post', mediaUrl: post.mediaUrl || '',
      mediaType: post.mediaType || 'image', read: false, createdAt: serverTimestamp(),
    });
    Alert.alert('Sent', `Shared with @${uname}!`);
    onClose();
  };

  const addToStory = async () => {
    if (!uid || !post) return;
    if (post.isPrivate || post.allowReshare === false) {
      return Alert.alert('Not Allowed', 'This content cannot be shared to Story.');
    }
    try {
      const meSnap = await getDoc(doc(db, 'users', uid));
      const me = meSnap.data() || {};
      await addDoc(collection(db, 'stories'), {
        uid,
        username: me.username || 'user',
        userPhoto: me.photoUrl || me.avatar || '',
        mediaUrl: post.mediaUrl || '',
        mediaType: post.mediaType === 'video' ? 'video' : 'image',
        textOverlay: post.username ? `Shared from @${post.username}` : '',
        sharedPost: { id: post.id, uid: post.uid, username: post.username || 'user', caption: post.caption || '' },
        audience: 'Everyone',
        closeFriendsOnly: false,
        allowedUids: [],
        viewers: [], viewerNames: [], likes: [], comments: [], reactions: [],
        expiresAt: Date.now() + STORY_TTL_MS,
        createdAtMs: Date.now(),
        createdAt: serverTimestamp(),
      });
      Alert.alert('Added to Story', 'Shared to your story!');
      onClose();
    } catch {
      Alert.alert('Error', 'Could not share to story.');
    }
  };

  const filtered = users.filter((u) => (u.username || '').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Modal visible={isOpen} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.bg}>
        <View style={[styles.card, { backgroundColor: c.background }]}>
          <View style={[styles.head, { borderBottomColor: c.border }]}>
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 16 }}>Send to</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={c.text} /></TouchableOpacity>
          </View>
          <TextInput style={[styles.input, { backgroundColor: c.input, color: c.text }]} placeholder="Search users..." placeholderTextColor={c.muted} value={q} onChangeText={setQ} />
          <FlatList
            data={filtered}
            numColumns={3}
            keyExtractor={(i) => i.id}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.user} onPress={() => sendToUser(item.id, item.username)}>
                {item.photoUrl || item.avatar ? <Image source={{ uri: item.photoUrl || item.avatar }} style={styles.av} /> : (
                  <View style={[styles.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: BRAND_TEXT, fontWeight: '700', fontSize: 18 }}>{(item.username || 'U')[0].toUpperCase()}</Text>
                  </View>
                )}
                <Text style={{ color: c.text, fontSize: 12, marginTop: 4 }} numberOfLines={1}>@{item.username}</Text>
              </TouchableOpacity>
            )}
          />
          {!!post?.mediaUrl && !post?.expiresAt && (
            <TouchableOpacity style={[styles.extBtn, { borderTopColor: c.border }]} onPress={addToStory}>
              <Ionicons name="add-circle-outline" size={20} color={BRAND} />
              <Text style={{ color: c.text, fontWeight: '700' }}>Add to Your Story</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.extBtn, { borderTopColor: c.border }]} onPress={() => Share.share({ message: `${post?.caption || 'Check this on Flevora!'} ${post?.mediaUrl || ''}` })}>
            <Ionicons name="share-social-outline" size={20} color={BRAND} />
            <Text style={{ color: c.text, fontWeight: '700' }}>Share to WhatsApp / Other Apps</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  card: { height: '68%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  head: { flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10, borderBottomWidth: 1 },
  input: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, marginVertical: 10 },
  user: { width: '33%', alignItems: 'center', marginVertical: 10 },
  av: { width: 56, height: 56, borderRadius: 28 },
  extBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 11, borderTopWidth: 1 },
});
