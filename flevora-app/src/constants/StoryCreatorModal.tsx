import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, TextInput, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { BRAND } from './theme';

const FILTERS = [
  { name: 'Normal', tint: 'transparent' },
  { name: 'Vivid', tint: 'rgba(255,140,0,0.14)' },
  { name: 'B&W', tint: 'rgba(100,116,139,0.32)' },
  { name: 'Vintage', tint: 'rgba(180,130,70,0.22)' },
  { name: 'Warm', tint: 'rgba(249,115,22,0.18)' },
  { name: 'Cool', tint: 'rgba(59,130,246,0.18)' },
];

export function StoryCreatorModal({ visible, onClose, uid, user, me }: any) {
  const [media, setMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [fxIdx, setFxIdx] = useState(0);
  const [txt, setTxt] = useState('');
  const [askTxt, setAskTxt] = useState(false);
  const [busy, setBusy] = useState(false);

  const pick = async (cam: boolean) => {
    const res = cam ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 });
    if (!res.canceled && res.assets[0]) setMedia({ uri: res.assets[0].uri, type: res.assets[0].type === 'video' ? 'video' : 'image' });
  };

  const upload = (audience: 'Everyone' | 'Close Friends') => {
    const myUid = uid || auth.currentUser?.uid || '';
    if (!media || !myUid || busy) return;
    setBusy(true);
    const isVid = media.type === 'video';
    const data = new FormData();
    data.append('file', { uri: media.uri, type: isVid ? 'video/mp4' : 'image/jpeg', name: isVid ? `st_${Date.now()}.mp4` : `st_${Date.now()}.jpg` } as any);
    data.append('upload_preset', 'flevora_upload');
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/faqfo0lu/${isVid ? 'video' : 'image'}/upload`);
    xhr.onerror = () => { setBusy(false); Alert.alert('Upload Failed', 'Network error.'); };
    xhr.onload = async () => {
      try {
        const j = JSON.parse(xhr.responseText);
        if (!j.secure_url) throw new Error(j.error?.message || 'Cloudinary error');
        const u = user || me || {};
        await addDoc(collection(db, 'stories'), {
          uid: myUid, username: u.username || 'user', userPhoto: u.photoUrl || u.avatar || '',
          mediaUrl: j.secure_url, mediaType: isVid ? 'video' : 'image', textOverlay: txt.trim(),
          filter: FILTERS[fxIdx].name, audience, viewers: [], viewerNames: [], likes: [], comments: [], reactions: [], createdAt: serverTimestamp(),
        });
        setMedia(null); setTxt(''); setBusy(false); onClose();
        Alert.alert('Story Added', 'Aapki story lag gayi hai!');
      } catch (e: any) { setBusy(false); Alert.alert('Upload Failed', e?.message || 'Could not upload story.'); }
    };
    xhr.send(data);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.wrap}>
        <View style={s.top}>
          <TouchableOpacity onPress={() => { setMedia(null); onClose(); }}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Add to story</Text>
          <TouchableOpacity onPress={() => setAskTxt((p) => !p)} style={s.aaBtn}><Text style={{ color: '#fff', fontWeight: '700' }}>Aa</Text></TouchableOpacity>
        </View>

        {media ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            {media.type === 'video' ? (
              <View style={{ alignItems: 'center', gap: 10 }}><Ionicons name="videocam" size={64} color="#fff" /><Text style={{ color: '#fff', fontWeight: '600' }}>Video selected</Text></View>
            ) : (
              <Image source={{ uri: media.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: FILTERS[fxIdx].tint }]} pointerEvents="none" />
            {!!txt && <Text style={s.overlay}>{txt}</Text>}
            {askTxt && <TextInput value={txt} onChangeText={setTxt} placeholder="Type text..." placeholderTextColor="#ccc" style={s.txtInp} />}
            {busy && <View style={s.loader}><ActivityIndicator size="large" color="#fff" /><Text style={{ color: '#fff', marginTop: 10, fontWeight: '700' }}>Uploading story...</Text></View>}
          </View>
        ) : (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity style={s.pickBtn} onPress={() => pick(true)}><Ionicons name="camera" size={24} color="#fff" /><Text style={s.pTxt}>Camera</Text></TouchableOpacity>
            <TouchableOpacity style={[s.pickBtn, { backgroundColor: '#1F2937' }]} onPress={() => pick(false)}><Ionicons name="images" size={24} color="#fff" /><Text style={s.pTxt}>Gallery</Text></TouchableOpacity>
          </View>
        )}

        {media && (
          <View style={{ paddingBottom: 24 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 8, marginBottom: 12 }}>
              {FILTERS.map((f, i) => (
                <TouchableOpacity key={f.name} onPress={() => setFxIdx(i)} style={[s.fChip, fxIdx === i && { borderColor: BRAND }]}>
                  <Text style={{ color: '#fff', fontSize: 12 }}>{f.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', paddingHorizontal: 14, gap: 10 }}>
              <TouchableOpacity style={s.audBtn} disabled={busy} onPress={() => upload('Everyone')}><Ionicons name="person-circle-outline" size={20} color="#fff" /><Text style={s.pTxt}>{busy ? 'Uploading...' : 'Your story'}</Text></TouchableOpacity>
              <TouchableOpacity style={s.audBtn} disabled={busy} onPress={() => upload('Close Friends')}><Ionicons name="star" size={18} color="#10B981" /><Text style={s.pTxt}>Close Friends</Text></TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingHorizontal: 16, zIndex: 10 },
  aaBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  overlay: { color: '#fff', fontSize: 22, fontWeight: '800', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 10 },
  txtInp: { position: 'absolute', bottom: 30, width: '80%', backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', borderRadius: 12, padding: 12 },
  loader: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  pickBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: BRAND, paddingHorizontal: 26, paddingVertical: 14, borderRadius: 24 },
  pTxt: { color: '#fff', fontWeight: '700' },
  fChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.5)', borderWidth: 1.5, borderColor: 'transparent' },
  audBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1F2937', paddingVertical: 12, borderRadius: 22 },
});
