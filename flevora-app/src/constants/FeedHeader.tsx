import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND } from './theme';
import { StoryCreatorModal } from './StoryCreatorModal';
import { StoryViewerModal } from './StoryViewerModal';
import { NotificationModal } from './NotificationModal';

export { CommentModal } from './CommentModal';

export function FeedHeader() {
  const router = useRouter();
  const { c } = useTheme();
  const uid = auth.currentUser?.uid || '';
  const [me, setMe] = useState<any>(null);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [stories, setStories] = useState<any[]>([]);
  const [viewStories, setViewStories] = useState<any[] | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    const u1 = onSnapshot(query(collection(db, 'stories'), orderBy('createdAt', 'desc')), (snap) => {
      const now = Date.now();
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((st: any) => {
        if (st.expiresAt && st.expiresAt <= now) return false;
        if (st.closeFriendsOnly) return st.uid === uid || (Array.isArray(st.allowedUids) && st.allowedUids.includes(uid));
        return true;
      });
      setStories(list);
    }, () => {});
    const u2 = onSnapshot(collection(db, 'users'), (snap) => {
      const m: Record<string, any> = {};
      snap.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
      setUsersMap(m);
      if (uid && m[uid]) setMe(m[uid]);
    }, () => {});
    if (!uid) return () => { u1(); u2(); };
    const u3 = onSnapshot(query(collection(db, 'notifications'), where('toUid', '==', uid), where('read', '==', false)), (sn) => {
      setHasUnread(!sn.empty);
    }, () => {});
    const u4 = onSnapshot(doc(db, 'users', uid), (d) => { if (d.exists()) setMe({ id: d.id, ...d.data() }); }, () => {});
    return () => { u1(); u2(); u3(); u4(); };
  }, [uid]);

  const { myStories, otherGroups } = useMemo(() => {
    const mine = stories.filter((st) => st.uid === uid);
    const map: Record<string, any[]> = {};
    stories.filter((st) => st.uid !== uid).forEach((st) => {
      if (!map[st.uid]) map[st.uid] = [];
      map[st.uid].push(st);
    });
    return { myStories: mine, otherGroups: Object.values(map) };
  }, [stories, uid]);

  const myDp = me?.photoUrl || me?.avatar || '';
  const hasMyStory = myStories.length > 0;
  const myRingColor = hasMyStory ? (myStories[0]?.closeFriendsOnly ? '#10B981' : BRAND) : 'transparent';

  return (
    <View>
      <View style={[s.topBar, { backgroundColor: c.background, borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => router.push('/upload' as any)} hitSlop={8}>
          <Ionicons name="add" size={28} color={c.text} />
        </TouchableOpacity>
        <Text style={s.logo}>Flevora</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={() => setNotifOpen(true)} hitSlop={8}>
            <Ionicons name="heart-outline" size={24} color={c.text} />
            {hasUnread && <View style={s.dot} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.navigate('/messages' as any)} hitSlop={8}>
            <Ionicons name="chatbubble-ellipses-outline" size={24} color={c.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.storyBar, { borderBottomColor: c.border }]}>
        <View style={s.storyItem}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => (hasMyStory ? setViewStories(myStories) : setCreatorOpen(true))}>
            <View style={[s.ring, { borderColor: myRingColor }]}>
              {myDp ? (
                <Image source={{ uri: myDp }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="person" size={28} color="#fff" />
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={[s.plusBadge, { borderColor: c.background }]} onPress={() => setCreatorOpen(true)} hitSlop={6}>
            <Ionicons name="add" size={14} color="#fff" />
          </TouchableOpacity>
          <Text style={[s.storyName, { color: c.text }]} numberOfLines={1}>Your story</Text>
        </View>

        {otherGroups.map((grp) => {
          const first = grp[0];
          const u = usersMap[first.uid];
          const dp = u?.photoUrl || u?.avatar || first.mediaUrl;
          return (
            <TouchableOpacity key={first.uid} style={s.storyItem} onPress={() => setViewStories(grp)}>
              <View style={[s.ring, { borderColor: first.closeFriendsOnly ? '#10B981' : BRAND }]}>
                <Image source={{ uri: dp }} style={s.avatar} />
              </View>
              <Text style={[s.storyName, { color: c.text }]} numberOfLines={1}>{u?.username || first.username}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <StoryCreatorModal visible={creatorOpen} onClose={() => setCreatorOpen(false)} />
      <StoryViewerModal visible={!!viewStories} stories={viewStories || []} onClose={() => setViewStories(null)} onAddStory={() => { setViewStories(null); setCreatorOpen(true); }} />
      <NotificationModal visible={notifOpen} onClose={() => setNotifOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 48, paddingBottom: 10, borderBottomWidth: 1 },
  logo: { fontSize: 25, fontWeight: '800', color: BRAND },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', position: 'absolute', top: 0, right: 0 },
  storyBar: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1 },
  storyItem: { alignItems: 'center', marginRight: 14, width: 70 },
  ring: { width: 68, height: 68, borderRadius: 34, borderWidth: 2.5, justifyContent: 'center', alignItems: 'center', padding: 2 },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  plusBadge: { position: 'absolute', right: 2, bottom: 18, width: 22, height: 22, borderRadius: 11, backgroundColor: '#111', borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  storyName: { fontSize: 11, marginTop: 4 },
});
    
