import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
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
  const [convos, setConvos] = useState<Record<string, any>>({});
  const [accounts, setAccounts] = useState<any[]>([]);
  const [tab, setTab] = useState<'all' | 'primary' | 'general'>('all');
  const [inReq, setInReq] = useState(false);
  const [spamView, setSpamView] = useState(false);
  const [targetUid, setTargetUid] = useState(params.uid || '');
  const [targetName, setTargetName] = useState(params.name || 'Chat');
  const [msgs, setMsgs] = useState<any[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [modals, setModals] = useState({ menu: false, acc: false, more: false, newChat: false, note: false });

  useEffect(() => { if (params.uid) setTargetUid(params.uid); if (params.name) setTargetName(params.name); }, [params.uid, params.name]);

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== myUid)));
    const u2 = myUid ? onSnapshot(doc(db, 'users', myUid), (s) => {
      if (!s.exists()) return;
      const d = s.data(); setMe(d);
      AsyncStorage.getItem('flevora_accounts').then((raw) => {
        const next = [{ uid: myUid, username: d.username, photoUrl: d.photoUrl }, ...(raw ? JSON.parse(raw) : []).filter((a: any) => a.uid !== myUid)].slice(0, 5);
        setAccounts(next); AsyncStorage.setItem('flevora_accounts', JSON.stringify(next));
      });
    }) : () => {};
    const u3 = onSnapshot(collection(db, 'conversations'), (s) => {
      const m: Record<string, any> = {}; s.docs.forEach((d) => { m[d.id] = d.data(); }); setConvos(m);
    });
    return () => { u1(); u2(); u3(); };
  }, [myUid]);

  useEffect(() => {
    if (!targetUid || !myUid) return;
    const chatId = [myUid, targetUid].sort().join('_');
    return onSnapshot(query(collection(db, 'conversations', chatId, 'messages'), orderBy('createdAt', 'desc'), limit(40)), (s) => {
      setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [targetUid, myUid]);

  const isOnline = (u: any) => u?.isOnline || (u?.lastSeen?.toDate ? Date.now() - u.lastSeen.toDate().getTime() < 300000 : false);
  const cats = me?.chatCategories || {}, hidden = me?.hiddenChats || [], spam = me?.spamChats || [], following = me?.following || [];

  const inboxUsers = users.filter((u) => {
    if (hidden.includes(u.id)) return false;
    if (inReq && spamView) return spam.includes(u.id);
    if (spam.includes(u.id)) return false;
    const isReq = !!convos[[myUid, u.id].sort().join('_')] && !following.includes(u.id) && !cats[u.id];
    if (inReq) return isReq;
    if (isReq) return false;
    const cat = cats[u.id] || 'primary';
    return tab === 'all' || cat === tab;
  });

  const handleMore = async (key: string) => {
    if (!myUid || !selected.length) return;
    const upd: any = {};
    selected.forEach((uid) => {
      if (key === 'move') upd[`chatCategories.${uid}`] = cats[uid] === 'general' ? 'primary' : 'general';
      if (key === 'unread') upd[`unreadChats.${uid}`] = true;
      if (key === 'followup') upd[`followUpChats.${uid}`] = true;
      if (key === 'muteMsg') upd[`mutedMsgChats.${uid}`] = true;
      if (key === 'muteCall') upd[`mutedCallChats.${uid}`] = true;
    });
    if (key === 'block') upd.blockedUsers = arrayUnion(...selected);
    await updateDoc(doc(db, 'users', myUid), upd);
    setSelectMode(false); setSelected([]);
  };

  if (targetUid) {
    return (
      <DmChatRoom
        myUid={myUid} me={me} targetUid={targetUid} targetName={targetName} otherUser={users.find((u) => u.id === targetUid)} msgs={msgs} c={c}
        onBack={() => setTargetUid('')} labelText={me?.followUpChats?.[targetUid] ? 'Follow up' : (cats[targetUid] || 'primary')}
        onToggleLabel={() => updateDoc(doc(db, 'users', myUid), { [`chatCategories.${targetUid}`]: cats[targetUid] === 'general' ? 'primary' : 'general' })}
        onForward={() => Alert.alert('Forward', 'Pick a user from inbox.', [{ text: 'OK', onPress: () => setTargetUid('') }])}
      />
    );
  }

  if (inReq) {
    return (
      <DmRequestsView
        users={inboxUsers} spamCount={spam.length} spamView={spamView} setSpamView={setSpamView} c={c}
        onBack={() => { setInReq(false); setSpamView(false); }}
        onOpen={(u: any) => { setTargetUid(u.id); setTargetName(u.username); }}
        onAccept={(uid: string) => updateDoc(doc(db, 'users', myUid), { [`chatCategories.${uid}`]: 'primary' })}
      />
    );
  }

  const myDp = me?.photoUrl || me?.avatar || '';
  const myNoteActive = me?.note && (!me.note.expiresAt || me.note.expiresAt > Date.now());
  const noteUsers = users.filter((u) => canSeeNote(u.note, myUid, u.id, me) || isOnline(u));

  const renderBubble = (note: any) => (
    <View style={[s.noteBubble, { backgroundColor: c.card, borderColor: c.border }]}>
      {!!note.gifUrl && <Image source={{ uri: note.gifUrl }} style={{ width: 22, height: 22, borderRadius: 4, alignSelf: 'center', marginBottom: 2 }} />}
      <Text style={{ color: c.text, fontSize: 10, fontWeight: '700', textAlign: 'center' }} numberOfLines={2}>
        {note.gif && !note.gifUrl ? `${note.gif} ` : ''}{note.text || (note.music ? `♪ ${note.music.title}` : note.location || 'Note')}
      </Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.hdr}>
        {selectMode ? (
          <>
            <TouchableOpacity onPress={() => { setSelectMode(false); setSelected([]); }}><Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
            <Text style={{ color: c.text, fontWeight: '800' }}>{selected.length} selected</Text>
            <TouchableOpacity onPress={() => setModals((m) => ({ ...m, more: true }))}><Text style={{ color: BRAND, fontWeight: '800' }}>More</Text></TouchableOpacity>
          </>
        ) : (
          <>
            <View style={{ width: 52 }} />
            <TouchableOpacity onPress={() => setModals((m) => ({ ...m, acc: true }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{me?.username || 'Messages'}</Text>
              <Ionicons name="chevron-down" size={16} color={c.text} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', gap: 14 }}>
              <TouchableOpacity onPress={() => setSelectMode(true)}><Ionicons name="ellipsis-horizontal" size={22} color={c.text} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setModals((m) => ({ ...m, newChat: true }))}><Ionicons name="create-outline" size={22} color={c.text} /></TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.notesRow} contentContainerStyle={{ paddingHorizontal: 14, gap: 14 }}>
        <TouchableOpacity style={s.noteItem} onPress={() => setModals((m) => ({ ...m, note: true }))}>
          {myNoteActive ? renderBubble(me.note) : <View style={[s.noteBubble, { backgroundColor: c.card, borderColor: c.border }]}><Text style={{ color: c.muted, fontSize: 10 }}>Note...</Text></View>}
          {myDp ? <Image source={{ uri: myDp }} style={s.noteAv} /> : <View style={[s.noteAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={26} color="#fff" /></View>}
          <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }} numberOfLines={1}>Your note</Text>
        </TouchableOpacity>

        {noteUsers.map((u) => {
          const hasNote = canSeeNote(u.note, myUid, u.id, me);
          const dp = u.photoUrl || u.avatar || '';
          return (
            <TouchableOpacity key={u.id} style={s.noteItem} onPress={() => { setTargetUid(u.id); setTargetName(u.username); }}>
              {hasNote ? renderBubble(u.note) : <View style={{ height: 22 }} />}
              <View>
                {dp ? <Image source={{ uri: dp }} style={s.noteAv} /> : <View style={[s.noteAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={26} color="#fff" /></View>}
                {isOnline(u) && <View style={[s.onlineDot, { borderColor: c.background }]} />}
              </View>
              <Text style={{ color: c.text, fontSize: 11, marginTop: 4 }} numberOfLines={1}>{u.username}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.tabs}>
        {(['all', 'primary', 'general'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.pill, { backgroundColor: tab === t ? `${BRAND}22` : c.card }]}>
            <Text style={{ color: tab === t ? BRAND : c.text, fontWeight: '700', fontSize: 13 }}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => setInReq(true)} style={[s.pill, { backgroundColor: c.card }]}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }}>Requests ›</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={inboxUsers}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => {
          const dp = item.photoUrl || item.avatar || '';
          const isSel = selected.includes(item.id);
          return (
            <TouchableOpacity
              style={s.chatRow}
              onPress={() => (selectMode ? setSelected((p) => (p.includes(item.id) ? p.filter((x) => x !== item.id) : [...p, item.id])) : (setTargetUid(item.id), setTargetName(item.username)))}
            >
              <View>
                {dp ? <Image source={{ uri: dp }} style={s.chatAv} /> : <View style={[s.chatAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={22} color="#fff" /></View>}
                {isOnline(item) && <View style={[s.onlineDot, { borderColor: c.background }]} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{item.username}</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>{isOnline(item) ? 'Active now' : 'Tap to message'}</Text>
              </View>
              {selectMode && <Ionicons name={isSel ? 'checkbox' : 'square-outline'} size={22} color={isSel ? BRAND : c.muted} />}
            </TouchableOpacity>
          );
        }}
      />

      <AccountSwitcherModal visible={modals.acc} accounts={accounts} currentUid={myUid} c={c} onClose={() => setModals((m) => ({ ...m, acc: false }))} onAdd={() => signOut(auth)} />
      <SelectMoreModal visible={modals.more} c={c} onClose={() => setModals((m) => ({ ...m, more: false }))} onAction={handleMore} />
      <NewChatModal visible={modals.newChat} users={users} c={c} onClose={() => setModals((m) => ({ ...m, newChat: false }))} onPick={(u: any) => { setTargetUid(u.id); setTargetName(u.username); setModals((m) => ({ ...m, newChat: false })); }} />
      <NoteModal visible={modals.note} me={me} users={users} onClose={() => setModals((m) => ({ ...m, note: false }))} />
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingHorizontal: 16, paddingBottom: 10 },
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
