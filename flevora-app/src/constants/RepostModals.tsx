import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, FlatList, Image,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { fetchRepostersUsers } from './repostSystem';
import { canViewAccount, toggleFollowUser } from './searchHelpers';

export function RepostButton({
  reposted, count, onPress, onLongPressCount, size = 24,
}: {
  reposted: boolean; count: number; onPress: () => void; onLongPressCount?: () => void; size?: number;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <TouchableOpacity onPress={onPress} accessibilityLabel={reposted ? 'Remove repost' : 'Repost'}>
        <Ionicons name="repeat" size={size} color={reposted ? '#10B981' : c.text} />
      </TouchableOpacity>
      {count > 0 && (
        <TouchableOpacity onPress={onLongPressCount || onPress}>
          <Text style={{ color: reposted ? '#10B981' : c.muted, fontSize: 12, fontWeight: '700' }}>{count}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export function RepostSheetModal({
  visible, post, myUid, onClose, onRepost, onSaveThought, onRemoveRepost, onOpenReposters,
}: {
  visible: boolean; post: any | null; myUid: string; onClose: () => void;
  onRepost: (thought?: string) => void; onSaveThought: (thought: string) => void;
  onRemoveRepost: () => void; onOpenReposters: () => void;
}) {
  const { c } = useTheme();
  const [thoughtMode, setThoughtMode] = useState(false);
  const [thought, setThought] = useState('');

  useEffect(() => {
    if (visible && post) {
      setThought(post.repostThoughts?.[myUid] || '');
      setThoughtMode(false);
    }
  }, [visible, post?.id, myUid]);

  if (!visible || !post) return null;
  const reposted = Array.isArray(post.reposts) && post.reposts.includes(myUid);
  const count = Array.isArray(post.reposts) ? post.reposts.length : 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.bg}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: c.background }]}>
          <View style={[styles.head, { borderBottomColor: c.border }]}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>
              {thoughtMode ? (reposted ? 'Edit Thought' : 'Repost with Thought') : 'Repost Options'}
            </Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={c.text} /></TouchableOpacity>
          </View>

          {thoughtMode ? (
            <View style={{ padding: 16, gap: 12 }}>
              <TextInput
                style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
                placeholder="Add a thought about this post... (optional)"
                placeholderTextColor={c.muted}
                value={thought}
                onChangeText={setThought}
                maxLength={200}
                multiline
              />
              <Text style={{ color: c.muted, fontSize: 11, textAlign: 'right' }}>{thought.length}/200</Text>
              <TouchableOpacity
                style={[styles.btn, { backgroundColor: BRAND }]}
                onPress={() => {
                  onClose();
                  if (reposted) onSaveThought(thought);
                  else onRepost(thought);
                }}
              >
                <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>{reposted ? 'Save Thought' : 'Repost Now'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ paddingBottom: 16 }}>
              {!reposted ? (
                <>
                  <TouchableOpacity style={[styles.opt, { borderBottomColor: c.border }]} onPress={() => { onClose(); onRepost(''); }}>
                    <Ionicons name="repeat" size={22} color={c.text} />
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>Repost</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.opt, { borderBottomColor: c.border }]} onPress={() => setThoughtMode(true)}>
                    <Ionicons name="chatbox-ellipses-outline" size={22} color={c.text} />
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>Repost with a thought</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity style={[styles.opt, { borderBottomColor: c.border }]} onPress={() => setThoughtMode(true)}>
                    <Ionicons name="create-outline" size={22} color={c.text} />
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>{thought ? 'Edit thought' : 'Add a thought'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.opt, { borderBottomColor: c.border }]} onPress={() => { onClose(); onRemoveRepost(); }}>
                    <Ionicons name="trash-outline" size={22} color="#EF4444" />
                    <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 15 }}>Remove repost</Text>
                  </TouchableOpacity>
                </>
              )}
              {count > 0 && (
                <TouchableOpacity style={styles.opt} onPress={() => { onClose(); onOpenReposters(); }}>
                  <Ionicons name="people-outline" size={22} color={c.text} />
                  <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>View reposts ({count})</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function RepostersModal({
  visible, uids, me, myUid, onClose,
}: {
  visible: boolean; uids: string[]; me: any; myUid: string; onClose: () => void;
}) {
  const { c } = useTheme();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    fetchRepostersUsers(uids).then((list) => setUsers(list.filter((u) => canViewAccount(u, me, myUid)))).finally(() => setLoading(false));
  }, [visible, uids.join(',')]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.fullWrap, { backgroundColor: c.background }]}>
        <View style={[styles.head, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>Reposts</Text>
          <View style={{ width: 24 }} />
        </View>
        {loading ? <ActivityIndicator style={{ marginTop: 30 }} color={BRAND} /> : (
          <FlatList
            data={users}
            keyExtractor={(u) => u.id}
            ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No reposts yet.</Text>}
            renderItem={({ item }) => {
              const iFollow = Array.isArray(me?.following) && me.following.includes(item.id);
              return (
                <TouchableOpacity style={[styles.userRow, { borderBottomColor: c.border }]} onPress={() => { onClose(); router.navigate(`/user/${item.id}` as any); }}>
                  {item.avatar ? <Image source={{ uri: item.avatar }} style={styles.av} /> : (
                    <View style={[styles.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: BRAND_TEXT, fontWeight: '700' }}>{(item.username || 'U')[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '700' }}>@{item.username}</Text>
                    {!!item.fullName && <Text style={{ color: c.muted, fontSize: 12 }}>{item.fullName}</Text>}
                  </View>
                  {item.id !== myUid && (
                    <TouchableOpacity onPress={() => toggleFollowUser(item, me, myUid)} style={[styles.fBtn, { backgroundColor: iFollow ? c.input : BRAND }]}>
                      <Text style={{ color: iFollow ? c.text : BRAND_TEXT, fontWeight: '700', fontSize: 12 }}>{iFollow ? 'Following' : 'Follow'}</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 0.5 },
  opt: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 0.5 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80, fontSize: 14 },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  fullWrap: { flex: 1, paddingTop: 46 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5 },
  av: { width: 42, height: 42, borderRadius: 21 },
  fBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
});
  
