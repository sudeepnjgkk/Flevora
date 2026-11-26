import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config';
import { useTheme } from './theme';

const EMOJIS = ['❤️', '😢', '🥹', '😅', '🥰', '💔', '💯'];

export function LikesPlaysModal({ post, onClose }: { post: any | null; onClose: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!post) return setUsers([]);
    const ids: string[] = Array.isArray(post.likes) ? post.likes.slice(0, 50) : [];
    if (!ids.length) return setUsers([]);
    Promise.all(ids.map((id) => getDoc(doc(db, 'users', id)).then((s) => (s.exists() ? { id: s.id, ...s.data() } : null)).catch(() => null)))
      .then((res) => setUsers(res.filter(Boolean)));
  }, [post?.id, post?.likes?.length]);

  return (
    <Modal visible={!!post} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          <Text style={[s.title, { color: c.text }]}>Likes & Plays</Text>
          <View style={[s.playRow, { borderColor: c.border }]}>
            <Ionicons name="play-circle-outline" size={20} color={c.text} />
            <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{post?.views || 0} plays</Text>
          </View>
          <FlatList
            data={users}
            keyExtractor={(u) => u.id}
            ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 24 }}>No likes yet</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.userRow}
                onPress={() => {
                  onClose();
                  router.push(`/user/${item.id}` as any);
                }}
              >
                {item.photoUrl || item.avatar ? (
                  <Image source={{ uri: item.photoUrl || item.avatar }} style={s.av} />
                ) : (
                  <View style={[s.av, { backgroundColor: c.border, justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="person" size={18} color={c.muted} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '700' }}>@{item.username || 'user'}</Text>
                  {!!item.name && <Text style={{ color: c.muted, fontSize: 12 }}>{item.name}</Text>}
                </View>
                <Ionicons name="heart" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function RepostThoughtModal({
  visible,
  avatar,
  initialText,
  onSave,
  onDelete,
  onClose,
}: {
  visible: boolean;
  avatar?: string;
  initialText: string;
  onSave: (text: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initialText);

  useEffect(() => {
    if (visible) setText(initialText || '');
  }, [visible, initialText]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.thoughtBg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.thoughtWrap}>
          <View style={s.bubbleBox}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Tag a friend..."
              placeholderTextColor="#888"
              maxLength={60}
              autoFocus
              style={s.bubbleInput}
            />
          </View>
          <View style={s.bubbleTail} />
          {avatar ? (
            <Image source={{ uri: avatar }} style={s.thoughtAv} />
          ) : (
            <View style={[s.thoughtAv, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
              <Ionicons name="person" size={30} color="#fff" />
            </View>
          )}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>You reposted this reel</Text>
            <TouchableOpacity onPress={onDelete}>
              <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Delete</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={1} style={s.emojiTray}>
          <View style={s.emojiRow}>
            {EMOJIS.map((em) => (
              <TouchableOpacity key={em} onPress={() => setText((t) => (t + em).slice(0, 60))}>
                <Text style={{ fontSize: 28 }}>{em}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity onPress={() => onSave(text.trim())} style={s.saveBtn}>
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>Save</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '65%', padding: 16 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#888', alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, marginBottom: 8, borderBottomWidth: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  av: { width: 40, height: 40, borderRadius: 20 },
  thoughtBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'space-between', paddingTop: 120, paddingBottom: 24, paddingHorizontal: 18 },
  thoughtWrap: { alignItems: 'center' },
  bubbleBox: { backgroundColor: '#fff', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 10, minWidth: 150, maxWidth: '85%' },
  bubbleInput: { color: '#111', fontSize: 15, fontWeight: '600', textAlign: 'center', padding: 0 },
  bubbleTail: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#fff', marginTop: -4, marginBottom: 4 },
  thoughtAv: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: '#fff' },
  emojiTray: { gap: 12 },
  emojiRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingVertical: 6 },
  saveBtn: { backgroundColor: '#fff', borderRadius: 24, paddingVertical: 12, alignItems: 'center' },
});
