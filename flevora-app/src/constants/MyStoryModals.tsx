import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput, FlatList, Image,
  Switch, ActivityIndicator, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  doc, updateDoc, addDoc, deleteDoc, collection, query, where, getDocs,
  onSnapshot, arrayUnion, arrayRemove, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { useLang } from './i18n';
import { isStoryExpired, STORY_TTL_MS, storyT } from './storiesCapabilities';

export function HighlightPickerModal({ visible, onClose, uid, me, story }: any) {
  const { c } = useTheme();
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('Highlights');
  const [loading, setLoading] = useState(false);
  const list: any[] = me?.highlights || [];

  const addToExisting = async (hl: any) => {
    setLoading(true);
    const next = list.map((h) => h.id === hl.id ? { ...h, stories: Array.from(new Set([...(h.stories || []), story.mediaUrl])) } : h);
    await updateDoc(doc(db, 'users', uid), { highlights: next });
    setLoading(false); onClose(true);
    Alert.alert('Added', `Added to "${hl.title}" highlight.`);
  };

  const createNew = async () => {
    if (!title.trim()) return;
    setLoading(true);
    const next = [...list, { id: `hl_${Date.now()}`, title: title.trim(), cover: story.mediaUrl, stories: [story.mediaUrl] }];
    await updateDoc(doc(db, 'users', uid), { highlights: next });
    setLoading(false); setCreating(false); onClose(true);
    Alert.alert('Created', 'New highlight created.');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose(false)}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={() => onClose(false)}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          {loading ? (
            <View style={{ padding: 30, alignItems: 'center' }}><ActivityIndicator size="large" color={BRAND} /></View>
          ) : creating ? (
            <View style={{ alignItems: 'center', paddingVertical: 10 }}>
              <Text style={[s.title, { color: c.text }]}>Add to highlight</Text>
              {!!story?.mediaUrl && <Image source={{ uri: story.mediaUrl }} style={{ width: 74, height: 74, borderRadius: 37, marginVertical: 14 }} />}
              <TextInput value={title} onChangeText={setTitle} style={[s.inp, { color: c.text, borderColor: c.border }]} placeholder="Highlight name" placeholderTextColor={c.muted} />
              <TouchableOpacity style={[s.blueBtn, { backgroundColor: BRAND }]} onPress={createNew}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Add</Text></TouchableOpacity>
            </View>
          ) : (
            <View>
              <View style={s.rowBet}><View style={{ width: 24 }} /><Text style={[s.title, { color: c.text }]}>Add to highlights</Text><TouchableOpacity onPress={() => setCreating(true)}><Ionicons name="add" size={26} color={c.text} /></TouchableOpacity></View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingVertical: 14 }}>
                {list.map((h) => (
                  <TouchableOpacity key={h.id} style={{ alignItems: 'center', width: 72 }} onPress={() => addToExisting(h)}>
                    <Image source={{ uri: h.cover || story?.mediaUrl }} style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: c.border }} />
                    <Text style={{ fontSize: 12, marginTop: 4, color: c.text }} numberOfLines={1}>{h.title}</Text>
                  </TouchableOpacity>
                ))}
                {!list.length && <TouchableOpacity onPress={() => setCreating(true)}><Text style={{ color: BRAND, fontWeight: '700' }}>+ Create first highlight</Text></TouchableOpacity>}
              </View>
            </View>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function MentionModal({ visible, onClose, allUsers, uid, me, story }: any) {
  const { c } = useTheme();
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>(story?.mentions || []);
  const filtered = allUsers.filter((u: any) => u.id !== uid && (u.username || '').toLowerCase().includes(q.toLowerCase()));

  const save = async () => {
    await updateDoc(doc(db, 'stories', story.id), { mentions: picked });
    for (const tid of picked) {
      await addDoc(collection(db, 'notifications'), { toUid: tid, fromUid: uid, fromUsername: me?.username || 'user', type: 'mention', storyId: story.id, message: 'mentioned you in their story.', read: false, createdAt: serverTimestamp() }).catch(() => {});
    }
    onClose(); Alert.alert('Mentioned', `${picked.length} people mentioned.`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={s.bg}><View style={[s.sheet, { height: '75%', backgroundColor: c.card }]}>
        <View style={s.handle} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search users..." placeholderTextColor={c.muted} style={[s.sInp, { backgroundColor: c.input, color: c.text }]} />
        <FlatList data={filtered} keyExtractor={(i) => i.id} renderItem={({ item }) => {
          const sel = picked.includes(item.id);
          return (
            <TouchableOpacity style={s.uRow} onPress={() => setPicked((p) => sel ? p.filter((x) => x !== item.id) : [...p, item.id])}>
              {item.photoUrl || item.avatar ? <Image source={{ uri: item.photoUrl || item.avatar }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={18} color={BRAND_TEXT} /></View>}
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', color: c.text }}>@{item.username}</Text><Text style={{ fontSize: 12, color: c.muted }}>{item.fullName || item.name || ''}</Text></View>
              <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={22} color={sel ? BRAND : c.muted} />
            </TouchableOpacity>
          );
        }} />
        <TouchableOpacity style={[s.blueBtn, { backgroundColor: BRAND }]} onPress={save}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Save Mentions</Text></TouchableOpacity>
      </View></View>
    </Modal>
  );
}

export function StoryMoreModal({ visible, onClose, story, isOwn = true, ownerMuted = false, onAction }: any) {
  const { c } = useTheme();
  const { lang } = useLang();
  const L = storyT(lang);

  const opts = isOwn ? [
    { k: 'delete', l: 'Delete', red: true },
    { k: 'archive', l: 'Archive' },
    { k: 'save', l: 'Save / Share Media' },
    { k: 'send', l: 'Send to...' },
    { k: 'ai', l: story?.aiLabel ? 'Remove AI label' : 'Add AI label' },
    { k: 'settings', l: 'Story settings' },
    { k: 'comments', l: story?.commentsDisabled ? 'Turn on commenting' : 'Turn off commenting' },
  ] : [
    { k: 'profile', l: L.visitProfile },
    { k: 'send', l: 'Send to...' },
    { k: 'mute', l: ownerMuted ? L.unmuteStory : L.muteStory },
    { k: 'report', l: L.reportStory, red: true },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <View style={[s.sheet, { backgroundColor: c.card }]}><View style={s.handle} />
          {opts.map((o) => (
            <TouchableOpacity key={o.k} style={{ paddingVertical: 13 }} onPress={() => { onClose(); onAction(o.k); }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: o.red ? '#EF4444' : c.text }}>{o.l}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
function UserListPickerModal({ visible, title, uid, field, selectedIds, onClose }: any) {
  const { c } = useTheme();
  const [users, setUsers] = useState<any[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!visible) return;
    return onSnapshot(collection(db, 'users'), (sn) => {
      setUsers(sn.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.id !== uid));
    }, () => {});
  }, [visible, uid]);

  const filtered = users.filter((u) => (u.username || '').toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (targetUid: string, has: boolean) => {
    updateDoc(doc(db, 'users', uid), { [field]: has ? arrayRemove(targetUid) : arrayUnion(targetUid) }).catch(() => {});
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 48, paddingHorizontal: 16 }}>
        <View style={s.rowBet}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[s.title, { color: c.text }]}>{title}</Text>
          <View style={{ width: 24 }} />
        </View>
        <TextInput value={q} onChangeText={setQ} placeholder="Search users..." placeholderTextColor={c.muted} style={[s.sInp, { backgroundColor: c.input, color: c.text, marginTop: 8 }]} />
        <FlatList
          data={filtered}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => {
            const has = Array.isArray(selectedIds) && selectedIds.includes(item.id);
            return (
              <TouchableOpacity style={s.uRow} onPress={() => toggle(item.id, has)}>
                {item.photoUrl || item.avatar ? <Image source={{ uri: item.photoUrl || item.avatar }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={18} color={BRAND_TEXT} /></View>}
                <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', color: c.text }}>@{item.username}</Text></View>
                <Ionicons name={has ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={has ? '#10B981' : c.muted} />
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

export function StorySettingsModal({ visible, onClose, uid, me }: any) {
  const { c } = useTheme();
  const [cfOpen, setCfOpen] = useState(false);
  const [hideOpen, setHideOpen] = useState(false);
  const st = me?.storySettings || {};
  const setSt = (k: string, v: any) => updateDoc(doc(db, 'users', uid), { [`storySettings.${k}`]: v });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 48, paddingHorizontal: 16 }}>
        <View style={s.rowBet}><TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity><Text style={[s.title, { color: c.text }]}>Story Settings</Text><View style={{ width: 24 }} /></View>
        <Text style={[s.sec, { color: c.text }]}>Viewing</Text>
        <TouchableOpacity style={s.rowBet} onPress={() => setHideOpen(true)}>
          <Text style={{ fontSize: 15, color: c.text }}>Hide story from</Text>
          <Text style={{ color: c.muted }}>{(me?.hiddenStoryFrom || []).length} people ›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.rowBet} onPress={() => setCfOpen(true)}>
          <Text style={{ fontSize: 15, color: c.text }}>Close friends ★</Text>
          <Text style={{ color: '#10B981', fontWeight: '700' }}>{(me?.closeFriends || []).length} people ›</Text>
        </TouchableOpacity>

        <Text style={[s.sec, { color: c.text }]}>Replying — Allow message replies</Text>
        {['Everyone', 'People you follow', 'Off'].map((opt) => (
          <TouchableOpacity key={opt} style={s.rowBet} onPress={() => setSt('replies', opt)}>
            <Text style={{ fontSize: 15, color: c.text }}>{opt}</Text>
            <Ionicons name={(st.replies || 'Everyone') === opt ? 'radio-button-on' : 'radio-button-off'} size={20} color={BRAND} />
          </TouchableOpacity>
        ))}

        <Text style={[s.sec, { color: c.text }]}>Saving & Sharing</Text>
        {[['saveArchive', 'Save story to archive'], ['shareStory', 'Allow sharing to story'], ['shareMsg', 'Allow sharing to messages']].map(([k, l]) => (
          <View key={k} style={s.rowBet}><Text style={{ fontSize: 15, color: c.text }}>{l}</Text><Switch value={st[k] !== false} onValueChange={(v) => setSt(k, v)} /></View>
        ))}

        <UserListPickerModal visible={cfOpen} title="Close Friends" uid={uid} field="closeFriends" selectedIds={me?.closeFriends || []} onClose={() => setCfOpen(false)} />
        <UserListPickerModal visible={hideOpen} title="Hide Story From" uid={uid} field="hiddenStoryFrom" selectedIds={me?.hiddenStoryFrom || []} onClose={() => setHideOpen(false)} />
      </View>
    </Modal>
  );
}

export function StoryArchiveModal({ visible, uid, me, onClose }: any) {
  const { c } = useTheme();
  const { lang } = useLang();
  const L = storyT(lang);
  const [archived, setArchived] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hlStory, setHlStory] = useState<any>(null);

  const load = async () => {
    if (!uid) return;
    setLoading(true);
    try {
      const sn = await getDocs(query(collection(db, 'stories'), where('uid', '==', uid)));
      const list = sn.docs.map((d) => ({ id: d.id, ...d.data() }))
        .filter((st: any) => isStoryExpired(st))
        .sort((a: any, b: any) => (b.createdAtMs || b.createdAt?.toMillis?.() || 0) - (a.createdAtMs || a.createdAt?.toMillis?.() || 0));
      setArchived(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (visible) load(); }, [visible, uid]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 48 }}>
        <View style={[s.rowBet, { paddingHorizontal: 16, borderBottomWidth: 0.5, borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[s.title, { color: c.text }]}>{L.archive}</Text>
          <View style={{ width: 24 }} />
        </View>
        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={BRAND} /> : (
          <FlatList
            data={archived}
            numColumns={3}
            keyExtractor={(i) => i.id}
            ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No archived stories yet.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ width: '33%', height: 160, margin: 0.5, backgroundColor: item.bgColor || '#111', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => Alert.alert('Archived Story', 'Choose an action:', [
                  { text: 'Add to Highlight', onPress: () => setHlStory(item) },
                  { text: 'Reshare for 24h', onPress: async () => { await updateDoc(doc(db, 'stories', item.id), { archived: false, expiresAt: Date.now() + STORY_TTL_MS }); load(); } },
                  { text: 'Delete Permanently', style: 'destructive', onPress: async () => { await deleteDoc(doc(db, 'stories', item.id)); load(); } },
                  { text: 'Cancel', style: 'cancel' },
                ])}
              >
                {item.mediaUrl ? <Image source={{ uri: item.mediaUrl }} style={{ width: '100%', height: '100%' }} /> : (
                  <Text style={{ color: '#fff', fontSize: 12, padding: 6, textAlign: 'center' }} numberOfLines={3}>{item.textStory}</Text>
                )}
              </TouchableOpacity>
            )}
          />
        )}
        <HighlightPickerModal visible={!!hlStory} onClose={() => setHlStory(null)} uid={uid} me={me} story={hlStory} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 28 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  rowBet: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  inp: { width: '80%', borderBottomWidth: 1, textAlign: 'center', fontSize: 16, paddingVertical: 6, marginBottom: 16 },
  sInp: { borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 10 },
  blueBtn: { width: '100%', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  uRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, gap: 12 },
  av: { width: 44, height: 44, borderRadius: 22 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  sec: { fontSize: 15, fontWeight: '700', marginTop: 18, marginBottom: 6 },
});
