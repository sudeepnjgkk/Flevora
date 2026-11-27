import React, { useEffect, useState } from 'react';
import {
  View, Text, Switch, TouchableOpacity, TextInput, ScrollView, FlatList, Image,
  StyleSheet, Alert, ActivityIndicator, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND } from './theme';
import { fetchPostsByIds, fetchUserPostsPage, fetchUsersByIds } from './profileHelpers';
import { clearSearchHistoryAll, getThumbUrl, loadSearchHistory, removeSearchHistoryItem, searchAccounts } from './searchHelpers';
import { ExplorePostModal } from './ExplorePostModal';

const W = (Dimensions.get('window').width - 4) / 3;

export function SavedPostsPage({ user, uid }: { user: any; uid: string }) {
  const { c } = useTheme();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    const ids: string[] = Array.isArray(user?.savedPosts) ? user.savedPosts : [];
    setLoading(true);
    fetchPostsByIds(ids).then(setPosts).finally(() => setLoading(false));
  }, [user?.savedPosts]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} color={BRAND} />;
  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={posts}
        numColumns={3}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No saved posts yet.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelected(item)} onLongPress={() => Alert.alert('Unsave', 'Remove from Saved?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', onPress: () => updateDoc(doc(db, 'users', uid), { savedPosts: arrayRemove(item.id) }) },
          ])} style={{ margin: 0.6 }}>
            <Image source={{ uri: getThumbUrl(item) }} style={{ width: W, height: W }} />
          </TouchableOpacity>
        )}
      />
      <ExplorePostModal post={selected} author={user} me={user} onClose={() => setSelected(null)} onPressTag={() => {}} onPressPlace={() => {}} />
    </View>
  );
}

