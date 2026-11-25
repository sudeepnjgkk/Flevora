import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND } from './theme';
import { StoryCreatorModal } from './StoryCreatorModal';
import { StoryViewerModal } from './StoryViewerModal';
import { NotificationModal } from './NotificationModal';

export { CommentModal } from './CommentModal';

export function FeedHeader() {
  const { c } = useTheme();
  const uid = auth.currentUser?.uid || '';
  const [me, setMe] = useState<any>({});
  const [stories, setStories] = useState<any[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [viewIdx, setViewIdx] = useState<number | null>(null);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'stories'), orderBy('createdAt', 'desc')), (s) => {
      setStories(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    const u2 = uid ? onSnapshot(doc(db, 'users', uid), (s) => s.exists() && setMe(s.data())) : () => {};
    const u3 = uid ? onSnapshot(query(collection(db, 'notifications'), where('toUid', '==', uid), where('read', '==', false)), (s) => setHasUnread(!s.empty), () => {}) : () => {};
    return () => { u1(); u2(); u3(); };
  }, [uid]);

  const myStoryIdx = stories.findIndex((st) => st.uid === uid);
  const otherStories = stories.filter((st) => st.uid !== uid);
  const av = me?.photoUrl || me?.avatar;

  return (
    <View style={{ backgroundColor: c.background }}>
      <View style={s.top}>
        <TouchableOpacity onPress={() => setShowCreate(true)} hitSlop={12}><Ionicons name="add" size={28} color={c.text} /></TouchableOpacity>
        <Text style={[s.logo, { color: c.text }]}>Flevora</Text>
        <TouchableOpacity onPress={() => setShowNotif(true)} hitSlop={12} style={{ position: 'relative' }}>
          <Ionicons name="heart-outline" size={26} color={c.text} />
          {hasUnread && <View style={s.dot} />}
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row}>
        <TouchableOpacity style={s.item} onPress={() => (myStoryIdx >= 0 ? setViewIdx(myStoryIdx) : setShowCreate(true))}>
          <View style={[s.ring, myStoryIdx >= 0 && { borderColor: BRAND, borderWidth: 2.5 }]}>
            {av ? <Image source={{ uri: av }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={26} color="#fff" /></View>}
            <TouchableOpacity style={s.plus} onPress={() => setShowCreate(true)}><Ionicons name="add" size={14} color="#fff" /></TouchableOpacity>
          </View>
          <Text style={[s.lbl, { color: c.muted }]}>Your story</Text>
        </TouchableOpacity>

        {otherStories.map((st) => {
          const idx = stories.findIndex((x) => x.id === st.id);
          return (
            <TouchableOpacity key={st.id} style={s.item} onPress={() => setViewIdx(idx)}>
              <View style={[s.ring, { borderColor: BRAND, borderWidth: 2.5 }]}>
                {st.userPhoto ? <Image source={{ uri: st.userPhoto }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={26} color="#fff" /></View>}
              </View>
              <Text style={[s.lbl, { color: c.text }]} numberOfLines={1}>{st.username || 'User'}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <StoryCreatorModal visible={showCreate} onClose={() => setShowCreate(false)} uid={uid} user={me} me={me} />
      <NotificationModal visible={showNotif} onClose={() => setShowNotif(false)} c={c} />
      {viewIdx !== null && <StoryViewerModal {...({ visible: true, stories, initialIndex: viewIdx, myUid: uid, me, c, onClose: () => setViewIdx(null) } as any)} />}
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 46, paddingBottom: 8, paddingHorizontal: 16 },
  logo: { fontSize: 22, fontWeight: '800', letterSpacing: 0.3 },
  dot: { position: 'absolute', top: 0, right: 0, width: 9, height: 9, borderRadius: 5, backgroundColor: '#EF4444' },
  row: { paddingHorizontal: 12, paddingVertical: 8, gap: 14 },
  item: { alignItems: 'center', width: 70 },
  ring: { padding: 2.5, borderRadius: 36, position: 'relative' },
  av: { width: 62, height: 62, borderRadius: 31 },
  ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  plus: { position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: '#111827', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  lbl: { fontSize: 11, marginTop: 4 },
});
