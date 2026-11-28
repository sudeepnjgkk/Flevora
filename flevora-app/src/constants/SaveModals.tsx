import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, FlatList, Image,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { getThumbUrl } from './searchHelpers';
import {
  createCollection, deleteCollectionOnly, fetchSavedPostsSafe,
  renameCollection, subscribeCollections, togglePostInCollection, toggleSavePost,
} from './saveSystem';
import { ExplorePostModal } from './ExplorePostModal';

const W = (Dimensions.get('window').width - 4) / 3;

export function SaveButton({
  saved, onPress, onLongPress, size = 24, color,
}: {
  saved: boolean; onPress: () => void; onLongPress?: () => void; size?: number; color?: string;
}) {
  const { c } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Unsave' : 'Save'}
      hitSlop={8}
    >
      <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={size} color={saved ? BRAND : (color || c.text)} />
    </TouchableOpacity>
  );
}

export function SaveCollectionSheet({
  visible, post, myUid, me, onClose,
}: {
  visible: boolean; post: any | null; myUid: string; me: any; onClose: () => void;
}) {
  const { c } = useTheme();
  const [cols, setCols] = useState<any[]>([]);
  const [newMode, setNewMode] = useState(false);
  const [colName, setColName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !myUid) return;
    setNewMode(false);
    setColName('');
    return subscribeCollections(myUid, setCols);
  }, [visible, myUid]);

  if (!visible || !post) return null;
  const isSaved = Array.isArray(me?.savedPosts) && me.savedPosts.includes(post.id);
  const thumb = getThumbUrl(post);

  const handleCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createCollection(myUid, colName, post.id, thumb);
      setNewMode(false);
      setColName('');
      onClose();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not create collection.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.bg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={[styles.head, { borderBottomColor: c.border }]}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>
              {newMode ? 'New Collection' : 'Save to Collection'}
            </Text>
            <TouchableOpacity onPress={() => (newMode ? setNewMode(false) : onClose())}>
              <Ionicons name="close" size={22} color={c.text} />
            </TouchableOpacity>
          </View>

          {newMode ? (
            <View style={{ padding: 16, gap: 12 }}>
              <TextInput
                style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
                placeholder="Collection name (e.g. Travel, Favorites)"
                placeholderTextColor={c.muted}
                value={colName}
                onChangeText={setColName}
                maxLength={40}
              />
              <TouchableOpacity disabled={busy} onPress={handleCreate} style={[styles.btn, { backgroundColor: BRAND }]}>
                {busy ? <ActivityIndicator color={BRAND_TEXT} /> : <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Create & Save</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ maxHeight: 340, paddingBottom: 16 }}>
              <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => setNewMode(true)}>
                <View style={[styles.colThumb, { backgroundColor: c.input, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="add" size={24} color={c.text} />
                </View>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 15, flex: 1 }}>New Collection</Text>
              </TouchableOpacity>

              <FlatList
                data={cols}
                keyExtractor={(i) => i.id}
                ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', padding: 18 }}>No collections yet.</Text>}
                renderItem={({ item }) => {
                  const selected = Array.isArray(item.postIds) && item.postIds.includes(post.id);
                  return (
                    <TouchableOpacity
                      style={[styles.row, { borderBottomColor: c.border }]}
                      onPress={() => togglePostInCollection(myUid, item.id, post.id, !selected, thumb)}
                    >
                      {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.colThumb} /> : (
                        <View style={[styles.colThumb, { backgroundColor: c.input, justifyContent: 'center', alignItems: 'center' }]}>
                          <Ionicons name="bookmark" size={18} color={c.muted} />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{item.name}</Text>
                        <Text style={{ color: c.muted, fontSize: 12 }}>{item.postIds?.length || 0} items</Text>
                      </View>
                      <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? BRAND : c.muted} />
                    </TouchableOpacity>
                  );
                }}
              />

              {isSaved && (
                <TouchableOpacity
                  style={{ padding: 14, alignItems: 'center' }}
                  onPress={() => { toggleSavePost({ postId: post.id, myUid, me }); onClose(); }}
                >
                  <Text style={{ color: '#EF4444', fontWeight: '700' }}>Remove from Saved</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function SavedLibraryView({ user, myUid }: { user: any; myUid: string }) {
  const { c } = useTheme();
  const [tab, setTab] = useState<'all' | 'posts' | 'reels' | 'collections'>('all');
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [activeCol, setActiveCol] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [renameMode, setRenameMode] = useState(false);
  const [renameText, setRenameText] = useState('');

  useEffect(() => {
    if (!myUid) return;
    return subscribeCollections(myUid, (list) => {
      setCollections(list);
      if (activeCol) setActiveCol(list.find((x) => x.id === activeCol.id) || null);
    });
  }, [myUid, activeCol?.id]);

  useEffect(() => {
    const ids: string[] = Array.isArray(user?.savedPosts) ? user.savedPosts : [];
    setLoading(true);
    fetchSavedPostsSafe(ids, user, myUid).then((res) => {
      setSavedPosts(res.available);
      setUnavailableIds(res.unavailableIds);
    }).finally(() => setLoading(false));
  }, [user?.savedPosts, myUid]);

  if (activeCol) {
    const colPosts = savedPosts.filter((p) => Array.isArray(activeCol.postIds) && activeCol.postIds.includes(p.id));
    return (
      <View style={{ flex: 1 }}>
        <View style={[styles.colHeader, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => setActiveCol(null)}><Ionicons name="arrow-back" size={22} color={c.text} /></TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{activeCol.name}</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>{colPosts.length} saved items</Text>
          </View>
          <TouchableOpacity onPress={() => { setRenameText(activeCol.name); setRenameMode(true); }} style={{ padding: 6 }}>
            <Ionicons name="create-outline" size={20} color={c.text} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert('Delete Collection?', 'Your saved posts will remain in All Saved.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCollectionOnly(myUid, activeCol.id); setActiveCol(null); } },
          ])} style={{ padding: 6 }}>
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {renameMode && (
          <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
            <TextInput style={[styles.input, { flex: 1, backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={renameText} onChangeText={setRenameText} maxLength={40} />
            <TouchableOpacity style={[styles.smBtn, { backgroundColor: BRAND }]} onPress={async () => { await renameCollection(myUid, activeCol.id, renameText); setRenameMode(false); }}>
              <Text style={{ color: BRAND_TEXT, fontWeight: '700' }}>Save</Text>
            </TouchableOpacity>
          </View>
        )}

        <FlatList
          data={colPosts}
          numColumns={3}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>This collection is empty.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedPost(item)}
              onLongPress={() => Alert.alert('Remove Item', 'Choose an option:', [
                { text: 'Remove from Collection', onPress: () => togglePostInCollection(myUid, activeCol.id, item.id, false) },
                { text: 'Unsave Completely', style: 'destructive', onPress: () => toggleSavePost({ postId: item.id, myUid, me: user }) },
                { text: 'Cancel', style: 'cancel' },
              ])}
              style={{ margin: 0.6 }}
            >
              <Image source={{ uri: getThumbUrl(item) }} style={{ width: W, height: W }} />
            </TouchableOpacity>
          )}
        />
        <ExplorePostModal post={selectedPost} author={user} me={user} onClose={() => setSelectedPost(null)} onPressTag={() => {}} onPressPlace={() => {}} />
      </View>
    );
  }

  const shown = tab === 'posts' ? savedPosts.filter((p) => p.mediaType !== 'video') : tab === 'reels' ? savedPosts.filter((p) => p.mediaType === 'video') : savedPosts;

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.tabRow, { borderBottomColor: c.border }]}>
        {(['all', 'posts', 'reels', 'collections'] as const).map((t) => (
          <TouchableOpacity key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && { borderBottomColor: BRAND, borderBottomWidth: 2 }]}>
            <Text style={{ color: tab === t ? c.text : c.muted, fontWeight: '700', textTransform: 'capitalize', fontSize: 13 }}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {unavailableIds.length > 0 && tab !== 'collections' && (
        <TouchableOpacity
          onPress={async () => { await updateDoc(doc(db, 'users', myUid), { savedPosts: arrayRemove(...unavailableIds) }); }}
          style={{ padding: 10, backgroundColor: c.input, alignItems: 'center' }}
        >
          <Text style={{ color: c.muted, fontSize: 12 }}>{unavailableIds.length} deleted/unavailable saved items • Tap to clean up</Text>
        </TouchableOpacity>
      )}

      {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={BRAND} /> : tab === 'collections' ? (
        <FlatList
          data={collections}
          numColumns={2}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 10, gap: 10 }}
          ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No collections yet. Long-press any bookmark to create one!</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setActiveCol(item)} style={[styles.colCard, { backgroundColor: c.card, borderColor: c.border }]}>
              {item.coverUrl ? <Image source={{ uri: item.coverUrl }} style={styles.colGridImg} /> : (
                <View style={[styles.colGridImg, { backgroundColor: c.input, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="bookmark-outline" size={28} color={c.muted} />
                </View>
              )}
              <Text style={{ color: c.text, fontWeight: '700', marginTop: 6 }} numberOfLines={1}>{item.name}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>{item.postIds?.length || 0} items</Text>
            </TouchableOpacity>
          )}
        />
      ) : (
        <FlatList
          data={shown}
          numColumns={3}
          keyExtractor={(i) => i.id}
          ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No saved items yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setSelectedPost(item)} style={{ margin: 0.6 }}>
              <Image source={{ uri: getThumbUrl(item) }} style={{ width: W, height: W }} />
              {item.mediaType === 'video' && <Ionicons name="play" size={16} color="#fff" style={styles.badge} />}
            </TouchableOpacity>
          )}
        />
      )}
      <ExplorePostModal post={selectedPost} author={user} me={user} onClose={() => setSelectedPost(null)} onPressTag={() => {}} onPressPlace={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5 },
  colThumb: { width: 44, height: 44, borderRadius: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  smBtn: { paddingHorizontal: 16, justifyContent: 'center', borderRadius: 10 },
  tabRow: { flexDirection: 'row', borderBottomWidth: 1 },
  tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  colHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 0.5 },
  colCard: { flex: 1, margin: 4, padding: 8, borderRadius: 12, borderWidth: 1 },
  colGridImg: { width: '100%', height: 120, borderRadius: 8 },
  badge: { position: 'absolute', top: 6, right: 6 },
});
