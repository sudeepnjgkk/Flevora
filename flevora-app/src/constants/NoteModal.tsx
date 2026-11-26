import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import { auth, db } from '../config';
import { BRAND } from './theme';

const GIPHY_API_KEY = ''; // Paid/GIPHY key milne par yahan paste karein
const TRACKS = [
  { id: '1', title: 'Dil Ki Khamoshi', artist: 'Arijit Singh • 3:24', cat: 'For you' },
  { id: '2', title: 'Teri Nazron Ki Sadiqay', artist: 'Zuhair • 2:53', cat: 'Trending' },
  { id: '3', title: 'Shauq', artist: 'Amit Trivedi • 3:40', cat: 'Saved' },
  { id: '4', title: 'Original Audio', artist: 'Flevora Mix • 0:30', cat: 'Original audio' },
  { id: '5', title: 'Kesariya Lo-Fi', artist: 'Pritam • 2:45', cat: 'For you' },
  { id: '6', title: 'Rani Teri', artist: 'Roshani • 1:50', cat: 'Trending' },
];
const PLACES = ['Lucknow, India', 'New Delhi, India', 'Mumbai, India', 'Kanpur, India', 'Home', 'College'];
const GIF_CATS = ['Trending', 'Love', 'Haha', 'Sad', 'Cool'];
const FALLBACK_GIFS = [
  { id: 'g1', emoji: '🥰', label: 'Love' }, { id: 'g2', emoji: '😂', label: 'Haha' },
  { id: 'g3', emoji: '🔥', label: 'Fire' }, { id: 'g4', emoji: '💯', label: '100' },
  { id: 'g5', emoji: '😎', label: 'Cool' }, { id: 'g6', emoji: '🥳', label: 'Party' },
  { id: 'g7', emoji: '😢', label: 'Sad' }, { id: 'g8', emoji: '✨', label: 'Vibe' },
];

export const canSeeNote = (note: any, myUid: string, ownerUid: string, me: any) => {
  if (!note || (note.expiresAt && note.expiresAt <= Date.now())) return false;
  if (ownerUid === myUid) return true;
  if (note.audience === 'closeFriends') return Array.isArray(note.allowedUids) && note.allowedUids.includes(myUid);
  if (Array.isArray(note.allowedUids) && note.allowedUids.length > 0) return note.allowedUids.includes(myUid);
  return Array.isArray(me?.following) && me.following.includes(ownerUid);
};

