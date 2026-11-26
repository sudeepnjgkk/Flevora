import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, Image, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { BRAND, NEON } from './theme';

const CHAT_COLORS = [NEON.purple, NEON.pink, '#3B82F6', '#10B981', '#F97316'];

export function ChatInfoModal({
  visible, onClose, myUid, chatId, convo, otherUser, msgs, c, chatColor, onChangeColor, onLeaveOrDelete,
}: any) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'info' | 'search' | 'media'>('info');
  const isGroup = convo?.type === 'group';
  const mediaMsgs = (msgs || []).filter((m: any) => !!m.mediaUrl);
  const searched = search.trim() ? (msgs || []).filter((m: any) => (m.text || '').toLowerCase().includes(search.toLowerCase())) : [];

  const toggleMute = () => updateDoc(doc(db, 'users', myUid), { [`mutedMsgChats.${otherUser?.id || chatId}`]: true }).then(() => Alert.alert('Muted', 'Notifications muted.'));
  const blockUser = () => {
    if (!otherUser?.id) return;
    updateDoc(doc(db, 'users', myUid), { blockedUsers: arrayUnion(otherUser.id) });
    Alert.alert('Blocked', `@${otherUser.username} blocked.`);
    onClose();
  };
  const reportChat = () => {
    addDoc(collection(db, 'reports'), { chatId, targetUid: otherUser?.id || '', type: 'chat', reportedBy: myUid, createdAt: serverTimestamp() });
    Alert.alert('Reported', 'Conversation reported for review.');
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>{isGroup ? 'Group Info' : 'Chat Details'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={s.tabs}>
          {(['info', 'search', 'media'] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.pill, { backgroundColor: tab === t ? BRAND : c.surface }]}>
              <Text style={{ color: tab === t ? '#fff' : c.text, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'info' && (
          <View style={{ padding: 16, gap: 14 }}>
            <View style={{ alignItems: 'center',

 marginBottom: 6 }}>
              {otherUser?.photoUrl ? <Image source={{ uri: otherUser.photoUrl }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name={isGroup ? 'people' : 'person'} size={34} color="#fff" /></View>}
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', marginTop: 10 }}>{isGroup ? convo?.groupName : `@${otherUser?.username || 'user'}`}</Text>
              {isGroup && <Text style={{ color: c.muted, fontSize: 12 }}>{convo?.participants?.length || 0} members</Text>}
            </View>

            <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>CHAT THEME COLOR</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {CHAT_COLORS.map((col) => (
                  <TouchableOpacity key={col} onPress={() => onChangeColor(col)} style={[s.cDot, { backgroundColor: col, borderWidth: chatColor === col ? 3 : 0, borderColor: c.text }]} />
                ))}
              </View>
            </View>

            {!isGroup && otherUser?.id && (
              <TouchableOpacity style={[s.row, { borderColor: c.border }]} onPress={() => { onClose(); router.push(`/user/${otherUser.id}` as any); }}>
                <Ionicons name="person-outline" size={21} color={c.text} /><Text style={[s.rTxt, { color: c.text }]}>View Profile</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.row, { borderColor: c.border }]} onPress={toggleMute}><Ionicons name="notifications-off-outline" size={21} color={c.text} /><Text style={[s.rTxt, { color: c.text }]}>Mute Notifications</Text></TouchableOpacity>
            {!isGroup && <TouchableOpacity style={[s.row, { borderColor: c.border }]} onPress={blockUser}><Ionicons name="ban-outline" size={21} color="#EF4444" /><Text style={[s.rTxt, { color: '#EF4444' }]}>Block User</Text></TouchableOpacity>}
            <TouchableOpacity style={[s.row, { borderColor: c.border }]} onPress={reportChat}><Ionicons name="flag-outline" size={21} color="#EF4444" /><Text style={[s.rTxt, { color: '#EF4444' }]}>Report</Text></TouchableOpacity>
            <TouchableOpacity style={[s.row, { borderColor: c.border }]} onPress={() => { onLeaveOrDelete(); onClose(); }}>
              <Ionicons name="trash-outline" size={21} color="#EF4444" /><Text style={[s.rTxt, { color: '#EF4444' }]}>{isGroup ? 'Leave Group' : 'Delete Conversation'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'search' && (
          <View style={{ flex: 1, padding: 14 }}>
            <TextInput value={search} onChangeText={setSearch} placeholder="Search in conversation..." placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input }]} />
            <FlatList data={searched} keyExtractor={(i) => i.id} ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 30 }}>{search ? 'No matching messages' : 'Type to search messages'}</Text>} renderItem={({ item }) => (
              <View style={[s.sRow, { borderBottomColor: c.border }]}><Text style={{ color: c.text }}>{item.text}</Text></View>
            )} />
          </View>
        )}

        {tab === 'media' && (
          <FlatList numColumns={3} data={mediaMsgs} keyExtractor={(i) => i.id} contentContainerStyle={{ padding: 10, gap: 4 }} columnWrapperStyle={{ gap: 4 }} ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No shared media</Text>} renderItem={({ item }) => (
            <Image source={{ uri: item.mediaType === 'video' ? item.mediaUrl.replace(/\.mp4.*$/, '.jpg') : item.mediaUrl }} style={{ width: '32.5%', height: 120, borderRadius: 8 }} />
          )} />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 0.5 },
  tabs: { flexDirection: 'row', gap: 8, padding: 12 },
  pill: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  av: { width: 76, height: 76, borderRadius: 38 },
  card: { padding: 12, borderRadius: 14, borderWidth: 1 },
  cDot: { width: 28, height: 28, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5 },
  rTxt: { fontSize: 15, fontWeight: '600' },
  inp: { borderRadius: 12, padding: 12, marginBottom: 10 },
  sRow: { paddingVertical: 10, borderBottomWidth: 0.5 },
});
