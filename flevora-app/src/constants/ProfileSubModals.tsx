import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, Image, FlatList, ScrollView,
  StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND } from './theme';
import {
  checkUsernameAvailable, computeRealInsights, fetchUserStories,
  fetchUsersByIds, removeFollower, respondFollowRequest, uploadAvatarToCloudinary,
} from './profileHelpers';
import { toggleFollowUser } from './searchHelpers';

export function EditProfileModal({
  visible, user, uid, onClose,
}: {
  visible: boolean; user: any; uid: string; onClose: () => void;
}) {
  const { c } = useTheme();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState('');
  const [avatar, setAvatar] = useState('');
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && user) {
      setFullName(user.fullName || '');
      setUsername(user.username || '');
      setBio(user.bio || '');
      setPronouns(user.pronouns || '');
      setWebsite(user.website || '');
      setCategory(user.category || '');
      setAvatar(user.avatar || '');
      setUploadPct(null);
    }
  }, [visible, user]);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.75 });
    if (res.canceled || !res.assets[0]) return;
    try {
      setUploadPct(1);
      const url = await uploadAvatarToCloudinary(res.assets[0].uri, uid, setUploadPct);
      setAvatar(url);
      setUploadPct(null);
    } catch {
      setUploadPct(null);
      Alert.alert('Upload Failed', 'Could not upload profile photo.');
    }
  };

  const handleSave = async () => {
    if (saving || uploadPct !== null) return;
    setSaving(true);
    try {
      const check = await checkUsernameAvailable(username, uid);
      if (!check.ok) {
        Alert.alert('Invalid Username', check.error || 'Try another username.');
        setSaving(false);
        return;
      }
      await updateDoc(doc(db, 'users', uid), {
        fullName: fullName.trim(),
        username: check.normalized,
        bio: bio.trim(),
        pronouns: pronouns.trim(),
        website: website.trim(),
        category: category.trim(),
        avatar,
      });
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.wrap, { backgroundColor: c.background }]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Text style={{ color: c.muted, fontSize: 15 }}>Cancel</Text></TouchableOpacity>
          <Text style={[styles.title, { color: c.text }]}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving || uploadPct !== null}>
            {saving ? <ActivityIndicator size="small" color={BRAND} /> : <Text style={{ color: BRAND, fontWeight: '800', fontSize: 15 }}>Save</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <TouchableOpacity onPress={pickPhoto} style={{ alignItems: 'center', marginBottom: 6 }}>
            {avatar ? <Image source={{ uri: avatar }} style={styles.editAv} /> : (
              <View style={[styles.editAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#fff', fontSize: 28, fontWeight: '700' }}>{(username || 'U')[0].toUpperCase()}</Text>
              </View>
            )}
            <Text style={{ color: BRAND, fontWeight: '700', marginTop: 8 }}>
              {uploadPct !== null ? `Uploading ${uploadPct}%...` : 'Change profile photo'}
            </Text>
          </TouchableOpacity>
          {[
            { label: 'Display Name', val: fullName, set: setFullName, ph: 'Your name' },
            { label: 'Username', val: username, set: setUsername, ph: 'username', low: true },
            { label: 'Pronouns', val: pronouns, set: setPronouns, ph: 'e.g. he/him, she/her' },
            { label: 'Bio', val: bio, set: setBio, ph: 'Tell people about yourself', multi: true },
            { label: 'Website', val: website, set: setWebsite, ph: 'https://...', low: true },
            { label: 'Category', val: category, set: setCategory, ph: 'Creator, Artist, Blogger...' },
          ].map((f) => (
            <View key={f.label}>
              <Text style={{ color: c.muted, fontSize: 12, marginBottom: 4, fontWeight: '600' }}>{f.label}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text, minHeight: f.multi ? 72 : 42 }]}
                placeholder={f.ph}
                placeholderTextColor={c.muted}
                value={f.val}
                onChangeText={f.set}
                multiline={!!f.multi}
                autoCapitalize={f.low ? 'none' : 'sentences'}
              />
            </View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function FollowListModal({
  mode, ids, ownerUid, me, myUid, onClose,
}: {
  mode: 'followers' | 'following' | 'requests' | null;
  ids: string[];
  ownerUid: string;
  me: any;
  myUid: string;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!mode) return;
    setLoading(true);
    fetchUsersByIds(ids).then(setUsers).finally(() => setLoading(false));
  }, [mode, ids.join(',')]);

  if (!mode) return null;
  const isOwner = ownerUid === myUid;
  const filtered = users.filter((u) => {
    const s = q.trim().toLowerCase();
    return !s || (u.username || '').toLowerCase().includes(s) || (u.fullName || '').toLowerCase().includes(s);
  });

  return (
    <Modal visible={!!mode} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: c.background }]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[styles.title, { color: c.text, textTransform: 'capitalize' }]}>{mode}</Text>
          <View style={{ width: 24 }} />
        </View>
        <TextInput
          style={[styles.searchIn, { backgroundColor: c.input, color: c.text }]}
          placeholder="Search..."
          placeholderTextColor={c.muted}
          value={q}
          onChangeText={setQ}
        />
        {loading ? (
          <ActivityIndicator style={{ marginTop: 30 }} color={BRAND} />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(u) => u.id}
            ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No users here yet.</Text>}
            renderItem={({ item }) => {
              const iFollow = Array.isArray(me?.following) && me.following.includes(item.id);
              return (
                <TouchableOpacity
                  style={[styles.row, { borderBottomColor: c.border }]}
                  onPress={() => { onClose(); router.navigate(`/user/${item.id}` as any); }}
                >
                  {item.avatar ? <Image source={{ uri: item.avatar }} style={styles.rowAv} /> : (
                    <View style={[styles.rowAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{(item.username || 'U')[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '700' }}>@{item.username}</Text>
                    {!!item.fullName && <Text style={{ color: c.muted, fontSize: 12 }}>{item.fullName}</Text>}
                  </View>
                  {mode === 'requests' && isOwner ? (
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity onPress={() => respondFollowRequest(myUid, item.id, true)} style={[styles.smBtn, { backgroundColor: BRAND }]}>
                        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>Confirm</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => respondFollowRequest(myUid, item.id, false)} style={[styles.smBtn, { backgroundColor: c.input }]}>
                        <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  ) : mode === 'followers' && isOwner ? (
                    <TouchableOpacity onPress={() => removeFollower(myUid, item.id)} style={[styles.smBtn, { backgroundColor: c.input }]}>
                      <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>Remove</Text>
                    </TouchableOpacity>
                  ) : item.id !== myUid ? (
                    <TouchableOpacity onPress={() => toggleFollowUser(item, me, myUid)} style={[styles.smBtn, { backgroundColor: iFollow ? c.input : BRAND }]}>
                      <Text style={{ color: iFollow ? c.text : '#fff', fontWeight: '700', fontSize: 12 }}>{iFollow ? 'Following' : 'Follow'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

export function HighlightModal({
  visible, uid, user, activeHighlight, onClose,
}: {
  visible: boolean; uid: string; user: any; activeHighlight: any | null; onClose: () => void;
}) {
  const { c } = useTheme();
  const [stories, setStories] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!visible || !uid) return;
    fetchUserStories(uid).then(setStories);
    if (activeHighlight) {
      setName(activeHighlight.title || '');
      setSelectedIds(activeHighlight.storyIds || []);
    } else {
      setName('');
      setSelectedIds([]);
    }
  }, [visible, uid, activeHighlight]);

  const saveHighlight = async () => {
    if (!name.trim() || selectedIds.length === 0) return Alert.alert('Missing Info', 'Enter a name and pick at least 1 story.');
    const cover = stories.find((s) => s.id === selectedIds[0])?.mediaUrl || '';
    const existing: any[] = Array.isArray(user?.highlights) ? user.highlights : [];
    const nextItem = { id: activeHighlight?.id || `hl_${Date.now()}`, title: name.trim(), cover, storyIds: selectedIds };
    const next = activeHighlight
      ? existing.map((h) => (h.id === activeHighlight.id ? nextItem : h))
      : [...existing, nextItem];
    await updateDoc(doc(db, 'users', uid), { highlights: next });
    onClose();
  };

  const deleteHighlight = async () => {
    if (!activeHighlight) return;
    const next = (user?.highlights || []).filter((h: any) => h.id !== activeHighlight.id);
    await updateDoc(doc(db, 'users', uid), { highlights: next });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: c.background }]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[styles.title, { color: c.text }]}>{activeHighlight ? 'Edit Highlight' : 'New Highlight'}</Text>
          <TouchableOpacity onPress={saveHighlight}><Text style={{ color: BRAND, fontWeight: '800' }}>Save</Text></TouchableOpacity>
        </View>
        <View style={{ padding: 14, gap: 10 }}>
          <TextInput
            style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
            placeholder="Highlight title"
            placeholderTextColor={c.muted}
            value={name}
            onChangeText={setName}
          />
          {activeHighlight && (
            <TouchableOpacity onPress={deleteHighlight} style={{ alignSelf: 'flex-end' }}>
              <Text style={{ color: '#EF4444', fontWeight: '700' }}>Delete Highlight</Text>
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={stories}
          numColumns={3}
          keyExtractor={(s) => s.id}
          ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 30 }}>No stories found to add.</Text>}
          renderItem={({ item }) => {
            const picked = selectedIds.includes(item.id);
            return (
              <TouchableOpacity
                onPress={() => setSelectedIds((p) => (picked ? p.filter((x) => x !== item.id) : [...p, item.id]))}
                style={{ width: '32.5%', margin: 1, height: 150, position: 'relative' }}
              >
                <Image source={{ uri: item.mediaUrl }} style={{ width: '100%', height: '100%' }} />
                <View style={[styles.checkDot, { backgroundColor: picked ? BRAND : 'rgba(0,0,0,0.4)' }]}>
                  {picked && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

export function ProfessionalModal({
  visible, uid, user, posts, onClose,
}: {
  visible: boolean; uid: string; user: any; posts: any[]; onClose: () => void;
}) {
  const { c } = useTheme();
  const insights = computeRealInsights(posts, user);
  const [accountType, setAccountType] = useState<'personal' | 'creator' | 'business'>(user?.accountType || 'personal');
  const [category, setCategory] = useState(user?.category || '');

  const saveType = async () => {
    await updateDoc(doc(db, 'users', uid), { accountType, category: category.trim() });
    Alert.alert('Saved', `Account switched to ${accountType}.`);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: c.background }]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[styles.title, { color: c.text }]}>Professional Dashboard</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>REAL ACCOUNT INSIGHTS</Text>
          <View style={styles.insGrid}>
            {[
              { label: 'Followers', val: insights.followersCount },
              { label: 'Total Views', val: insights.totalViews },
              { label: 'Total Likes', val: insights.totalLikes },
              { label: 'Comments', val: insights.totalComments },
              { label: 'Posts', val: insights.postsCount },
              { label: 'Reels', val: insights.reelsCount },
            ].map((item) => (
              <View key={item.label} style={[styles.insCard, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={{ color: BRAND, fontWeight: '800', fontSize: 20 }}>{item.val}</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>{item.label}</Text>
              </View>
            ))}
          </View>
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', marginTop: 6 }}>ACCOUNT TYPE</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['personal', 'creator', 'business'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => setAccountType(t)}
                style={[styles.typeChip, { backgroundColor: accountType === t ? BRAND : c.input }]}
              >
                <Text style={{ color: accountType === t ? '#fff' : c.text, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
            placeholder="Category (e.g. Digital Creator, Photography)"
            placeholderTextColor={c.muted}
            value={category}
            onChangeText={setCategory}
          />
          <TouchableOpacity onPress={saveType} style={[styles.saveBtn, { backgroundColor: BRAND }]}>
            <Text style={{ color: '#fff', fontWeight: '800' }}>Save Account Settings</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

export function shareProfileLink(uid: string, username: string) {
  const link = `flevora://user/${uid}`;
  Share.share({ message: `Check out @${username} on Flevora: ${link}`, title: `@${username} on Flevora` }).catch(() => {});
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 46 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '800' },
  editAv: { width: 84, height: 84, borderRadius: 42 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14 },
  searchIn: { margin: 12, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5 },
  rowAv: { width: 42, height: 42, borderRadius: 21 },
  smBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  checkDot: { position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  insGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  insCard: { width: '31%', padding: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', gap: 4 },
  typeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  saveBtn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
});
                      