export function NoteModal({ visible, me, users, onClose }: { visible: boolean; me: any; users: any[]; onClose: () => void }) {
  const uid = auth.currentUser?.uid || '';
  const [tab, setTab] = useState<'main' | 'music' | 'location' | 'gif' | 'audience'>('main');
  const [text, setText] = useState('');
  const [music, setMusic] = useState<{ title: string; artist: string } | null>(null);
  const [location, setLocation] = useState('');
  const [gif, setGif] = useState('');
  const [gifUrl, setGifUrl] = useState('');
  const [giphyList, setGiphyList] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifCat, setGifCat] = useState('Trending');
  const [audience, setAudience] = useState<'friends' | 'closeFriends'>('friends');
  const [selectedUids, setSelectedUids] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [musicCat, setMusicCat] = useState('For you');

  useEffect(() => {
    if (visible) {
      const n = me?.note || {};
      setText(n.text || ''); setMusic(n.music || null); setLocation(n.location || '');
      setGif(n.gif || ''); setGifUrl(n.gifUrl || ''); setAudience(n.audience || 'friends');
      setSelectedUids(Array.isArray(n.allowedUids) ? n.allowedUids : []);
      setTab('main'); setSearch('');
    }
  }, [visible]);

  useEffect(() => {
    if (tab !== 'gif' || !GIPHY_API_KEY) return;
    setGifLoading(true);
    const q = search.trim() || (gifCat === 'Trending' ? '' : gifCat);
    const url = q
      ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(q)}&limit=20&rating=g`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=20&rating=g`;
    fetch(url).then((r) => r.json()).then((j) => setGiphyList(j.data || [])).catch(() => setGiphyList([])).finally(() => setGifLoading(false));
  }, [tab, search, gifCat]);

  const canShare = !!(text.trim() || music || location || gif || gifUrl);
  const dp = me?.photoUrl || me?.avatar || '';

  const saveNote = async () => {
    if (!uid || !canShare) return;
    await updateDoc(doc(db, 'users', uid), {
      note: {
        text: text.trim(), music: music || null, location: location || '', gif: gif || '', gifUrl: gifUrl || '',
        audience, allowedUids: audience === 'closeFriends' ? selectedUids : [], expiresAt: Date.now() + 86400000,
      },
    }).catch(() => {});
    onClose();
  };

  const deleteNote = async () => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid), { note: deleteField() }).catch(() => {});
    onClose();
  };

  const toggleUser = (id: string) => setSelectedUids((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.wrap}>
        {tab === 'main' && (
          <>
            <View style={s.top}>
              <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color="#111" /></TouchableOpacity>
              {!!me?.note && <TouchableOpacity onPress={deleteNote}><Text style={{ color: '#EF4444', fontWeight: '700' }}>Delete note</Text></TouchableOpacity>}
            </View>
            <View style={s.center}>
              <View style={s.bubble}>
                {!!gifUrl && <Image source={{ uri: gifUrl }} style={{ width: 96, height: 96, borderRadius: 12, alignSelf: 'center', marginBottom: 4 }} />}
                {!!gif && !gifUrl && <Text style={{ fontSize: 24, textAlign: 'center', marginBottom: 2 }}>{gif}</Text>}
                <TextInput value={text} onChangeText={setText} placeholder="Share a thought..." placeholderTextColor="#999" maxLength={60} style={s.input} />
              </View>
              <View style={s.tail} />
              {dp ? <Image source={{ uri: dp }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={38} color="#fff" /></View>}
              {!!music && <TouchableOpacity onPress={() => setMusic(null)} style={s.tagPill}><Ionicons name="musical-notes" size={14} color="#EC4899" /><Text style={s.tagTxt}>{music.title} ×</Text></TouchableOpacity>}
              {!!location && <TouchableOpacity onPress={() => setLocation('')} style={s.tagPill}><Ionicons name="location" size={14} color={BRAND} /><Text style={s.tagTxt}>{location} ×</Text></TouchableOpacity>}
              <View style={s.iconRow}>
                <TouchableOpacity onPress={() => { setSearch(''); setTab('music'); }} style={s.toolBtn}><Ionicons name="musical-notes" size={22} color="#EC4899" /></TouchableOpacity>
                <TouchableOpacity onPress={() => { setSearch(''); setTab('location'); }} style={s.toolBtn}><Ionicons name="location" size={22} color={BRAND} /></TouchableOpacity>
                <TouchableOpacity onPress={() => { setSearch(''); setTab('gif'); }} style={s.toolBtn}><Text style={{ color: '#10B981', fontWeight: '900', fontSize: 12 }}>GIF</Text></TouchableOpacity>
              </View>
            </View>
            <View style={s.bottom}>
              <TouchableOpacity onPress={() => setTab('audience')} style={s.audBtn}>
                <Ionicons name={audience === 'closeFriends' ? 'star' : 'people'} size={18} color={audience === 'closeFriends' ? '#10B981' : '#111'} />
                <Text style={{ fontWeight: '700', color: '#111' }}>{audience === 'closeFriends' ? `Close Friends (${selectedUids.length})` : 'Share with friends'}</Text>
                <Ionicons name="chevron-forward" size={16} color="#555" />
              </TouchableOpacity>
              <TouchableOpacity onPress={saveNote} disabled={!canShare} style={[s.shareBtn, { opacity: canShare ? 1 : 0.4 }]}><Text style={{ color: '#fff', fontWeight: '700' }}>Share</Text></TouchableOpacity>
            </View>
          </>
        )}

        {tab === 'music' && (
          <View style={s.sub}>
            <View style={s.subHead}><TouchableOpacity onPress={() => setTab('main')}><Ionicons name="arrow-back" size={24} /></TouchableOpacity><Text style={s.subTitle}>Select Music</Text><View style={{ width: 24 }} /></View>
            <TextInput value={search} onChangeText={setSearch} placeholder="Search music..." style={s.searchBox} />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {['For you', 'Trending', 'Saved', 'Original audio'].map((c) => (
                <TouchableOpacity key={c} onPress={() => setMusicCat(c)} style={[s.catPill, musicCat === c && { backgroundColor: '#111' }]}><Text style={{ color: musicCat === c ? '#fff' : '#333', fontSize: 12, fontWeight: '700' }}>{c}</Text></TouchableOpacity>
              ))}
            </View>
            <FlatList data={TRACKS.filter((t) => (search ? t.title.toLowerCase().includes(search.toLowerCase()) : t.cat === musicCat))} keyExtractor={(i) => i.id} renderItem={({ item }) => (
              <TouchableOpacity style={s.listRow} onPress={() => { setMusic({ title: item.title, artist: item.artist }); setTab('main'); }}>
                <Ionicons name="musical-notes" size={22} color="#EC4899" /><View><Text style={{ fontWeight: '700' }}>{item.title}</Text><Text style={{ color: '#666', fontSize: 12 }}>{item.artist}</Text></View>
              </TouchableOpacity>
            )} />
          </View>
        )}

        {tab === 'location' && (
          <View style={s.sub}>
            <View style={s.subHead}><TouchableOpacity onPress={() => setTab('main')}><Ionicons name="arrow-back" size={24} /></TouchableOpacity><Text style={s.subTitle}>Choose Location</Text><View style={{ width: 24 }} /></View>
            <TextInput value={search} onChangeText={setSearch} placeholder="Type or search location..." style={s.searchBox} />
            {!!search.trim() && <TouchableOpacity style={s.listRow} onPress={() => { setLocation(search.trim()); setTab('main'); }}><Ionicons name="add-circle" size={22} color={BRAND} /><Text style={{ fontWeight: '700' }}>Use "{search.trim()}"</Text></TouchableOpacity>}
            <FlatList data={PLACES.filter((p) => p.toLowerCase().includes(search.toLowerCase()))} keyExtractor={(i) => i} renderItem={({ item }) => (
              <TouchableOpacity style={s.listRow} onPress={() => { setLocation(item); setTab('main'); }}><Ionicons name="location" size={20} color={BRAND} /><Text style={{ fontWeight: '600' }}>{item}</Text></TouchableOpacity>
            )} />
          </View>
        )}

        {tab === 'gif' && (
          <View style={s.sub}>
            <View style={s.subHead}><TouchableOpacity onPress={() => setTab('main')}><Ionicons name="arrow-back" size={24} /></TouchableOpacity><Text style={s.subTitle}>Search GIPHY</Text><View style={{ width: 24 }} /></View>
            <TextInput value={search} onChangeText={setSearch} placeholder="Search GIPHY..." style={s.searchBox} />
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              {GIF_CATS.map((c) => (
                <TouchableOpacity key={c} onPress={() => setGifCat(c)} style={[s.catPill, gifCat === c && { backgroundColor: '#111' }]}><Text style={{ color: gifCat === c ? '#fff' : '#333', fontSize: 12, fontWeight: '700' }}>{c}</Text></TouchableOpacity>
              ))}
            </View>
            {GIPHY_API_KEY ? (
              gifLoading ? <ActivityIndicator size="large" color={BRAND} style={{ marginTop: 30 }} /> : (
                <FlatList numColumns={2} data={giphyList} keyExtractor={(i) => i.id} renderItem={({ item }) => (
                  <TouchableOpacity style={s.giphyBox} onPress={() => { setGifUrl(item.images?.fixed_height?.url || ''); setGif(''); setTab('main'); }}>
                    <Image source={{ uri: item.images?.fixed_height_small?.url }} style={{ width: '100%', height: 120, borderRadius: 10 }} />
                  </TouchableOpacity>
                )} />
              )
            ) : (
              <>
                <Text style={{ color: '#666', fontSize: 12, marginBottom: 10 }}>Live GIPHY search ke liye GIPHY_API_KEY add karein — tab tak reaction stickers use karein:</Text>
                <FlatList numColumns={4} data={FALLBACK_GIFS.filter((g) => g.label.toLowerCase().includes(search.toLowerCase()))} keyExtractor={(i) => i.id} renderItem={({ item }) => (
                  <TouchableOpacity style={s.gifCell} onPress={() => { setGif(item.emoji); setGifUrl(''); setTab('main'); }}>
                    <Text style={{ fontSize: 34 }}>{item.emoji}</Text><Text style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{item.label}</Text>
                  </TouchableOpacity>
                )} />
              </>
            )}
          </View>
        )}

        {tab === 'audience' && (
          <View style={s.sub}>
            <View style={s.subHead}>
              <TouchableOpacity onPress={() => setTab('main')}><Text style={{ fontSize: 15, color: '#555' }}>Cancel</Text></TouchableOpacity>
              <Text style={s.subTitle}>Share with</Text>
              <TouchableOpacity onPress={() => setTab('main')}><Text style={{ fontSize: 15, fontWeight: '800', color: BRAND }}>Done</Text></TouchableOpacity>
            </View>
            <TouchableOpacity style={s.listRow} onPress={() => setAudience('friends')}>
              <Ionicons name="people-circle" size={32} color="#111" /><View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>Friends</Text><Text style={{ color: '#666', fontSize: 12 }}>Followers you follow back</Text></View>
              <Ionicons name={audience === 'friends' ? 'radio-button-on' : 'radio-button-off'} size={22} color={BRAND} />
            </TouchableOpacity>
            <TouchableOpacity style={s.listRow} onPress={() => setAudience('closeFriends')}>
              <Ionicons name="star-circle" size={32} color="#10B981" /><View style={{ flex: 1 }}><Text style={{ fontWeight: '700' }}>Close Friends</Text><Text style={{ color: '#666', fontSize: 12 }}>Only selected people ({selectedUids.length})</Text></View>
              <Ionicons name={audience === 'closeFriends' ? 'radio-button-on' : 'radio-button-off'} size={22} color="#10B981" />
            </TouchableOpacity>
            {audience === 'closeFriends' && (
              <FlatList data={users} keyExtractor={(u) => u.id} renderItem={({ item }) => {
                const picked = selectedUids.includes(item.id);
                return (
                  <TouchableOpacity style={s.listRow} onPress={() => toggleUser(item.id)}>
                    <Text style={{ flex: 1, fontWeight: '600' }}>@{item.username || 'user'}</Text>
                    <Ionicons name={picked ? 'checkbox' : 'square-outline'} size={22} color={picked ? BRAND : '#888'} />
                  </TouchableOpacity>
                );
              }} />
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#fff', justifyContent: 'space-between', paddingTop: 48, paddingBottom: 22, paddingHorizontal: 16 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  center: { alignItems: 'center' },
  bubble: { backgroundColor: '#F3F4F6', borderRadius: 22, paddingHorizontal: 18, paddingVertical: 12, minWidth: 160, maxWidth: '82%' },
  input: { fontSize: 15, fontWeight: '600', textAlign: 'center', color: '#111', padding: 0 },
  tail: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#F3F4F6', marginTop: -4, marginBottom: 4 },
  av: { width: 88, height: 88, borderRadius: 44 },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, backgroundColor: '#F3F4F6', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  tagTxt: { fontSize: 12, fontWeight: '700', color: '#111' },
  iconRow: { flexDirection: 'row', gap: 14, marginTop: 16 },
  toolBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  audBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shareBtn: { backgroundColor: BRAND, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 22 },
  sub: { flex: 1 },
  subHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  subTitle: { fontSize: 17, fontWeight: '800' },
  searchBox: { backgroundColor: '#F3F4F6', borderRadius: 12, padding: 11, marginBottom: 12 },
  catPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14, backgroundColor: '#F3F4F6' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 0.5, borderBottomColor: '#eee' },
  giphyBox: { flex: 1, padding: 4 },
  gifCell: { flex: 1, alignItems: 'center', paddingVertical: 16 },
});
                               
