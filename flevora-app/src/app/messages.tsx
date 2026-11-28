import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, query, where, orderBy, limit, onSnapshot, doc, addDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from '../constants/theme';
import { useLang } from '../constants/i18n';
import { dmT, formatMsgTime } from '../constants/dmCapabilities';
import { AccountSwitcherModal, SelectMoreModal, NewChatModal } from '../constants/DmModals';
import { NoteModal, NoteDetailModal, canSeeNote } from '../constants/NoteModal';
import { DmChatRoom } from '../constants/DmChatRoom';
import { DmRequestsView } from '../constants/DmRequestsView';
import { BroadcastChannelsHub } from '../constants/BroadcastChannelsHub';

export default function MessagesScreen() {
  const params = useLocalSearchParams<{ uid?: string; name?: string }>();
  const { c } = useTheme();
  const { lang } = useLang();
  const L = dmT(lang);
  const myUid = auth.currentUser?.uid || '';

  const [me, setMe] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [convos, setConvos] = useState<any[]>([]);
  const [notesMap, setNotesMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'all' | 'primary' | 'general'>('all');
  const [inReq, setInReq] = useState(false);
  const [spamView, setSpamView] = useState(false);
  const [activeChat, setActiveChat] = useState<{ chatId: string; targetUid: string; targetName: string; convo?: any } | null>(
    params.uid ? { chatId: [myUid, params.uid].sort().join('_'), targetUid: params.uid, targetName: params.name || 'Chat' } : null
  );
  const [msgs, setMsgs] = useState<any[]>([]);
  const [msgLimit, setMsgLimit] = useState(40);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [detailNote, setDetailNote] = useState<{ note: any; owner: any } | null>(null);
  const [modals, setModals] = useState({ acc: false, more: false, newChat: false, note: false, channels: false });

  useEffect(() => {
    setMe(null); setConvos([]); setMsgs([]);
    if (!myUid) return;
    setLoading(true);
    const u1 = onSnapshot(collection(db, 'users'), (s) => setUsers(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== myUid)), () => {});
    const u2 = onSnapshot(doc(db, 'users', myUid), (s) => {
      if (!s.exists()) return;
      const d = s.data(); setMe(d);
      AsyncStorage.getItem('flevora_accounts').then((raw) => {
        const next = [{ uid: myUid, username: d.username, photoUrl: d.photoUrl || d.avatar }, ...(raw ? JSON.parse(raw) : []).filter((a: any) => a.uid !== myUid)].slice(0, 5);
        setAccounts(next); AsyncStorage.setItem('flevora_accounts', JSON.stringify(next));
      });
    }, () => {});
    const u3 = onSnapshot(query(collection(db, 'conversations'), where('participants', 'array-contains', myUid)), (s) => {
      setConvos(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    const u4 = onSnapshot(collection(db, 'notes'), (s) => {
      const m: Record<string, any> = {};
      s.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
      setNotesMap(m);
    }, () => {});
    return () => { u1(); u2(); u3(); u4(); };
  }, [myUid]);

  useEffect(() => {
    if (!activeChat?.chatId || !myUid) return setMsgs([]);
    return onSnapshot(query(collection(db, 'conversations', activeChat.chatId, 'messages'), orderBy('createdAt', 'desc'), limit(msgLimit)), (s) => {
      setMsgs(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [activeChat?.chatId, myUid, msgLimit]);
    const isOnline = (u: any) => me?.showOnline !== false && u?.showOnline !== false && (u?.isOnline || (u?.lastSeen?.toDate ? Date.now() - u.lastSeen.toDate().getTime() < 300000 : false));
  const cats = me?.chatCategories || {}, hidden = me?.hiddenChats || [], pinned = me?.pinnedChats || {}, following = me?.following || [], spam = me?.spamChats || [];
  const uMap = Object.fromEntries(users.map((u) => [u.id, u]));

  const reqConvos = convos.filter((cv) => {
    const otherId = cv.type === 'group' ? cv.id : (cv.participants || []).find((p: string) => p !== myUid);
    if (!otherId || hidden.includes(otherId) || hidden.includes(cv.id)) return false;
    return cv.type !== 'group' && !following.includes(otherId) && !cats[otherId];
  });

  const inboxList = convos
    .filter((cv) => {
      const otherId = cv.type === 'group' ? cv.id : (cv.participants || []).find((p: string) => p !== myUid);
      if (!otherId || hidden.includes(otherId) || hidden.includes(cv.id)) return false;
      const u = uMap[otherId];
      const name = cv.type === 'group' ? (cv.groupName || 'Group') : (u?.username || '');
      const lastTxt = cv.lastMessage || '';
      if (search.trim() && !name.toLowerCase().includes(search.toLowerCase()) && !lastTxt.toLowerCase().includes(search.toLowerCase())) return false;
      const isReq = cv.type !== 'group' && !following.includes(otherId) && !cats[otherId];
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
      if (key === 'unread') upd[`unreadChats.${id}`] = !me?.unreadChats?.[id];
      if (key === 'followup') upd[`followUpChats.${id}`] = true;
      if (key === 'muteMsg') upd[`mutedMsgChats.${id}`] = !me?.mutedMsgChats?.[id];
    });
    if (key === 'delete') upd.hiddenChats = arrayUnion(...selected);
    if (key === 'block') upd.blockedUsers = arrayUnion(...selected);
    await updateDoc(doc(db, 'users', myUid), upd);
    setSelectMode(false); setSelected([]);
  };

  const createGroup = async (memberIds: string[], groupName: string, groupDesc = '') => {
    const ref = await addDoc(collection(db, 'conversations'), {
      type: 'group', groupName, groupDesc, participants: [myUid, ...memberIds], admins: [myUid], lastMessage: 'Group created', updatedAt: serverTimestamp(),
    });
    setActiveChat({ chatId: ref.id, targetUid: '', targetName: groupName, convo: { id: ref.id, type: 'group', groupName, groupDesc, participants: [myUid, ...memberIds], admins: [myUid] } });
  };

  const replyToNoteInDm = async (targetUid: string, uname: string, replyText: string, noteObj?: any) => {
    if (!myUid || !targetUid || !replyText.trim()) return;
    const cid = [myUid, targetUid].sort().join('_');
    await setDoc(doc(db, 'conversations', cid), { participants: [myUid, targetUid], updatedAt: serverTimestamp(), lastMessage: `Note reply: ${replyText}`, lastSenderUid: myUid }, { merge: true });
    await addDoc(collection(db, 'conversations', cid, 'messages'), {
      senderUid: myUid, senderName: me?.username || 'user', text: `Note reply (${noteObj?.text || 'Note'}): ${replyText}`,
      mediaType: 'text', noteId: noteObj?.id || targetUid, read: false, createdAt: serverTimestamp(),
    });
    if (targetUid !== myUid) {
      await addDoc(collection(db, 'notifications'), {
        toUid: targetUid, fromUid: myUid, fromUsername: me?.username || 'user',
        type: 'note_reply', noteId: noteObj?.id || targetUid, message: `replied to your note: ${replyText}`,
        read: false, createdAt: serverTimestamp(),
      }).catch(() => {});
    }
    setActiveChat({ chatId: cid, targetUid, targetName: uname });
  };

  if (activeChat) {
    const liveConvo = convos.find((cv) => cv.id === activeChat.chatId) || activeChat.convo;
    return (
      <DmChatRoom
        myUid={myUid} me={me} chatId={activeChat.chatId} convo={liveConvo} targetUid={activeChat.targetUid} targetName={activeChat.targetName}
        otherUser={uMap[activeChat.targetUid]} allUsers={users} msgs={msgs} c={c}
        onLoadMore={() => setMsgLimit((n) => n + 30)}
        onBack={() => { setActiveChat(null); setMsgLimit(40); }}
      />
    );
  }

  if (inReq) {
    const reqUsers = reqConvos.filter((cv) => !spam.includes((cv.participants || []).find((p: string) => p !== myUid))).map((cv) => uMap[(cv.participants || []).find((p: string) => p !== myUid)]).filter(Boolean);
    const spamUsers = reqConvos.filter((cv) => spam.includes((cv.participants || []).find((p: string) => p !== myUid))).map((cv) => uMap[(cv.participants || []).find((p: string) => p !== myUid)]).filter(Boolean);
    return (
      <DmRequestsView
        users={reqUsers} spamUsers={spamUsers} spamView={spamView} setSpamView={setSpamView} c={c}
        onBack={() => setInReq(false)}
        onOpen={(u: any) => setActiveChat({ chatId: [myUid, u.id].sort().join('_'), targetUid: u.id, targetName: u.username })}
        onAccept={(uid: string) => updateDoc(doc(db, 'users', myUid), { [`chatCategories.${uid}`]: 'primary' })}
        onDeleteReq={(uid: string) => updateDoc(doc(db, 'users', myUid), { spamChats: arrayUnion(uid) })}
        onBlockReq={(uid: string) => updateDoc(doc(db, 'users', myUid), { blockedUsers: arrayUnion(uid) })}
        onReportReq={(uid: string) => { addDoc(collection(db, 'reports'), { targetUid: uid, type: 'message_request', status: 'pending', reportedBy: myUid, reporterUid: myUid, createdAt: serverTimestamp() }); Alert.alert('Reported', 'Request reported.'); }}
      />
    );
  }

  const myDp = me?.photoUrl || me?.avatar || '';
  const myNote = notesMap[myUid] || me?.note;
  const myNoteActive = canSeeNote(myNote, myUid, myUid, me, me);
  const noteUsers = users.filter((u) => canSeeNote(notesMap[u.id] || u.note, myUid, u.id, me, u) || (following.includes(u.id) && isOnline(u)));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.hdr}>
        {selectMode ? (
          <><TouchableOpacity onPress={() => { setSelectMode(false); setSelected([]); }}><Text style={{ color: c.text, fontWeight: '700' }}>Cancel</Text></TouchableOpacity><Text style={{ color: c.text, fontWeight: '800' }}>{selected.length} selected</Text><TouchableOpacity onPress={() => setModals((m) => ({ ...m, more: true }))}><Text style={{ color: BRAND, fontWeight: '800' }}>More</Text></TouchableOpacity></>
        ) : (
          <><TouchableOpacity onPress={() => setModals((m) => ({ ...m, channels: true }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Ionicons name="megaphone-outline" size={21} color={BRAND} /><Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>Channels</Text></TouchableOpacity><TouchableOpacity onPress={() => setModals((m) => ({ ...m, acc: true }))} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>{me?.username || L.messages}</Text><Ionicons name="chevron-down" size={16} color={c.text} /></TouchableOpacity><View style={{ flexDirection: 'row', gap: 14 }}><TouchableOpacity onPress={() => setSelectMode(true)}><Ionicons name="ellipsis-horizontal" size={22} color={c.text} /></TouchableOpacity><TouchableOpacity onPress={() => setModals((m) => ({ ...m, newChat: true }))}><Ionicons name="create-outline" size={22} color={c.text} /></TouchableOpacity></View></>
        )}
      </View>

      <View style={[s.sBox, { backgroundColor: c.input }]}><Ionicons name="search" size={17} color={c.muted} /><TextInput value={search} onChangeText={setSearch} placeholder={L.searchPlaceholder} placeholderTextColor={c.muted} style={{ flex: 1, color: c.text }} /></View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.notesRow} contentContainerStyle={{ paddingHorizontal: 14, gap: 14 }}>
        <TouchableOpacity style={s.noteItem} onPress={() => (myNoteActive ? setDetailNote({ note: myNote, owner: me }) : setModals((m) => ({ ...m, note: true })))} onLongPress={() => setModals((m) => ({ ...m, note: true }))}>
          <View style={[s.noteBubble, { backgroundColor: c.card, borderColor: myNoteActive && myNote?.audience === 'closeFriends' ? '#10B981' : c.border }]}>
            <Text style={{ color: myNoteActive ? c.text : c.muted, fontSize: 10, fontWeight: '700' }} numberOfLines={1}>{myNoteActive ? (myNote.promptQuestion || myNote.text || (myNote.videoUrl ? '🎥 Video' : 'Note')) : 'Note...'}</Text>
          </View>
          {myDp ? <Image source={{ uri: myDp }} style={s.noteAv} /> : <View style={[s.noteAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={26} color={BRAND_TEXT} /></View>}
          <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>Your note</Text>
        </TouchableOpacity>
        {noteUsers.map((u) => {
          const uNote = notesMap[u.id] || u.note;
          const visible = canSeeNote(uNote, myUid, u.id, me, u);
          return (
            <TouchableOpacity key={u.id} style={s.noteItem} onPress={() => (visible ? setDetailNote({ note: uNote, owner: u }) : setActiveChat({ chatId: [myUid, u.id].sort().join('_'), targetUid: u.id, targetName: u.username }))}>
              {visible ? <View style={[s.noteBubble, { backgroundColor: c.card, borderColor: uNote?.audience === 'closeFriends' ? '#10B981' : c.border }]}><Text style={{ color: c.text, fontSize: 10 }} numberOfLines={1}>{uNote.promptQuestion || uNote.text || (uNote.videoUrl ? '🎥' : 'Note')}</Text></View> : <View style={{ height: 22 }} />}
              <View>{u.photoUrl || u.avatar ? <Image source={{ uri: u.photoUrl || u.avatar }} style={s.noteAv} /> : <View style={[s.noteAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={26} color={BRAND_TEXT} /></View>}{isOnline(u) && <View style={[s.onlineDot, { borderColor: c.background }]} />}</View>
              <Text style={{ color: c.text, fontSize: 11, marginTop: 4 }} numberOfLines={1}>{u.username}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={s.tabs}>
        {(['all', 'primary', 'general'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.pill, { backgroundColor: tab === t ? BRAND : c.card }]}>
            <Text style={{ color: tab === t ? BRAND_TEXT : c.text, fontWeight: '700', fontSize: 12 }}>{L[t]}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => setInReq(true)} style={[s.pill, { backgroundColor: c.card }]}>
          <Text style={{ color: reqConvos.length ? BRAND : c.text, fontWeight: '700', fontSize: 12 }}>{L.requests}{reqConvos.length ? ` (${reqConvos.length})` : ''} ›</Text>
        </TouchableOpacity>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={BRAND} /> : (
        <FlatList
          data={inboxList} keyExtractor={(i) => i.id}
          ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>{L.noChats}</Text>}
          renderItem={({ item }) => {
            const isG = item.type === 'group';
            const otherId = isG ? item.id : (item.participants || []).find((p: string) => p !== myUid);
            const u = uMap[otherId];
            const dp = u?.photoUrl || u?.avatar || '';
            const title = isG ? item.groupName : (u?.username || 'user');
            const isSel = selected.includes(otherId);
            const isUnread = Boolean(me?.unreadChats?.[otherId] || me?.unreadChats?.[item.id]);
            const isMuted = Boolean(me?.mutedMsgChats?.[otherId] || me?.mutedMsgChats?.[item.id]);
            return (
              <TouchableOpacity
                style={s.chatRow}
                onPress={() => {
                  if (selectMode) setSelected((p) => (p.includes(otherId) ? p.filter((x) => x !== otherId) : [...p, otherId]));
                  else {
                    if (isUnread) updateDoc(doc(db, 'users', myUid), { [`unreadChats.${otherId}`]: false }).catch(() => {});
                    setActiveChat({ chatId: item.id, targetUid: isG ? '' : otherId, targetName: title, convo: item });
                  }
                }}
              >
                <View>{dp ? <Image source={{ uri: dp }} style={s.chatAv} /> : <View style={[s.chatAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name={isG ? 'people' : 'person'} size={22} color={BRAND_TEXT} /></View>}{!isG && isOnline(u) && <View style={[s.onlineDot, { borderColor: c.background }]} />}</View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: c.text, fontWeight: isUnread ? '900' : '700', fontSize: 15 }}>{pinned[item.id] ? '📌 ' : ''}{title}</Text>
                    {isMuted && <Ionicons name="notifications-off" size={13} color={c.muted} />}
                  </View>
                  <Text style={{ color: isUnread ? c.text : c.muted, fontSize: 12, fontWeight: isUnread ? '700' : '400' }} numberOfLines={1}>{item.lastMessage || 'Tap to message'}</Text>
                </View>
                <Text style={{ color: c.muted, fontSize: 11 }}>{formatMsgTime(item.updatedAt)}</Text>
                {isUnread && <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: BRAND }} />}
                {selectMode && <Ionicons name={isSel ? 'checkbox' : 'square-outline'} size={22} color={isSel ? BRAND : c.muted} />}
              </TouchableOpacity>
            );
          }}
        />
      )}

      <AccountSwitcherModal visible={modals.acc} accounts={accounts} currentUid={myUid} c={c} onClose={() => setModals((m) => ({ ...m, acc: false }))} onAdd={() => signOut(auth)} />
      <SelectMoreModal visible={modals.more} c={c} onClose={() => setModals((m) => ({ ...m, more: false }))} onAction={handleMore} />
      <NewChatModal visible={modals.newChat} users={users} c={c} onClose={() => setModals((m) => ({ ...m, newChat: false }))} onPick={(u: any) => { setActiveChat({ chatId: [myUid, u.id].sort().join('_'), targetUid: u.id, targetName: u.username }); setModals((m) => ({ ...m, newChat: false })); }} onCreateGroup={createGroup} />
      <NoteModal visible={modals.note} me={me} users={users} activeNote={myNoteActive ? myNote : null} onClose={() => setModals((m) => ({ ...m, note: false }))} />
      <NoteDetailModal visible={!!detailNote} note={detailNote?.note} owner={detailNote?.owner} me={me} myUid={myUid} allUsers={users} onReplyDm={replyToNoteInDm} onEditOwn={() => setModals((m) => ({ ...m, note: true }))} onClose={() => setDetailNote(null)} />
      <BroadcastChannelsHub visible={modals.channels} myUid={myUid} me={me} allUsers={users} onClose={() => setModals((m) => ({ ...m, channels: false }))} />
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
  tabs: { flexDirection: 'row', gap: 6, paddingHorizontal: 14, marginBottom: 8 },
  pill: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  chatRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  chatAv: { width: 48, height: 48, borderRadius: 24 },
});
                                     