export function YourActivityPage({ user, uid }: { user: any; uid: string }) {
  const { c } = useTheme();
  const [tab, setTab] = useState<'posts' | 'likes' | 'searches'>('posts');
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [likedPosts, setLikedPosts] = useState<any[]>([]);
  const [searches, setSearches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetchUserPostsPage(uid, null, 24),
      getDocs(query(collection(db, 'posts'), where('likes', 'array-contains', uid), orderBy('createdAt', 'desc'), limit(24))),
      loadSearchHistory(uid),
    ]).then(([pRes, lSnap, hist]) => {
      setMyPosts(pRes.items);
      setLikedPosts(lSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setSearches(hist);
    }).finally(() => setLoading(false));
  }, [uid]);

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.tabRow, { borderBottomColor: c.border }]}>
        {(['posts', 'likes', 'searches'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && { borderBottomColor: BRAND, borderBottomWidth: 2 }]}>
            <Text style={{ color: tab === t ? BRAND : c.muted, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={BRAND} /> : tab === 'searches' ? (
        <ScrollView contentContainerStyle={{ padding: 14 }}>
          {searches.length > 0 && (
            <TouchableOpacity onPress={async () => setSearches(await clearSearchHistoryAll(uid))} style={{ alignSelf: 'flex-end', marginBottom: 10 }}>
              <Text style={{ color: '#EF4444', fontWeight: '700' }}>Clear All Searches</Text>
            </TouchableOpacity>
          )}
          {searches.length === 0 ? <Text style={{ color: c.muted, textAlign: 'center', marginTop: 30 }}>No search history.</Text> : searches.map((s) => (
            <View key={s} style={[styles.row, { borderBottomColor: c.border }]}>
              <Text style={{ color: c.text, flex: 1 }}>{s}</Text>
              <TouchableOpacity onPress={async () => setSearches(await removeSearchHistoryItem(uid, s))}><Ionicons name="close" size={20} color={c.muted} /></TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlatList
          data={tab === 'posts' ? myPosts : likedPosts}
          numColumns={3}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No activity yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              onLongPress={() => tab === 'posts' && Alert.alert('Delete Post?', 'Remove permanently?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => { await deleteDoc(doc(db, 'posts', item.id)); setMyPosts((p) => p.filter((x) => x.id !== item.id)); } },
              ])}
              style={{ margin: 0.6 }}
            >
              <Image source={{ uri: getThumbUrl(item) }} style={{ width: W, height: W }} />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

export function CloseFriendsPage({ user, uid }: { user: any; uid: string }) {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const cfIds: string[] = Array.isArray(user?.closeFriends) ? user.closeFriends : [];

  useEffect(() => {
    searchAccounts(q, 25).then((list) => setUsers(list.filter((u) => u.id !== uid)));
  }, [q, uid]);

  return (
    <View style={{ flex: 1 }}>
      <TextInput style={[styles.inBox, { backgroundColor: c.input, color: c.text }]} placeholder="Search users for Close Friends..." placeholderTextColor={c.muted} value={q} onChangeText={setQ} />
      <FlatList
        data={users}
        keyExtractor={(u) => u.id}
        renderItem={({ item }) => {
          const added = cfIds.includes(item.id);
          return (
            <TouchableOpacity
              onPress={() => updateDoc(doc(db, 'users', uid), { closeFriends: added ? arrayRemove(item.id) : arrayUnion(item.id) })}
              style={[styles.row, { borderBottomColor: c.border, paddingHorizontal: 14 }]}
            >
              <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>@{item.username}</Text>
              <Ionicons name={added ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={added ? '#10B981' : c.muted} />
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

export function UserListManagePage({
  field, emptyText, uid, user,
}: {
  field: 'blockedUsers' | 'restrictedUsers' | 'mutedUsers'; emptyText: string; uid: string; user: any;
}) {
  const { c } = useTheme();
  const [list, setList] = useState<any[]>([]);
  const ids: string[] = Array.isArray(user?.[field]) ? user[field] : [];

  useEffect(() => { fetchUsersByIds(ids).then(setList); }, [ids.join(',')]);

  const remove = (targetId: string, uname: string) => {
    Alert.alert('Confirm', `Remove @${uname} from list?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', onPress: () => updateDoc(doc(db, 'users', uid), { [field]: arrayRemove(targetId) }) },
    ]);
  };

  return (
    <FlatList
      data={list}
      keyExtractor={(u) => u.id}
      ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>{emptyText}</Text>}
      renderItem={({ item }) => (
        <View style={[styles.row, { borderBottomColor: c.border, paddingHorizontal: 14 }]}>
          <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>@{item.username}</Text>
          <TouchableOpacity onPress={() => remove(item.id, item.username)}>
            <Text style={{ color: BRAND, fontWeight: '700' }}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}
    />
  );
}

export function InteractionPrivacyPage({ user, updatePref }: { user: any; updatePref: (p: Record<string, any>) => Promise<void> }) {
  const { c } = useTheme();
  const [commentsControl, setCommentsControl] = useState<'everyone' | 'followers' | 'off'>(user?.commentsControl || 'everyone');
  const [allowTags, setAllowTags] = useState<'everyone' | 'following' | 'none'>(user?.allowTags || 'everyone');
  const [allowMessages, setAllowMessages] = useState<'everyone' | 'followers'>(user?.allowMessagesFrom || 'everyone');
  const [words, setWords] = useState(Array.isArray(user?.hiddenWords) ? user.hiddenWords.join(', ') : '');
  const cycle = <T extends string>(arr: T[], cur: T): T => arr[(arr.indexOf(cur) + 1) % arr.length];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => { const n = cycle(['everyone', 'followers', 'off'], commentsControl); setCommentsControl(n); updatePref({ commentsControl: n }); }}>
        <Text style={{ color: c.text, flex: 1 }}>Who can comment</Text><Text style={{ color: BRAND, fontWeight: '700', textTransform: 'capitalize' }}>{commentsControl}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => { const n = cycle(['everyone', 'following', 'none'], allowTags); setAllowTags(n); updatePref({ allowTags: n }); }}>
        <Text style={{ color: c.text, flex: 1 }}>Tags & Mentions</Text><Text style={{ color: BRAND, fontWeight: '700', textTransform: 'capitalize' }}>{allowTags}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => { const n = cycle(['everyone', 'followers'], allowMessages); setAllowMessages(n); updatePref({ allowMessagesFrom: n }); }}>
        <Text style={{ color: c.text, flex: 1 }}>Who can message you</Text><Text style={{ color: BRAND, fontWeight: '700', textTransform: 'capitalize' }}>{allowMessages}</Text>
      </TouchableOpacity>
      <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>HIDDEN WORDS (COMMA-SEPARATED)</Text>
      <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={words} onChangeText={setWords} placeholder="spam, abuse, ..." placeholderTextColor={c.muted} />
      <TouchableOpacity style={[styles.btn, { backgroundColor: BRAND }]} onPress={() => {
        updatePref({ hiddenWords: words.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean) });
        Alert.alert('Saved', 'Interaction & Hidden Words saved.');
      }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Save Hidden Words</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 0.5 },
  inBox: { margin: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
});
                                   
