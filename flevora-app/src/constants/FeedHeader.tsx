import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { collection, query, where, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, NEON } from './theme';
import { FlevoraLogo } from './FlevoraLogo';
import { StoryCreatorModal } from './StoryCreatorModal';
import { StoryViewerModal } from './StoryViewerModal';
import { NotificationModal } from './NotificationModal';
import { CreateMenuModal } from './ProfileModals';
import UploadScreen from '../app/upload';

export { CommentModal } from './CommentModal';

export function FeedHeader() {
  const { c } = useTheme();
  const uid = auth.currentUser?.uid || '';
  const [me, setMe] = useState<any>(null);
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [stories, setStories] = useState<any[]>([]);
  const [viewStories, setViewStories] = useState<any[] | null>(null);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [uploadMode, setUploadMode] = useState<'POST' | 'REEL' | 'STORY' | 'LIVE' | null>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

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
    const u3 = onSnapshot(query(collection(db, 'notifications'), where('toUid', '==', uid), where('read', '==', false)), (sn) => setUnreadCount(sn.size), () => {});
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
  const myRingColor = hasMyStory ? (myStories[0]?.closeFriendsOnly ? '#10B981' : NEON.magenta) : c.border;

  return (
    <View style={{ backgroundColor: c.background }}>
      <View style={[s.topBar, { borderBottomColor: c.border }]}>
        <FlevoraLogo size={34} showText />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8}>
            <Ionicons name="add-circle-outline" size={28} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setNotifOpen(true)} hitSlop={8}>
            <Ionicons name={unreadCount > 0 ? 'heart' : 'heart-outline'} size={26} color={unreadCount > 0 ? NEON.pink : c.text} />
            {unreadCount > 0 && (
              <View style={[s.badge, { borderColor: c.background }]}>
                <Text style={s.badgeTxt}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.storyBar, { borderBottomColor: c.border }]}>
        <View style={s.storyItem}>
          <TouchableOpacity activeOpacity={0.85} onPress={() => (hasMyStory ? setViewStories(myStories) : setCreatorOpen(true))}>
            <View style={[s.ring, { borderColor: myRingColor }]}>
              {myDp ? <Image source={{ uri: myDp }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={26} color="#fff" /></View>}
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
              <View style={[s.ring, { borderColor: first.closeFriendsOnly ? '#10B981' : NEON.pink }]}>
                <Image source={{ uri: dp }} style={s.avatar} />
              </View>
              <Text style={[s.storyName, { color: c.text }]} numberOfLines={1}>{u?.username || first.username}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <CreateMenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} c={c} onSelect={(k: string) => setUploadMode(k.toUpperCase() as any)} />
      <Modal visible={!!uploadMode} animationType="slide" onRequestClose={() => setUploadMode(null)}>
        <UploadScreen initialMode={uploadMode || 'POST'} onClose={() => setUploadMode(null)} />
      </Modal>
      <StoryCreatorModal visible={creatorOpen} onClose={() => setCreatorOpen(false)} />
      <StoryViewerModal visible={!!viewStories} stories={viewStories || []} onClose={() => setViewStories(null)} onAddStory={() => { setViewStories(null); setCreatorOpen(true); }} />
      <NotificationModal visible={notifOpen} onClose={() => setNotifOpen(false)} />
    </View>
  );
}

const s = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingTop: 48, paddingBottom: 10, borderBottomWidth: 0.5 },
  badge: { position: 'absolute', top: -4, right: -6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  badgeTxt: { color: '#fff', fontSize: 10, fontWeight: '800' },
  storyBar: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 0.5 },
  storyItem: { alignItems: 'center', marginRight: 14, width: 70 },
  ring: { width: 68, height: 68, borderRadius: 34, borderWidth: 2.5, justifyContent: 'center', alignItems: 'center', padding: 2 },
  avatar: { width: 60, height: 60, borderRadius: 30 },
  plusBadge: { position: 'absolute', right: 2, bottom: 18, width: 22, height: 22, borderRadius: 11, backgroundColor: NEON.pink, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  storyName: { fontSize: 11, fontWeight: '600', marginTop: 4 },
});
