import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, TextInput, FlatList, Image, Switch, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { BRAND } from './theme';

export function HighlightPickerModal({ visible, onClose, uid, me, story }: any) {
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('Highlights');
  const [loading, setLoading] = useState(false);
  const list: any[] = me?.highlights || [];

  const addToExisting = async (hl: any) => {
    setLoading(true);
    const next = list.map((h) => h.id === hl.id ? { ...h, stories: Array.from(new Set([...(h.stories || []), story.mediaUrl])) } : h);
    await updateDoc(doc(db, 'users', uid), { highlights: next });
    setLoading(false); onClose(true);
    Alert.alert('Added', `"${hl.title}" highlight me add ho gaya!`);
  };

  const createNew = async () => {
    if (!title.trim()) return;
    setLoading(true);
    const next = [...list, { id: `hl_${Date.now()}`, title: title.trim(), cover: story.mediaUrl, stories: [story.mediaUrl] }];
    await updateDoc(doc(db, 'users', uid), { highlights: next });
    setLoading(false); setCreating(false); onClose(true);
    Alert.alert('Created', 'Naya highlight ban gaya!');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose(false)}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={() => onClose(false)}>
        <TouchableOpacity activeOpacity={1} style={s.sheet}>
          <View style={s.handle} />
          {loading ? (
            <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator size="large" color={BRAND} /><Text style={{ marginTop: 10, fontWeight: '600' }}>Adding to highlight...</Text></View>
          ) : creating ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Text style={s.title}>Add to highlight</Text>
              <Image source={{ uri: story?.mediaUrl }} style={{ width: 74, height: 74, borderRadius: 37, marginVertical: 14 }} />
              <TextInput value={title} onChangeText={setTitle} style={s.inp} placeholder="Highlight name" />
              <TouchableOpacity style={s.blueBtn} onPress={createNew}><Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text></TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={s.rowBet}><View style={{ width: 24 }} /><Text style={s.title}>Add to highlights</Text><TouchableOpacity onPress={() => setCreating(true)}><Ionicons name="add" size={26} color="#111" /></TouchableOpacity></View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 14 }}>
                {list.map((h) => (
                  <TouchableOpacity key={h.id} style={{ alignItems: 'center', width: 72 }} onPress={() => addToExisting(h)}>
                    <Image source={{ uri: h.cover || story?.mediaUrl }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: '#E5E7EB' }} />
                    <Text style={{ fontSize: 12, marginTop: 4 }} numberOfLines={1}>{h.title}</Text>
                  </TouchableOpacity>
                ))}
                {!list.length && <TouchableOpacity onPress={() => setCreating(true)}><Text style={{ color: '#3B82F6', fontWeight: '600' }}>+ Create first highlight</Text></TouchableOpacity>}
              </View>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function MentionModal({ visible, onClose, allUsers, uid, me, story }: any) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>(story?.mentions || []);
  const filtered = allUsers.filter((u: any) => u.id !== uid && (u.username || '').toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    await updateDoc(doc(db, 'stories', story.id), { mentions: picked });
    for (const tid of picked) {
      await addDoc(collection(db, 'notifications'), { toUid: tid, fromUid: uid, fromUsername: me?.username || 'user', type: 'mention', message: 'mentioned you in their story.', read: false, createdAt: serverTimestamp() }).catch(() => {});
    }
    onClose(); Alert.alert('Mentioned', `${picked.length} people mentioned!`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.bg}><View style={[s.sheet, { height: '75%' }]}>
        <View style={s.handle} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search" style={s.sInp} />
        <Text style={{ fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 10 }}>People added here will be mentioned in your story.</Text>
        <FlatList data={filtered} keyExtractor={(i) => i.id} renderItem={({ item }) => {
          const sel = picked.includes(item.id);
          return (
            <TouchableOpacity style={s.uRow} onPress={() => setPicked((p) => sel ? p.filter((x) => x !== item.id) : [...p, item.id])}>
              {item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={18} color="#fff" /></View>}
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>{item.username}</Text><Text style={{ fontSize: 12, color: '#6B7280' }}>{item.fullName || item.name || ''}</Text></View>
              <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={22} color={sel ? '#111' : '#9CA3AF'} />
            </TouchableOpacity>
          );
        }} />
        <TouchableOpacity style={s.blueBtn} onPress={save}><Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text></TouchableOpacity>
      </View></View>
    </Modal>
  );
}

export function StoryMoreModal({ visible, onClose, story, onAction }: any) {
  const opts = [
    { k: 'delete', l: 'Delete', red: true },
    { k: 'archive', l: 'Archive' },
    { k: 'save', l: 'Save video / photo' },
    { k: 'send', l: 'Send to...' },
    { k: 'ai', l: story?.aiLabel ? 'Remove AI label' : 'Edit AI label' },
    { k: 'share', l: 'Share' },
    { k: 'settings', l: 'Go to story settings' },
    { k: 'comments', l: story?.commentsDisabled ? 'Turn on commenting' : 'Turn off commenting' },
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <View style={s.sheet}><View style={s.handle} />
          {opts.map((o) => <TouchableOpacity key={o.k} style={{ paddingVertical: 13 }} onPress={() => { onClose(); onAction(o.k); }}><Text style={{ fontSize: 15, fontWeight: '500', color: o.red ? '#EF4444' : '#111' }}>{o.l}</Text></TouchableOpacity>)}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function StorySettingsModal({ visible, onClose, uid, me }: any) {
  const st = me?.storySettings || {};
  const setSt = (k: string, v: any) => updateDoc(doc(db, 'users', uid), { [`storySettings.${k}`]: v });
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#fff', paddingTop: 48, paddingHorizontal: 16 }}>
        <View style={s.rowBet}><TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} /></TouchableOpacity><Text style={s.title}>Story</Text><View style={{ width: 24 }} /></View>
        <Text style={s.sec}>Viewing</Text>
        <Text style={s.sub}>Hide story from: {(me?.hiddenStoryFrom || []).length} people</Text>
        <Text style={s.sub}>Close friends: {(me?.closeFriends || []).length} people</Text>
        <Text style={s.sec}>Replying — Allow message replies</Text>
        {['Everyone', 'People you follow', 'Off'].map((opt) => (
          <TouchableOpacity key={opt} style={s.rowBet} onPress={() => setSt('replies', opt)}><Text style={{ fontSize: 15 }}>{opt}</Text><Ionicons name={(st.replies || 'Everyone') === opt ? 'radio-button-on' : 'radio-button-off'} size={20} color="#111" /></TouchableOpacity>
        ))}
        <Text style={s.sec}>Saving & Sharing</Text>
        {[['saveGallery', 'Save story to Gallery'], ['saveArchive', 'Save story to archive'], ['shareStory', 'Allow sharing to story'], ['shareMsg', 'Allow sharing to messages']].map(([k, l]) => (
          <View key={k} style={s.rowBet}><Text style={{ fontSize: 15 }}>{l}</Text><Switch value={st[k] !== false} onValueChange={(v) => setSt(k, v)} /></View>
        ))}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 28 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  rowBet: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  inp: { width: '80%', borderBottomWidth: 1, borderColor: '#CBD5E1', textAlign: 'center', fontSize: 16, paddingVertical: 6, marginBottom: 16 },
  sInp: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 10 },
  blueBtn: { width: '100%', backgroundColor: '#3B82F6', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  uRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  av: { width: 44, height: 44, borderRadius: 22 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  sec: { fontSize: 15, fontWeight: '700', marginTop: 18, marginBottom: 6 }, sub: { color: '#6B7280', paddingVertical: 4 },
});
            
