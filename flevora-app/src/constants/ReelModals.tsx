import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, Image, Switch, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND } from './theme';

const EMOJIS = ['❤️', '😢', '🥹', '😅', '🥰', '💔', '💯'];
const SPEEDS = [0.5, 1, 1.5, 2];

export function LikesPlaysModal({ post, onClose }: { post: any | null; onClose: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!post) return setUsers([]);
    const ids: string[] = Array.isArray(post.likes) ? post.likes.slice(0, 50) : [];
    if (!ids.length) return setUsers([]);
    Promise.all(ids.map((id) => getDoc(doc(db, 'users', id)).then((d) => (d.exists() ? { id: d.id, ...d.data() } : null)).catch(() => null)))
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
            data={users} keyExtractor={(u) => u.id}
            ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 24 }}>No likes yet</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.userRow} onPress={() => { onClose(); router.push(`/user/${item.id}` as any); }}>
                

{item.photoUrl || item.avatar ? <Image source={{ uri: item.photoUrl || item.avatar }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={18} color="#fff" /></View>}
                <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>@{item.username || 'user'}</Text>{!!item.name && <Text style={{ color: c.muted, fontSize: 12 }}>{item.name}</Text>}</View>
                <Ionicons name="heart" size={18} color="#EF4444" />
              </TouchableOpacity>
            )}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function RepostThoughtModal({ visible, avatar, initialText, onSave, onDelete, onClose }: any) {
  const [text, setText] = useState(initialText);
  useEffect(() => { if (visible) setText(initialText || ''); }, [visible, initialText]);

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.thoughtBg} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.thoughtWrap}>
          <View style={s.bubbleBox}>
            <TextInput value={text} onChangeText={setText} placeholder="Tag a friend..." placeholderTextColor="#888" maxLength={60} autoFocus style={s.bubbleInput} />
          </View>
          <View style={s.bubbleTail} />
          {avatar ? <Image source={{ uri: avatar }} style={s.thoughtAv} /> : <View style={[s.thoughtAv, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={30} color="#fff" /></View>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>You reposted this reel</Text>
            <TouchableOpacity onPress={onDelete}><Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Delete</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={1} style={s.emojiTray}>
          <View style={s.emojiRow}>{EMOJIS.map((em) => <TouchableOpacity key={em} onPress={() => setText((t: string) => (t + em).slice(0, 60))}><Text style={{ fontSize: 28 }}>{em}</Text></TouchableOpacity>)}</View>
          <TouchableOpacity onPress={() => onSave(text.trim())} style={s.saveBtn}><Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>Save</Text></TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function ReelOptionsSheet({ visible, onClose, fullscreen, onToggleFullscreen, speed, onChangeSpeed, autoScroll, onToggleAutoScroll, captions, onToggleCaptions, onInterest }: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={s.darkSheet}>
          <View style={s.handle} />
          <TouchableOpacity style={s.optRow} onPress={() => { onToggleFullscreen(); onClose(); }}>
            <Ionicons name={fullscreen ? 'contract-outline' : 'expand-outline'} size={22} color="#fff" />
            <Text style={s.optTxt}>{fullscreen ? 'Exit fullscreen' : 'View fullscreen'}</Text>
          </TouchableOpacity>
          <View style={s.optRow}>
            <Ionicons name="speedometer-outline" size={22} color="#fff" />
            <Text style={[s.optTxt, { flex: 1 }]}>Speed</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {SPEEDS.map((sp) => (
                <TouchableOpacity key={sp} onPress={() => onChangeSpeed(sp)} style={[s.spPill, speed === sp && { backgroundColor: '#fff' }]}>
                  <Text style={{ color: speed === sp ? '#000' : '#fff', fontWeight: '700', fontSize: 12 }}>{sp === 0.5 ? '.5x' : `${sp}x`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={s.optRow}>
            <Ionicons name="swap-vertical-outline" size={22} color="#fff" />
            <Text style={[s.optTxt, { flex: 1 }]}>Auto scroll</Text>
            <Switch value={autoScroll} onValueChange={onToggleAutoScroll} />
          </View>
          <View style={s.optRow}>
            <Ionicons name="closed-captioning-outline" size={22} color="#fff" />
            <Text style={[s.optTxt, { flex: 1 }]}>Closed Captions</Text>
            <Switch value={captions} onValueChange={onToggleCaptions} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
            <TouchableOpacity onPress={() => { onInterest(false); onClose(); }} style={s.intBtn}><Ionicons name="close" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700' }}>Not interested</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { onInterest(true); onClose(); }} style={s.intBtn}><Ionicons name="checkmark" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700' }}>Interested</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.48)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '65%', padding: 16 },
  darkSheet: { backgroundColor: '#1E1E1E', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 28, gap: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#888', alignSelf: 'center', marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 12, marginBottom: 8, borderBottomWidth: 1 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  av: { width: 40, height: 40, borderRadius: 20 },
  optRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  optTxt: { color: '#fff', fontSize: 15, fontWeight: '600' },
  spPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' },
  intBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2C2C2E', paddingVertical: 11, borderRadius: 12 },
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
           
