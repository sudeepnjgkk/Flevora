import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Modal, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { collection, query, where, orderBy, limit, onSnapshot, updateDoc, doc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { StoryViewerModal } from './StoryViewerModal';

const relTime = (ts: any) => {
  const d = ts?.toDate ? ts.toDate() : null;
  if (!d) return 'now';
  const m = Math.floor((Date.now() - d.getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
};

export function NotificationModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const uid = auth.currentUser?.uid || '';
  const [filter, setFilter] = useState<'all' | 'following' | 'unread'>('all');
  const [lim, setLim] = useState(25);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<any[]>([]);
  const [me, setMe] = useState<any>({});
  const [usersMap, setUsersMap] = useState<Record<string, any>>({});
  const [postsMap, setPostsMap] = useState<Record<string, any>>({});
  const [storiesMap, setStoriesMap] = useState<Record<string, any>>({});
  const [viewStory, setViewStory] = useState<any[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!uid || !visible) return;
    setLoading(true);
    const u1 = onSnapshot(query(collection(db, 'notifications'), where('toUid', '==', uid), orderBy('createdAt', 'desc'), limit(lim)), (s) => {
      setItems(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    const u2 = onSnapshot(collection(db, 'users'), (s) => {
      const m: Record<string, any> = {};
      s.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; });
      setUsersMap(m);
      if (m[uid]) setMe(m[uid]);
    });
    const u3 = onSnapshot(collection(db, 'posts'), (s) => {
      const m: Record<string, any> = {}; s.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; }); setPostsMap(m);
    });
    const u4 = onSnapshot(collection(db, 'stories'), (s) => {
      const m: Record<string, any> = {}; s.docs.forEach((d) => { m[d.id] = { id: d.id, ...d.data() }; }); setStoriesMap(m);
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, [uid, visible, lim]);

  const grouped = useMemo(() => {
    const filtered = items.filter((n) => {
      if (filter === 'unread') return !n.read;
      if (filter === 'following') return Array.isArray(me?.following) && me.following.includes(n.fromUid);
      return true;
    });
    const out: any[] = [];
    const likeGroups: Record<string, any> = {};
    filtered.forEach((n) => {
      if (n.type === 'like' && n.postId) {
        if (!likeGroups[n.postId]) {
          likeGroups[n.postId] = { ...n, groupCount: 1, groupIds: [n.id] };
          out.push(likeGroups[n.postId]);
        } else {
          likeGroups[n.postId].groupCount += 1;
          likeGroups[n.postId].groupIds.push(n.id);
          if (!n.read) likeGroups[n.postId].read = false;
        }
      } else out.push(n);
    });
    return out;
  }, [items, filter, me]);

  const markRead = (item: any) => {
    const ids = item.groupIds || [item.id];
    ids.forEach((id: string) => updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {}));
  };

  const handleFollowBack = async (targetUid: string) => {
    const isF = Array.isArray(me?.following) && me.following.includes(targetUid);
    await updateDoc(doc(db, 'users', uid), { following: isF ? arrayRemove(targetUid) : arrayUnion(targetUid) }).catch(() => {});
    await updateDoc(doc(db, 'users', targetUid), { followers: isF ? arrayRemove(uid) : arrayUnion(uid) }).catch(() => {});
  };

  const handleReq = async (item: any, accept: boolean) => {
    await updateDoc(doc(db, 'notifications', item.id), { actionStatus: accept ? 'accepted' : 'declined', read: true }).catch(() => {});
    if (accept && item.fromUid) {
      await updateDoc(doc(db, 'users', uid), { followers: arrayUnion(item.fromUid) }).catch(() => {});
      await updateDoc(doc(db, 'users', item.fromUid), { following: arrayUnion(uid) }).catch(() => {});
    }
  };

  const handleCollab = async (item: any, accept: boolean) => {
    if (!uid || !item?.postId || busyId === item.id) return;
    setBusyId(item.id);
    try {
      await updateDoc(doc(db, 'posts', item.postId), accept
        ? { pendingCollaborators: arrayRemove(uid), collaborators: arrayUnion(uid) }
        : { pendingCollaborators: arrayRemove(uid) });
      await updateDoc(doc(db, 'notifications', item.id), {
        actionStatus: accept ? 'accepted' : 'declined',
        status: accept ? 'accepted' : 'declined',
        read: true,
      });
    } catch {
      Alert.alert('Error', 'Could not update collaborator invite.');
    } finally {
      setBusyId(null);
    }
  };

  const onTapItem = (item: any) => {
    markRead(item);
    if (item.storyId) {
      const st = storiesMap[item.storyId];
      if (st && (!st.expiresAt || st.expiresAt > Date.now())) setViewStory([st]);
      else Alert.alert('Story Unavailable', 'This story has expired or was deleted.');
      return;
    }
    onClose();
    if (item.postId || item.reelId) router.push(`/reels?startId=${item.postId || item.reelId}` as any);
    else if (item.fromUid) router.push(`/user/${item.fromUid}` as any);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Notifications</Text>
          <TouchableOpacity onPress={() => items.filter((i) => !i.read).forEach((i) => updateDoc(doc(db, 'notifications', i.id), { read: true }))}>
            <Ionicons name="checkmark-done" size={22} color={BRAND} />
          </TouchableOpacity>
        </View>

        <View style={s.tabs}>
          {(['all', 'following', 'unread'] as const).map((t) => (
            <TouchableOpacity key={t} onPress={() => setFilter(t)} style={[s.pill, { backgroundColor: filter === t ? BRAND : c.surface }]}>
              <Text style={{ color: filter === t ? BRAND_TEXT : c.text, fontWeight: '700', fontSize: 13, textTransform: 'capitalize' }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <ActivityIndicator size="large" color={BRAND} style={{ marginTop: 40 }} /> : (
          <FlatList
            data={grouped} keyExtractor={(i) => i.id} onEndReached={() => setLim((n) => n + 20)} onEndReachedThreshold={0.4}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 80 }}>
                <Ionicons name="heart-outline" size={48} color={c.muted} />
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 16, marginTop: 12 }}>You're all caught up!</Text>
              </View>
            }
            renderItem={({ item }) => {
              const u = usersMap[item.fromUid];
              const dp = u?.photoUrl || u?.avatar || '';
              const post = postsMap[item.postId || item.reelId];
              const st = storiesMap[item.storyId];
              const thumb = item.mediaUrl || st?.mediaUrl || (post?.mediaType === 'video' ? post?.mediaUrl?.replace(/\.[^/.]+$/, '.jpg') : post?.mediaUrl);
              const isF = Array.isArray(me?.following) && me.following.includes(item.fromUid);
              const msg = item.groupCount > 1 ? `and ${item.groupCount - 1} others liked your post.` : item.message;
              const collabStatus = item.actionStatus || item.status;
              const isPendingCollab = item.type === 'collab_invite' && !!item.postId && collabStatus !== 'accepted' && collabStatus !== 'declined';

              return (
                <TouchableOpacity style={[s.row, !item.read && { backgroundColor: `${BRAND}0F` }]} onPress={() => onTapItem(item)}>
                  {!item.read && <View style={s.blueDot} />}
                  <TouchableOpacity onPress={() => { onClose(); if (item.fromUid) router.push(`/user/${item.fromUid}` as any); }}>
                    {dp ? <Image source={{ uri: dp }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={20} color={BRAND_TEXT} /></View>}
                  </TouchableOpacity>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontSize: 14, lineHeight: 19 }}>
                      <Text style={{ fontWeight: '800' }}>{item.fromUsername || u?.username || 'Deleted user'} </Text>
                      {msg} <Text style={{ color: c.muted, fontSize: 12 }}>{relTime(item.createdAt)}</Text>
                    </Text>
                    {item.type === 'follow_request' && item.actionStatus === 'pending' && (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                        <TouchableOpacity onPress={() => handleReq(item, true)} style={s.reqBtn}><Text style={{ color: BRAND_TEXT, fontWeight: '700', fontSize: 12 }}>Confirm</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => handleReq(item, false)} style={[s.reqBtn, { backgroundColor: c.surface }]}><Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>Delete</Text></TouchableOpacity>
                      </View>
                    )}
                    {item.type === 'follow_request' && item.actionStatus !== 'pending' && (
                      <Text style={{ color: c.muted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{item.actionStatus}</Text>
                    )}
                    {isPendingCollab && (
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                        <TouchableOpacity disabled={busyId === item.id} onPress={() => handleCollab(item, true)} style={s.reqBtn}><Text style={{ color: BRAND_TEXT, fontWeight: '700', fontSize: 12 }}>Accept</Text></TouchableOpacity>
                        <TouchableOpacity disabled={busyId === item.id} onPress={() => handleCollab(item, false)} style={[s.reqBtn, { backgroundColor: c.surface }]}><Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>Decline</Text></TouchableOpacity>
                      </View>
                    )}
                    {item.type === 'collab_invite' && (collabStatus === 'accepted' || collabStatus === 'declined') && (
                      <Text style={{ color: c.muted, fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>{collabStatus}</Text>
                    )}
                  </View>
                  {item.type === 'follow' && item.fromUid ? (
                    <TouchableOpacity onPress={() => handleFollowBack(item.fromUid)} style={[s.fBtn, { backgroundColor: isF ? c.surface : BRAND }]}>
                      <Text style={{ color: isF ? c.text : BRAND_TEXT, fontWeight: '700', fontSize: 12 }}>{isF ? 'Following' : 'Follow Back'}</Text>
                    </TouchableOpacity>
                  ) : thumb ? <Image source={{ uri: thumb }} style={s.thumb} /> : null}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
      <StoryViewerModal visible={!!viewStory} stories={viewStory || []} onClose={() => setViewStory(null)} />
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 0.5 },
  tabs: { flexDirection: 'row', gap: 8, padding: 12 },
  pill: { flex: 1, paddingVertical: 7, borderRadius: 14, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  blueDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#3B82F6' },
  av: { width: 44, height: 44, borderRadius: 22 },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  fBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  reqBtn: { backgroundColor: BRAND, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
});
