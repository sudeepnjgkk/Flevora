import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, Image, Alert, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { addDoc, collection, doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { BRAND, BRAND_TEXT, NEON } from './theme';

const CHAT_COLORS = [NEON.purple, NEON.pink, '#3B82F6', '#10B981', '#F97316'];

export function ChatInfoModal({
  visible, onClose, myUid, me, chatId, convo, otherUser, allUsers = [], msgs, c, chatColor, onChangeColor, onLeaveOrDelete,
}: any) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'info' | 'members' | 'search' | 'media'>('info');
  const [editName, setEditName] = useState(convo?.groupName || '');
  const [addMode, setAddMode] = useState(false);

  const isGroup = convo?.type === 'group';
  const isAdmin = isGroup && Array.isArray(convo?.admins) && convo.admins.includes(myUid);
  const isMuted = Boolean(me?.mutedMsgChats?.[otherUser?.id || chatId]);
  const mediaMsgs = (msgs || []).filter((m: any) => !!m.mediaUrl && m.mediaType !== 'audio');
  const searched = search.trim() ? (msgs || []).filter((m: any) => (m.text || '').toLowerCase().includes(search.toLowerCase())) : [];
  const members = (convo?.participants || []).map((id: string) => (id === myUid ? { id: myUid, ...me } : allUsers.find((u: any) => u.id === id) || { id, username: 'user' }));
  const addCandidates = allUsers.filter((u: any) => !(convo?.participants || []).includes(u.id));

  const toggleMute = () => {
    const key = otherUser?.id || chatId;
    updateDoc(doc(db, 'users', myUid), { [`mutedMsgChats.${key}`]: !isMuted });
    Alert.alert(isMuted ? 'Unmuted' : 'Muted', isMuted ? 'Notifications enabled.' : 'Notifications muted.');
  };

  const setDisappearing = (hours: number) => {
    updateDoc(doc(db, 'conversations', chatId), { disappearingHours: hours }).catch(() => Alert.alert('Error', 'Could not update setting.'));
  };

  const blockOrRestrict = (field: 'blockedUsers' | 'restrictedUsers', label: string) => {
    if (!otherUser?.id) return;
    updateDoc(doc(db, 'users', myUid), { [field]: arrayUnion(otherUser.id) });
    Alert.alert(label, `@${otherUser.username} added to ${label.toLowerCase()}.`);
    onClose();
  };

  const reportChat = () => {
    addDoc(collection(db, 'reports'), { chatId, targetUid: otherUser?.id || '', type: 'chat', status: 'pending', reportedBy: myUid, reporterUid: myUid, createdAt: serverTimestamp() });
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
          {(isGroup ? ['info', 'members', 'search', 'media'] : ['info', 'search', 'media']).map((t: any) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.pill, { backgroundColor: tab === t ? BRAND : c.surface }]}>
              <Text style={{ color: tab === t ? BRAND_TEXT : c.text, fontWeight: '700', textTransform: 'capitalize', fontSize: 12 }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'info' && (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View style={{ alignItems: 'center', marginBottom: 6 }}>
              {otherUser?.photoUrl || otherUser?.avatar ? <Image source={{ uri: otherUser.photoUrl || otherUser.avatar }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name={isGroup ? 'people' : 'person'} size={34} color={BRAND_TEXT} /></View>}
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', marginTop: 10 }}>{isGroup ? convo?.groupName : `@${otherUser?.username || 'user'}`}</Text>
              {isGroup && !!convo?.groupDesc && <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>{convo.groupDesc}</Text>}
            </View>

            {isAdmin && (
              <View style={[s.card, { backgroundColor: c.card, borderColor: c.border, gap: 8 }]}>
                <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700' }}>EDIT GROUP NAME (ADMIN)</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput value={editName} onChangeText={setEditName} style={[s.inp, { flex: 1, marginBottom: 0, color: c.text, backgroundColor: c.input }]} />
                  <TouchableOpacity onPress={() => editName.trim() && updateDoc(doc(db, 'conversations', chatId), { groupName: editName.trim() })} style={{ backgroundColor: BRAND, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10 }}>
                    <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>CHAT THEME COLOR</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {CHAT_COLORS.map((col) => (
                  <TouchableOpacity key={col} onPress={() => onChangeColor(col)} style={[s.cDot, { backgroundColor: col, borderWidth: chatColor === col ? 3 : 0, borderColor: c.text }]} />
                ))}
              </View>
            </View>

            <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
              <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', marginBottom: 8 }}>DISAPPEARING MESSAGES</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {[[0, 'Off'], [24, '24h'], [168, '7d']].map(([h, lbl]) => (
                  <TouchableOpacity key={String(h)} onPress={() => setDisappearing(Number(h))} style={[s.pill, { backgroundColor: (convo?.disappearingHours || 0) === h ? BRAND : c.input }]}>
                    <Text style={{ color: (convo?.disappearingHours || 0) === h ? BRAND_TEXT : c.text, fontWeight: '700', fontSize: 12 }}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {!isGroup && otherUser?.id && (
              <TouchableOpacity style={[s.row, { borderColor: c.border }]} onPress={() => { onClose(); router.push(`/user/${otherUser.id}` as any); }}>
                <Ionicons name="person-outline" size={21} color={c.text} /><Text style={[s.rTxt, { color: c.text }]}>View Profile</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[s.row, { borderColor: c.border }]} onPress={toggleMute}>
              <Ionicons name={isMuted ? 'notifications-outline' : 'notifications-off-outline'} size={21} color={c.text} />
              <Text style={[s.rTxt, { color: c.text }]}>{isMuted ? 'Unmute Notifications' : 'Mute Notifications'}</Text>
            </TouchableOpacity>
            {!isGroup && (
              <>
                <TouchableOpacity style={[s.row, { borderColor: c.border }]} onPress={() => blockOrRestrict('restrictedUsers', 'Restricted')}>
                  <Ionicons name="shield-outline" size={21} color={c.text} /><Text style={[s.rTxt, { color: c.text }]}>Restrict User</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.row, { borderColor: c.border }]} onPress={() => blockOrRestrict('blockedUsers', 'Blocked')}>
                  <Ionicons name="ban-outline" size={21} color="#EF4444" /><Text style={[s.rTxt, { color: '#EF4444' }]}>Block User</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity style={[s.row, { borderColor: c.border }]} onPress={reportChat}><Ionicons name="flag-outline" size={21} color="#EF4444" /><Text style={[s.rTxt, { color: '#EF4444' }]}>Report</Text></TouchableOpacity>
            <TouchableOpacity style={[s.row, { borderColor: c.border }]} onPress={() => { onLeaveOrDelete(); onClose(); }}>
              <Ionicons name="trash-outline" size={21} color="#EF4444" /><Text style={[s.rTxt, { color: '#EF4444' }]}>{isGroup ? 'Leave Group' : 'Delete Conversation for Me'}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {tab === 'members' && isGroup && (
          <View style={{ flex: 1, padding: 14 }}>
            {isAdmin && (
              <TouchableOpacity onPress={() => setAddMode((v) => !v)} style={[s.pill, { backgroundColor: BRAND, marginBottom: 10, flex: 0 }]}>
                <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>{addMode ? 'Done Adding' : '+ Add Members'}</Text>
              </TouchableOpacity>
            )}
            <FlatList
              data={addMode ? addCandidates : members}
              keyExtractor={(i) => i.id}
              renderItem={({ item }) => {
                const memAdmin = Array.isArray(convo?.admins) && convo.admins.includes(item.id);
                return (
                  <View style={[s.row, { borderColor: c.border }]}>
                    <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>@{item.username || 'user'} {memAdmin ? '• Admin' : ''}</Text>
                    {addMode ? (
                      <TouchableOpacity onPress={() => updateDoc(doc(db, 'conversations', chatId), { participants: arrayUnion(item.id) })}>
                        <Text style={{ color: BRAND, fontWeight: '800' }}>Add</Text>
                      </TouchableOpacity>
                    ) : isAdmin && item.id !== myUid ? (
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity onPress={() => updateDoc(doc(db, 'conversations', chatId), { admins: memAdmin ? arrayRemove(item.id) : arrayUnion(item.id) })}>
                          <Text style={{ color: BRAND, fontWeight: '700', fontSize: 12 }}>{memAdmin ? 'Demote' : 'Make Admin'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => updateDoc(doc(db, 'conversations', chatId), { participants: arrayRemove(item.id), admins: arrayRemove(item.id) })}>
                          <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ) : null}
                  </View>
                );
              }}
            />
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
  tabs: { flexDirection: 'row', gap: 6, padding: 12 },
  pill: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
  av: { width: 76, height: 76, borderRadius: 38 },
  card: { padding: 12, borderRadius: 14, borderWidth: 1 },
  cDot: { width: 28, height: 28, borderRadius: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5 },
  rTxt: { fontSize: 15, fontWeight: '600' },
  inp: { borderRadius: 12, padding: 12, marginBottom: 10 },
  sRow: { paddingVertical: 10, borderBottomWidth: 0.5 },
});
