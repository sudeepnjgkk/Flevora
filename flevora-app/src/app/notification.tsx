import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  collection, query, where, onSnapshot, doc, getDoc, updateDoc,
  arrayUnion, arrayRemove, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from '../constants/theme';

const FILTERS = ['All', 'Follows', 'Comments', 'Likes'] as const;

const ago = (ts: any) => {
  if (!ts?.seconds) return 'now';
  const s = Math.max(1, Math.floor(Date.now() / 1000 - ts.seconds));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

export default function NotificationScreen() {
  const router = useRouter();
  const { c } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [reqUsers, setReqUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState<typeof FILTERS[number]>('All');
  const [busyId, setBusyId] = useState<string | null>(null);
  const uid = auth.currentUser?.uid || '';

  useEffect(() => {
    if (!uid) return;
    const u1 = onSnapshot(query(collection(db, 'notifications'), where('toUid', '==', uid)), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setItems(list);
    }, () => {});
    const u2 = onSnapshot(doc(db, 'users', uid), async (s) => {
      const reqs: string[] = s.data()?.followRequests || [];
      const loaded = await Promise.all(reqs.map(async (rid) => {
        const rs = await getDoc(doc(db, 'users', rid));
        return rs.exists() ? { id: rid, ...rs.data() } : null;
      }));
      setReqUsers(loaded.filter(Boolean));
    });
    return () => { u1(); u2(); };
  }, [uid]);

  const acceptReq = async (reqUid: string) => {
    await updateDoc(doc(db, 'users', uid), { followers: arrayUnion(reqUid), followRequests: arrayRemove(reqUid) });
    const me = await getDoc(doc(db, 'users', uid));
    await addDoc(collection(db, 'notifications'), {
      toUid: reqUid, fromUid: uid, fromUsername: me.data()?.username || 'user',
      type: 'follow', message: 'accepted your follow request.', read: false, createdAt: serverTimestamp(),
    });
  };

  const rejectReq = (reqUid: string) => updateDoc(doc(db, 'users', uid), { followRequests: arrayRemove(reqUid) });
  const markRead = (id: string) => updateDoc(doc(db, 'notifications', id), { read: true }).catch(() => {});

  const respondCollab = async (item: any, accept: boolean) => {
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
      Alert.alert(accept ? 'Accepted' : 'Declined', accept ? 'You are now listed as a collaborator on this post.' : 'Collaborator invite declined.');
    } catch {
      Alert.alert('Error', 'Could not update collaborator invite.');
    } finally {
      setBusyId(null);
    }
  };

  const visible = items.filter((i) => {
    if (filter === 'Follows') return i.type?.includes('follow');
    if (filter === 'Comments') return i.type === 'comment' || i.type === 'mention' || i.type === 'reply';
    if (filter === 'Likes') return i.type === 'like';
    return true;
  });

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border }]}>
        <TouchableOpacity hitSlop={12} onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>Notifications</Text>
      </View>

      <View style={{ paddingVertical: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 8 }}>
          {FILTERS.map((f) => (
            <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.chip, { backgroundColor: filter === f ? BRAND : c.input }]}>
              <Text style={{ color: filter === f ? BRAND_TEXT : c.text, fontWeight: '700', fontSize: 13 }}>{f}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={reqUsers.length > 0 ? (
          <View style={[styles.reqBox, { borderBottomColor: c.border }]}>
            <Text style={{ color: c.muted, fontWeight: '700', fontSize: 13, marginBottom: 8 }}>Follow Requests ({reqUsers.length})</Text>
            {reqUsers.map((u) => (
              <View key={u.id} style={styles.reqRow}>
                <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>@{u.username}</Text>
                <TouchableOpacity style={styles.accBtn} onPress={() => acceptReq(u.id)}><Text style={{ color: BRAND_TEXT, fontWeight: '700', fontSize: 12 }}>Accept</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.rejBtn, { backgroundColor: c.input }]} onPress={() => rejectReq(u.id)}><Text style={{ color: c.text, fontSize: 12 }}>Reject</Text></TouchableOpacity>
              </View>
            ))}
          </View>
        ) : undefined}
        ListEmptyComponent={<Text style={[styles.empty, { color: c.muted }]}>No notifications yet.</Text>}
        renderItem={({ item }) => {
          const collabStatus = item.actionStatus || item.status;
          const isPendingCollab = item.type === 'collab_invite' && !!item.postId && collabStatus !== 'accepted' && collabStatus !== 'declined';
          return (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: c.border, backgroundColor: item.read ? c.background : c.card }]}
              onPress={() => { markRead(item.id); if (item.fromUid) router.push(`/user/${item.fromUid}` as any); }}
            >
              <View style={[styles.av, { backgroundColor: c.input }]}>
                <Ionicons
                  name={
                    item.type === 'collab_invite' ? 'people' :
                    item.type?.includes('follow') ? 'person-add' :
                    item.type === 'comment' ? 'chatbubble' : 'heart'
                  }
                  size={20}
                  color={BRAND}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontSize: 14 }}>
                  <Text style={{ fontWeight: '700' }}>@{item.fromUsername || 'user'} </Text>
                  {item.message || 'interacted with you.'}{' '}
                  <Text style={{ color: c.muted, fontSize: 12 }}>{ago(item.createdAt)}</Text>
                </Text>
                {isPendingCollab && (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity disabled={busyId === item.id} style={styles.accBtn} onPress={() => respondCollab(item, true)}>
                      <Text style={{ color: BRAND_TEXT, fontWeight: '700', fontSize: 12 }}>Accept</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={busyId === item.id} style={[styles.rejBtn, { backgroundColor: c.input }]} onPress={() => respondCollab(item, false)}>
                      <Text style={{ color: c.text, fontSize: 12 }}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {item.type === 'collab_invite' && (collabStatus === 'accepted' || collabStatus === 'declined') && (
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 4, textTransform: 'capitalize' }}>
                    Collaborator invite {collabStatus}
                  </Text>
                )}
              </View>
              {!item.read && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 48 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, gap: 14 },
  title: { fontSize: 20, fontWeight: '800' },
  chip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 18 },
  reqBox: { padding: 14, borderBottomWidth: 1 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  accBtn: { backgroundColor: BRAND, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  rejBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, gap: 12 },
  av: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND },
});
