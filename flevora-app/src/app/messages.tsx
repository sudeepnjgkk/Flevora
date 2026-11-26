import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot, doc, addDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND } from '../constants/theme';
import { AccountSwitcherModal, SelectMoreModal, NewChatModal } from '../constants/DmModals';
import { NoteModal, canSeeNote } from '../constants/NoteModal';
import { DmChatRoom } from '../constants/DmChatRoom';
import { DmRequestsView } from '../constants/DmRequestsView';

export default function MessagesScreen() {
  const params = useLocalSearchParams<{ uid?: string; name?: string }>();
  const { c } = useTheme();
  const myUid = auth.currentUser?.uid || '';
  const [me, setMe] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [convos, setConvos] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'primary' | 'general'>('all');
  const [inReq, setInReq] = useState(false);
  const [spamView, setSpamView] = useState(false);
  const [activeChat, setActiveChat] = useState<{ chatId: string; targetUid: string; targetName: string; convo?: any } | null>(
    params.uid ? { chatId: [myUid, params.uid].sort().join('_'), targetUid: params.uid, targetName: params.name || 'Chat' } : null
  );
  const [msgs, setMsgs] = useState<any[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [modals, setModals] = useState({ acc: false, more: false, newChat: false, note: false });

  useEffect(() => {
    setMe(null); setConvos([]); setMsgs([]);
    if (!myUid) return;
    const u1 = onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== myUid)));
    const u2 = onSnapshot(doc(db, 'users', myUid), (s) => {
      if (!s.exists()) return;
      const d = s.data(); setMe(d);
      AsyncStorage.getItem('flevora_accounts').then((raw) => {
        const next = [{ uid: myUid, username: d.username, photoUrl: d.photoUrl }, ...(raw ? JSON.parse(raw) : []).filter((a: any) => a.uid !== myUid)].slice(0, 5);
        setAccounts(next); AsyncStorage.setItem('flevora_accounts', JSON.stringify(next));
      });
    });
    const u3 = onSnapshot(query(collection(db, 'conversations'), where('participants', 'array-contains', myUid)), (s) => {
      setConvos(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => { u1(); u2(); u3(); };
  }, [myUid]);

  useEffect(() => {
    if (!activeChat?.chatId || !myUid) return setMsgs([]);
    return onSnapshot(query(collection(db, 'conversations', activeChat.chatId, 'messages'), orderBy('createdAt', 'desc'), limit(40)), (s) => {
      setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [activeChat?.chatId, myUid]);

  const isOnline = (u: any) => u?.isOnline || (u?.lastSeen?.toDate ? Date.now() - u.lastSeen.toDate().getTime() < 300000 : false);
  const cats = me?.chatCategories || {}, hidden = me?.hiddenChats || [], pinned = me?.pinnedChats || {}, following = me?.following || [];
  const uMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const inboxList = convos
    .filter((cv) => {
      const otherId = cv.type === 'group' ? cv.id : (cv.participants || []).find((p: string) => p !== myUid);
      if (!otherId || hidden.includes(otherId) || hidden.includes(cv.id)) return false;
      const u = uMap[otherId];
      const name = cv.type === 'group' ? (cv.groupName || 'Group') : (u?.username || '');
      if (search.trim() && !name.toLowerCase().includes(search.toLowerCase())) return false;
      const isReq = cv.type !== 'group' && !following.includes(otherId) && !cats[otherId];
      if (inReq) return isReq;
      if (isReq) return false;
      const cat = cats[otherId] || 'primary';
      return tab === 'all' || cat === tab;
    })
    .sort((a, b) => (pinned[b.id] ? 1 : 0) - (pinned[a.id] ? 1 : 0) || (b.updatedAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || 0));

  const handleMore = async (key: string) => {
    if (!myUid || !selected.length) return;
    const upd: any = {};
    selected.forEach((id) => {
      if (key === 'pin') upd[`pinnedChats.${id}`] = !pinned[id];
      if (key === 'move') upd[`chatCategories.${id}`] = cats[id] === 'general' ? 'primary' : 'general';
      if (key === 'unread') upd[`unreadChats.${id}`] = true;
      if (key === 'followup') upd[`followUpChats.${id}`] = true;
      if (key === 'muteMsg') upd[`mutedMsgChats.${id}`] = true;
    });
    if (key === 'delete') upd.hiddenChats = arrayUnion(...selected);
    if (key === 'block') upd.blockedUsers = arrayUnion(...selected);
    await updateDoc(doc(db, 'users', myUid), upd);
    setSelectMode(false); setSelected([]);
  };

  const createGroup = async (memberIds: string[], groupName: string) => {
    const ref = await addDoc(collection(db, 'conversations'), {
      type: 'group', groupName, participants: [myUid, ...memberIds], admins: [myUid], lastMessage: 'Group created', updatedAt: serverTimestamp(),
    });
    setActiveChat({ chatId: ref.id, targetUid: '', targetName: groupName, convo: { id: ref.id, type: 'group', groupName, participants: [myUid, ...memberIds] } });
  };

  if (activeChat) {
    return (
      <DmChatRoom
        myUid={myUid} me={me} chatId={activeChat.chatId} convo={activeChat.convo} targetUid={activeChat.targetUid} targetName={activeChat.targetName}
        otherUser={uMap[activeChat.targetUid]} msgs={msgs} c={c} onBack={() => setActiveChat(null)}
        labelText={cats[activeChat.targetUid] || 'primary'}
        onToggleLabel={() => updateDoc(doc(db, 'users', myUid), { [`chatCategories.${activeChat.targetUid}`]: cats[activeChat.targetUid] === 'general' ? 'primary' : 'general' })}
        onForward={() => Alert.alert('Forward', 'Pick a user from inbox.', [{ text: 'OK', onPress: () => setActiveChat(null) }])}
      />
    );
  }

  if (inReq) {
    const reqUsers = inboxList.map((cv) => uMap[(cv.participants || []).find((p: string) => p !== myUid)]).filter(Boolean);
    return (
      <DmRequestsView
        users={reqUsers} spamCount={0} spamView={spamView} setSpamView={setSpamView} c={c}
        onBack={() => setInReq(false)}
        onOpen={(u: any) => setActiveChat({ chatId: [myUid, u.id].sort().join('_'), targetUid: u.id, targetName: u.username })}
        onAccept={(uid: string) => updateDoc(doc(db, 'users', myUid), { [`chatCategories.${uid}`]: 'primary' })}
      />
    );
  }

  const myDp = me?.photoUrl || me?.avatar || '';
  const myNoteActive = me?.note && (!me.note.expiresAt || me.note.expiresAt > Date.now());
  const noteUsers = users.filter((u) => canSeeNote(u.note, myUid, u.id, me) || (following.includes(u.id) && isOnline(u)));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.hdr}>
        {selectMode ? (
          <><TouchableOpacity onPress={() => { setSelectMode(false); setSelected([]); }}><Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text></TouchableOpacity><Text style={{ color: c.text, fontWeight: '800' }}>{selected.length} selected</Text><TouchableOpacity onPress={() => setModals((m) => ({ ...m, more: true }))}><Text style={{ color: BRAND, fontWeight: '800' }}>More</Text></TouchableOpacity></>
        ) : (
          <><View style={{ width: 52 }} /><TouchableOpacity onPress={() => setModals((m) => ({ ...m, acc: true }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{me?.username || 'Messages'}</Text><Ionicons name="chevron-down" size={16} color={c.text} /></TouchableOpacity><View style={{ flexDirection: 'row', gap: 14 }}><TouchableOpacity onPress={() => setSelectMode(true)}><Ionicons name="ellipsis-horizontal" size={22} color={c.text} /></TouchableOpacity><TouchableOpacity onPress={() => setModals((m) => ({ ...m, newChat: true }))}><Ionicons name="create-outline" size={22} color={c.text} /></TouchableOpacity></View></>
        )}
      </View>

      <View style={[s.sBox, { backgroundColor: c.input }]}><Ionicons name="search" size={17} color={c.muted} /><TextInput value={search} onChangeText={setSearch} placeholder="Search messages or groups..." placeholderTextColor={c.muted} style={{ flex: 1, color: c.text }} /></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.notesRow} contentContainerStyle={{ paddingHorizontal: 14, gap: 14 }}>
        <TouchableOpacity style={s.noteItem} onPress={() => setModals((m) => ({ ...m, note: true }))}>
          <View style={[s.noteBubble, { backgroundColor: c.card, borderColor: c.border }]}><Text style={{ color: myNoteActive ? c.text : c.muted, fontSize: 10, fontWeight: '700' }} numberOfLines={1}>{myNoteActive ? (me.note.text || 'Note') : 'Note...'}</Text></View>
          {myDp ? <Image source={{ uri: myDp }} style={s.noteAv} /> : <View style={[s.noteAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={26} color="#fff" /></View>}
          <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>Your note</Text>
        </TouchableOpacity>
        {noteUsers.map((u) => (
          <TouchableOpacity key={u.id} style={s.noteItem} onPress={() => setActiveChat({ chatId: [myUid, u.id].sort().join('_'), targetUid: u.id, targetName: u.username })}>
            {canSeeNote(u.note, myUid, u.id, me) ? <View style={[s.noteBubble, { backgroundColor: c.card, borderColor: c.border }]}><Text style={{ color: c.text, fontSize: 10 }} numberOfLines={1}>{u.note.text || '♪'}</Text></View> : <View style={{ height: 22 }} />}
            <View>{u.photoUrl ? <Image source={{ uri: u.photoUrl }} style={s.noteAv} /> : <View style={[s.noteAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={26} color="#fff" /></View>}{isOnline(u) && <View style={[s.onlineDot, { borderColor: c.background }]} />}</View>
            <Text style={{ color: c.text, fontSize: 11, marginTop: 4 }} numberOfLines={1}>{u.username}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={s.tabs}>
        {(['all', 'primary', 'general'] as const).map((t) => <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.pill, { backgroundColor: tab === t ? `${BRAND}22` : c.card }]}><Text style={{ color: tab === t ? BRAND : c.text, fontWeight: '700', fontSize: 13 }}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text></TouchableOpacity>)}
        <TouchableOpacity onPress={() => setInReq(true)} style={[s.pill, { backgroundColor: c.card }]}><Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>Requests ›</Text></TouchableOpacity>
      </View>

      <FlatList
        data={inboxList} keyExtractor={(i) => i.id}
        ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No messages yet. Tap ✏️ to start a chat!</Text>}
        renderItem={({ item }) => {
          const isG = item.type === 'group';
          const otherId = isG ? item.id : (item.participants || []).find((p: string) => p !== myUid);
          const u = uMap[otherId];
          const dp = u?.photoUrl || u?.avatar || '';
          const title = isG ? item.groupName : (u?.username || 'user');
          const isSel = selected.includes(otherId);
          return (
            <TouchableOpacity style={s.chatRow} onPress={() => (selectMode ? setSelected((p) => (p.includes(otherId) ? p.filter((x) => x !== otherId) : [...p, otherId])) : setActiveChat({ chatId: item.id, targetUid: isG ? '' : otherId, targetName: title, convo: item }))}>
              <View>{dp ? <Image source={{ uri: dp }} style={s.chatAv} /> : <View style={[s.chatAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name={isG ? 'people' : 'person'} size={22} color="#fff" /></View>}{!isG && isOnline(u) && <View style={[s.onlineDot, { borderColor: c.background }]} />}</View>
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{pinned[item.id] ? '📌 ' : ''}{title}</Text><Text style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>{item.lastMessage || 'Tap to message'}</Text></View>
              {selectMode && <Ionicons name={isSel ? 'checkbox' : 'square-outline'} size={22} color={isSel ? BRAND : c.muted} />}
            </TouchableOpacity>
          );
        }}
      />

      <AccountSwitcherModal visible={modals.acc} accounts={accounts} currentUid={myUid} c={c} onClose={() => setModals((m) => ({ ...m, acc: false }))} onAdd={() => signOut(auth)} />
      <SelectMoreModal visible={modals.more} c={c} onClose={() => setModals((m) => ({ ...m, more: false }))} onAction={handleMore} />
      <NewChatModal visible={modals.newChat} users={users} c={c} onClose={() => setModals((m) => ({ ...m, newChat: false }))} onPick={(u: any) => { setActiveChat({ chatId: [myUid, u.id].sort().join('_'), targetUid: u.id, targetName: u.username }); setModals((m) => ({ ...m, newChat: false })); }} onCreateGroup={createGroup} />
      <NoteModal visible={modals.note} me={me} users={users} onClose={() => setModals((m) => ({ ...m, note: false }))} />
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingHorizontal: 16, paddingBottom: 8 },
  sBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, marginBottom: 10, paddingHorizontal: 12, borderRadius: 12, height: 38 },
  notesRow: { maxHeight: 112, marginBottom: 6 },
  noteItem: { alignItems: 'center', width: 68 },
  noteBubble: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 7, paddingVertical: 3, marginBottom: -8, zIndex: 5, maxWidth: 68 },
  noteAv: { width: 58, height: 58, borderRadius: 29 },
  onlineDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, position: 'absolute', right: 0, bottom: 0 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 14, marginBottom: 8 },
  pill: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  chatAv: { width: 48, height: 48, borderRadius: 24 },
});
