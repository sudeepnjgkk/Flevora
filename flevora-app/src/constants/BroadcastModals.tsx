import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput, ScrollView, FlatList,
  Image, Switch, ActivityIndicator, Alert, Share, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  addDoc, collection, doc, updateDoc, arrayUnion, arrayRemove, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import {
  BC_CATEGORIES, BC_REPORT_CATEGORIES, deleteChannelSafe, getChannelRole,
  leaveChannelSafe, transferChannelOwnership, uploadBroadcastMediaToCloudinary, validateBcAsset,
} from './broadcastCapabilities';

export function CreateChannelModal({ visible, myUid, me, onCreated, onClose }: any) {
  const { c } = useTheme();
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [category, setCategory] = useState<string>('Creator');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [allowReplies, setAllowReplies] = useState(false);
  const [rules, setRules] = useState('');
  const [welcome, setWelcome] = useState('');
  const [imgUri, setImgUri] = useState('');
  const [busy, setBusy] = useState(false);

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.75 });
    if (!res.canceled && res.assets[0]) {
      const err = validateBcAsset(res.assets[0]);
      if (err) return Alert.alert('Invalid Image', err);
      setImgUri(res.assets[0].uri);
    }
  };

  const handleCreate = async () => {
    if (busy || !myUid) return;
    if (!name.trim()) return Alert.alert('Missing Name', 'Enter a channel name.');
    if (name.trim().length > 50) return Alert.alert('Too Long', 'Channel name must be under 50 characters.');
    setBusy(true);
    try {
      const avatarUrl = imgUri ? await uploadBroadcastMediaToCloudinary(imgUri, 'image') : '';
      const inviteCode = Math.random().toString(36).slice(2, 10).toUpperCase();
      const payload = {
        name: name.trim(),
        description: desc.trim().slice(0, 240),
        avatarUrl,
        category,
        visibility,
        allowReplies,
        rules: rules.trim(),
        welcomeMessage: welcome.trim(),
        ownerUid: myUid,
        ownerUsername: me?.username || 'creator',
        admins: [myUid],
        moderators: [],
        members: [myUid],
        memberCount: 1,
        bannedUids: [],
        inviteCode,
        inviteActive: true,
        status: 'active',
        lastMessage: welcome.trim() || 'Channel created',
        lastMessageAt: Date.now(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, 'channels'), payload);
      setName(''); setDesc(''); setRules(''); setWelcome(''); setImgUri('');
      onCreated?.({ id: ref.id, ...payload });
      onClose();
    } catch (e: any) {
      Alert.alert('Create Failed', e?.message || 'Network error. Your inputs are preserved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color={c.text} /></TouchableOpacity>
          <Text style={[s.title, { color: c.text }]}>New Broadcast Channel</Text>
          <TouchableOpacity disabled={busy} onPress={handleCreate}>
            {busy ? <ActivityIndicator size="small" color={BRAND} /> : <Text style={{ color: BRAND, fontWeight: '800', fontSize: 15 }}>Create</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <TouchableOpacity onPress={pickImage} style={{ alignItems: 'center', marginBottom: 4 }}>
            {imgUri ? <Image source={{ uri: imgUri }} style={s.avLg} /> : (
              <View style={[s.avLg, { backgroundColor: c.input, justifyContent: 'center', alignItems: 'center' }]}>
                <Ionicons name="megaphone-outline" size={32} color={BRAND} />
              </View>
            )}
            <Text style={{ color: BRAND, fontWeight: '700', marginTop: 6 }}>Set Channel Photo</Text>
          </TouchableOpacity>
          <TextInput value={name} onChangeText={setName} maxLength={50} placeholder="Channel name *" placeholderTextColor={c.muted} style={[s.inp, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} />
          <TextInput value={desc} onChangeText={setDesc} maxLength={240} multiline placeholder="Description (what is this channel about?)" placeholderTextColor={c.muted} style={[s.inp, { backgroundColor: c.input, borderColor: c.border, color: c.text, minHeight: 70 }]} />
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>CATEGORY</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {BC_CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat} onPress={() => setCategory(cat)} style={[s.chip, { backgroundColor: category === cat ? BRAND : c.input }]}>
                <Text style={{ color: category === cat ? BRAND_TEXT : c.text, fontWeight: '700', fontSize: 12 }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>VISIBILITY</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(['public', 'private'] as const).map((v) => (
              <TouchableOpacity key={v} onPress={() => setVisibility(v)} style={[s.chip, { flex: 1, alignItems: 'center', backgroundColor: visibility === v ? BRAND : c.input }]}>
                <Text style={{ color: visibility === v ? BRAND_TEXT : c.text, fontWeight: '800', textTransform: 'capitalize' }}>{v === 'private' ? 'Private (Invite-Only)' : 'Public'}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={s.rowBet}>
            <Text style={{ color: c.text, fontWeight: '600' }}>Allow member replies</Text>
            <Switch value={allowReplies} onValueChange={setAllowReplies} trackColor={{ true: BRAND }} />
          </View>
          <TextInput value={welcome} onChangeText={setWelcome} placeholder="Welcome message (optional)" placeholderTextColor={c.muted} style={[s.inp, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} />
          <TextInput value={rules} onChangeText={setRules} multiline placeholder="Channel rules / guidelines (optional)" placeholderTextColor={c.muted} style={[s.inp, { backgroundColor: c.input, borderColor: c.border, color: c.text, minHeight: 64 }]} />
        </ScrollView>
      </View>
    </Modal>
  );
}
export function ChannelDetailsModal({ visible, channel, myUid, me, allUsers = [], onLeaveOrDelete, onClose }: any) {
  const { c } = useTheme();
  const [tab, setTab] = useState<'info' | 'members' | 'settings'>('info');
  const [editName, setEditName] = useState(channel?.name || '');
  const [editDesc, setEditDesc] = useState(channel?.description || '');
  const [editRules, setEditRules] = useState(channel?.rules || '');

  if (!visible || !channel) return null;
  const role = getChannelRole(channel, myUid);
  const isOwner = role === 'owner';
  const isAdmin = role === 'owner' || role === 'admin';
  const isMuted = Array.isArray(me?.mutedChannels) && me.mutedChannels.includes(channel.id);
  const membersList = (channel.members || []).map((id: string) => (id === myUid ? { id: myUid, ...me } : allUsers.find((u: any) => u.id === id) || { id, username: 'user' }));

  const saveSettings = async () => {
    if (!editName.trim()) return;
    await updateDoc(doc(db, 'channels', channel.id), {
      name: editName.trim(), description: editDesc.trim(), rules: editRules.trim(), updatedAt: serverTimestamp(),
    });
    Alert.alert('Saved', 'Channel details updated.');
  };

  const shareInvite = () => {
    const link = `flevora://channel/${channel.id}?code=${channel.inviteCode || ''}`;
    Share.share({ message: `Join "${channel.name}" on Flevora! Invite code: ${channel.inviteCode} (${link})` });
  };

  const reportChannel = () => {
    Alert.alert('Report Channel', 'Select reason:', [
      ...BC_REPORT_CATEGORIES.slice(0, 4).map((cat) => ({
        text: cat,
        onPress: () => {
          addDoc(collection(db, 'reports'), { channelId: channel.id, type: 'channel', reason: cat, status: 'pending', reportedBy: myUid, reporterUid: myUid, createdAt: serverTimestamp() });
          Alert.alert('Reported', 'Channel reported for review.');
        },
      })),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[s.title, { color: c.text }]}>{channel.name}</Text>
          <View style={{ width: 24 }} />
        </View>

        <View style={s.tabs}>
          {(['info', 'members', ...(isOwner ? ['settings'] : [])] as const).map((t: any) => (
            <TouchableOpacity key={t} onPress={() => setTab(t)} style={[s.chip, { flex: 1, alignItems: 'center', backgroundColor: tab === t ? BRAND : c.input }]}>
              <Text style={{ color: tab === t ? BRAND_TEXT : c.text, fontWeight: '700', textTransform: 'capitalize' }}>{t}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'info' && (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View style={{ alignItems: 'center' }}>
              {channel.avatarUrl ? <Image source={{ uri: channel.avatarUrl }} style={s.avLg} /> : <View style={[s.avLg, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="megaphone" size={30} color={BRAND_TEXT} /></View>}
              <Text style={{ color: c.text, fontSize: 18, fontWeight: '800', marginTop: 8 }}>{channel.name}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>{channel.memberCount || channel.members?.length || 1} members • {channel.visibility}</Text>
              {!!channel.description && <Text style={{ color: c.text, textAlign: 'center', marginTop: 6 }}>{channel.description}</Text>}
            </View>
            {!!channel.rules && (
              <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
                <Text style={{ color: c.muted, fontSize: 11, fontWeight: '800' }}>CHANNEL RULES</Text>
                <Text style={{ color: c.text, marginTop: 4 }}>{channel.rules}</Text>
              </View>
            )}
            <TouchableOpacity style={[s.row, { borderBottomColor: c.border }]} onPress={shareInvite}>
              <Ionicons name="share-social-outline" size={20} color={BRAND} />
              <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>Share Invite ({channel.inviteCode})</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.row, { borderBottomColor: c.border }]} onPress={() => updateDoc(doc(db, 'users', myUid), { mutedChannels: isMuted ? arrayRemove(channel.id) : arrayUnion(channel.id) })}>
              <Ionicons name={isMuted ? 'notifications-outline' : 'notifications-off-outline'} size={20} color={c.text} />
              <Text style={{ color: c.text, fontWeight: '700' }}>{isMuted ? 'Unmute Channel' : 'Mute Channel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.row, { borderBottomColor: c.border }]} onPress={reportChannel}>
              <Ionicons name="flag-outline" size={20} color="#EF4444" />
              <Text style={{ color: '#EF4444', fontWeight: '700' }}>Report Channel</Text>
            </TouchableOpacity>
            {!isOwner && role !== 'none' && (
              <TouchableOpacity style={[s.row, { borderBottomColor: c.border }]} onPress={async () => { await leaveChannelSafe(channel, myUid); onClose(); onLeaveOrDelete?.(); }}>
                <Ionicons name="exit-outline" size={20} color="#EF4444" />
                <Text style={{ color: '#EF4444', fontWeight: '700' }}>Leave Channel</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}

        {tab === 'members' && (
          <FlatList
            data={membersList}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: 14 }}
            renderItem={({ item }) => {
              const r = getChannelRole(channel, item.id);
              return (
                <View style={[s.row, { borderBottomColor: c.border }]}>
                  <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>@{item.username || 'user'} ({r})</Text>
                  {isOwner && item.id !== myUid && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity onPress={() => updateDoc(doc(db, 'channels', channel.id), { admins: r === 'admin' ? arrayRemove(item.id) : arrayUnion(item.id) })}>
                        <Text style={{ color: BRAND, fontWeight: '700', fontSize: 12 }}>{r === 'admin' ? 'Remove Admin' : 'Make Admin'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => Alert.alert('Transfer Ownership?', `Make @${item.username} the new owner?`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Transfer', onPress: () => transferChannelOwnership(channel, myUid, item.id) },
                      ])}>
                        <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 12 }}>Owner</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {isAdmin && item.id !== channel.ownerUid && item.id !== myUid && (
                    <TouchableOpacity onPress={() => updateDoc(doc(db, 'channels', channel.id), { members: arrayRemove(item.id), admins: arrayRemove(item.id), bannedUids: arrayUnion(item.id) })}>
                      <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 12 }}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }}
          />
        )}

        {tab === 'settings' && isOwner && (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <TextInput value={editName} onChangeText={setEditName} placeholder="Channel name" placeholderTextColor={c.muted} style={[s.inp, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} />
            <TextInput value={editDesc} onChangeText={setEditDesc} multiline placeholder="Description" placeholderTextColor={c.muted} style={[s.inp, { backgroundColor: c.input, borderColor: c.border, color: c.text, minHeight: 64 }]} />
            <TextInput value={editRules} onChangeText={setEditRules} multiline placeholder="Rules" placeholderTextColor={c.muted} style={[s.inp, { backgroundColor: c.input, borderColor: c.border, color: c.text, minHeight: 64 }]} />
            <View style={s.rowBet}>
              <Text style={{ color: c.text, fontWeight: '600' }}>Allow member replies</Text>
              <Switch value={Boolean(channel.allowReplies)} onValueChange={(v) => updateDoc(doc(db, 'channels', channel.id), { allowReplies: v })} trackColor={{ true: BRAND }} />
            </View>
            <TouchableOpacity onPress={saveSettings} style={[s.btn, { backgroundColor: BRAND }]}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Save Changes</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => updateDoc(doc(db, 'channels', channel.id), { inviteCode: Math.random().toString(36).slice(2, 10).toUpperCase(), inviteActive: true }).then(() => Alert.alert('Updated', 'Invite code rotated.'))} style={[s.btn, { backgroundColor: c.input }]}>
              <Text style={{ color: c.text, fontWeight: '700' }}>Reset Invite Link</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => Alert.alert('Delete Channel?', 'All members will immediately lose access.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Delete', style: 'destructive', onPress: async () => { await deleteChannelSafe(channel, myUid); onClose(); onLeaveOrDelete?.(); } },
            ])} style={[s.btn, { backgroundColor: '#EF4444' }]}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>Delete Channel</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 46 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 17, fontWeight: '800' },
  avLg: { width: 82, height: 82, borderRadius: 41 },
  inp: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  tabs: { flexDirection: 'row', gap: 8, padding: 12 },
  rowBet: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  card: { padding: 12, borderRadius: 12, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5 },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
});
