import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, Modal, TextInput, FlatList, ActivityIndicator, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../config';
import { BRAND } from './theme';
import { StoryViewerModal } from './StoryViewerModal';
import { HighlightViewerModal } from './HighlightViewerModal';

const W = Dimensions.get('window').width / 3 - 2;
const fmtDate = (ts: any) => {
  const d = ts?.toDate ? ts.toDate() : null;
  return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' }) : 'Recent';
};

export function HighlightsRow({ uid, user, isOwn, isOwner, highlights = [], c }: any) {
  const own = isOwn || isOwner;
  const [myStories, setMyStories] = useState<any[]>([]);
  const [step, setStep] = useState<'' | 'pick' | 'cover'>('');
  const [picked, setPicked] = useState<string[]>([]);
  const [cover, setCover] = useState('');
  const [title, setTitle] = useState('Highlights');
  const [loading, setLoading] = useState(false);
  const [viewHL, setViewHL] = useState<any>(null);

  useEffect(() => {
    if (!uid || !own) return;
    return onSnapshot(query(collection(db, 'stories'), where('uid', '==', uid)), (s) => {
      const l = s.docs.map((d) => ({ id: d.id, ...d.data() }));
      l.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setMyStories(l);
    });
  }, [uid, own]);

  const pickGalleryCover = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!res.canceled && res.assets[0]) setCover(res.assets[0].uri);
  };

  const saveHighlight = async () => {
    if (!picked.length || loading) return;
    setLoading(true);
    let finalCover = cover || picked[0];
    if (finalCover.startsWith('file') || finalCover.startsWith('content')) {
      const data = new FormData();
      data.append('file', { uri: finalCover, type: 'image/jpeg', name: `hl_${Date.now()}.jpg` } as any);
      data.append('upload_preset', 'flevora_upload');
      finalCover = await new Promise<string>((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://api.cloudinary.com/v1_1/faqfo0lu/image/upload');
        xhr.onload = () => resolve(JSON.parse(xhr.responseText)?.secure_url || picked[0]);
        xhr.onerror = () => resolve(picked[0]);
        xhr.send(data);
      });
    }
    const next = [...highlights, { id: `hl_${Date.now()}`, title: title.trim() || 'Highlights', cover: finalCover, stories: picked }];
    await updateDoc(doc(db, 'users', uid), { highlights: next });
    setLoading(false); setStep(''); setPicked([]); setTitle('Highlights');
  };

  const shown = highlights.filter((h: any) => !h.archived);

  return (
    <View style={{ marginVertical: 10 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
        {own && (
          <TouchableOpacity style={s.item} onPress={() => { setPicked([]); setStep('pick'); }}>
            <View style={[s.circle, { borderColor: c.text }]}><Ionicons name="add" size={28} color={c.text} /></View>
            <Text style={[s.lbl, { color: c.text }]}>New</Text>
          </TouchableOpacity>
        )}
        {shown.map((hl: any) => (
          <TouchableOpacity key={hl.id} style={s.item} onPress={() => setViewHL(hl)}>
            <View style={[s.circle, { borderColor: c.border }]}><Image source={{ uri: hl.cover || hl.stories?.[0] }} style={s.img} /></View>
            <Text style={[s.lbl, { color: c.text }]} numberOfLines={1}>{hl.title}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={step === 'pick'} animationType="slide" onRequestClose={() => setStep('')}>
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 46 }}>
          <View style={s.hdr}>
            <TouchableOpacity onPress={() => setStep('')}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>{picked.length} selected</Text>
            <TouchableOpacity disabled={!picked.length} onPress={() => { setCover(picked[0]); setStep('cover'); }}><Text style={{ color: picked.length ? '#3B82F6' : c.muted, fontWeight: '700', fontSize: 16 }}>Next</Text></TouchableOpacity>
          </View>
          <FlatList data={myStories} numColumns={3} keyExtractor={(i) => i.id} ListEmptyComponent={<Text style={{ textAlign: 'center', color: c.muted, marginTop: 40 }}>No past stories found</Text>} renderItem={({ item }) => {
            const sel = picked.includes(item.mediaUrl);
            const thumb = item.mediaType === 'video' ? item.mediaUrl.replace(/\.[^/.]+$/, '.jpg') : item.mediaUrl;
            return (
              <TouchableOpacity style={s.tile} onPress={() => setPicked((p) => sel ? p.filter((x) => x !== item.mediaUrl) : [...p, item.mediaUrl])}>
                <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} />
                <View style={s.dBadge}><Text style={{ fontSize: 10, fontWeight: '700', color: '#111' }}>{fmtDate(item.createdAt)}</Text></View>
                <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={22} color={sel ? '#3B82F6' : '#fff'} style={s.chk} />
              </TouchableOpacity>
            );
          }} />
        </View>
      </Modal>

      <Modal visible={step === 'cover'} animationType="slide" onRequestClose={() => setStep('pick')}>
        <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 46, alignItems: 'center' }}>
          <View style={[s.hdr, { width: '100%' }]}>
            <TouchableOpacity onPress={() => setStep('pick')}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>New highlight</Text>
            <TouchableOpacity onPress={saveHighlight} style={s.okBtn}><Ionicons name="checkmark" size={20} color="#fff" /></TouchableOpacity>
          </View>
          <TouchableOpacity onPress={pickGalleryCover} style={{ marginTop: 90, alignItems: 'center' }}>
            <Image source={{ uri: cover || picked[0] }} style={s.bigCov} />
            <Text style={{ color: '#3B82F6', fontWeight: '700', marginTop: 10 }}>Edit cover</Text>
          </TouchableOpacity>
          <TextInput value={title} onChangeText={setTitle} placeholder="Highlight name" placeholderTextColor={c.muted} style={[s.tInp, { color: c.text }]} />
          {loading && <View style={s.loadBg}><View style={s.loadBox}><ActivityIndicator size="small" color="#111" /><Text style={{ marginLeft: 10, fontWeight: '600' }}>Loading...</Text></View></View>}
        </View>
      </Modal>

      {viewHL && (own ? (
        <HighlightViewerModal visible={!!viewHL} onClose={() => setViewHL(null)} highlight={viewHL} uid={uid} allHighlights={highlights} isOwn />
      ) : (
        <StoryViewerModal {...({ visible: !!viewHL, stories: (viewHL.stories || []).map((u: string, i: number) => ({ id: `${viewHL.id}_${i}`, uid: user?.id || uid, username: user?.username, userPhoto: user?.photoUrl, mediaUrl: u, mediaType: u.includes('.mp4') ? 'video' : 'image' })), initialIndex: 0, myUid: uid, me: user, c, onClose: () => setViewHL(null) } as any)} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  item: { alignItems: 'center', width: 70 },
  circle: { width: 66, height: 66, borderRadius: 33, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', padding: 2 },
  img: { width: '100%', height: '100%', borderRadius: 30 }, lbl: { fontSize: 11, marginTop: 4 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  tile: { width: W, height: W * 1.45, margin: 1 },
  dBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#fff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  chk: { position: 'absolute', top: 6, right: 6 },
  okBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center' },
  bigCov: { width: 96, height: 96, borderRadius: 48, borderWidth: 1, borderColor: '#E5E7EB' },
  tInp: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginTop: 18, minWidth: 180 },
  loadBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  loadBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 22, paddingVertical: 14, borderRadius: 12 },
});
