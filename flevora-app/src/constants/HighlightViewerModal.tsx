import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, TextInput, StyleSheet, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config';
import { BRAND } from './theme';
import { ShareModal } from './ShareModal';
import { ShareQrModal } from './ProfileModals';

export function HighlightViewerModal({ visible, onClose, highlight, uid, allHighlights, isOwn }: any) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [say, setSay] = useState('');
  const [more, setMore] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newTitle, setNewTitle] = useState(highlight?.title || '');

  const items: string[] = highlight?.stories || [];
  const uri = items[idx] || highlight?.cover;
  if (!visible || !highlight) return null;

  const removeCurrent = async () => {
    const rest = items.filter((_, i) => i !== idx);
    const next = rest.length ? allHighlights.map((h: any) => h.id === highlight.id ? { ...h, stories: rest } : h) : allHighlights.filter((h: any) => h.id !== highlight.id);
    await updateDoc(doc(db, 'users', uid), { highlights: next });
    onClose();
  };

  const saveTitle = async () => {
    const next = allHighlights.map((h: any) => h.id === highlight.id ? { ...h, title: newTitle.trim() || h.title } : h);
    await updateDoc(doc(db, 'users', uid), { highlights: next });
    setEditOpen(false);
  };

  const archiveHL = async () => {
    const next = allHighlights.map((h: any) => h.id === highlight.id ? { ...h, archived: true } : h);
    await updateDoc(doc(db, 'users', uid), { highlights: next });
    Alert.alert('Archived', 'Highlight archived!');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.wrap}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        <View style={s.hdr}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Image source={{ uri: highlight.cover || uri }} style={s.av} />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{highlight.title}</Text>
          </View>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
        </View>

        <View style={{ flex: 1, flexDirection: 'row' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => idx > 0 && setIdx(idx - 1)} />
          <TouchableOpacity style={{ flex: 1 }} onPress={() => (idx < items.length - 1 ? setIdx(idx + 1) : onClose())} />
        </View>

        {isOwn && (
          <View style={{ paddingHorizontal: 14, paddingBottom: 24 }}>
            <TextInput value={say} onChangeText={setSay} onSubmitEditing={() => { Alert.alert('Note', say); setSay(''); }} placeholder="Say something..." placeholderTextColor="#D1D5DB" style={s.inp} />
            <View style={s.bar}>
              <TouchableOpacity style={s.btn} onPress={() => Alert.alert('Activity', `${items.length} stories in this highlight.`)}><Ionicons name="eye-outline" size={21} color="#fff" /><Text style={s.lbl}>Activity</Text></TouchableOpacity>
              <TouchableOpacity style={s.btn} onPress={() => setIdx((idx + 1) % Math.max(1, items.length))}><Ionicons name="albums-outline" size={21} color="#fff" /><Text style={s.lbl}>Browse</Text></TouchableOpacity>
              <TouchableOpacity style={s.btn} onPress={() => { onClose(); router.push('/upload'); }}><Ionicons name="play-circle-outline" size={21} color="#fff" /><Text style={s.lbl}>Create</Text></TouchableOpacity>
              <TouchableOpacity style={s.btn} onPress={() => setShareOpen(true)}><Ionicons name="share-social-outline" size={21} color="#fff" /><Text style={s.lbl}>Share to</Text></TouchableOpacity>
              <TouchableOpacity style={s.btn} onPress={() => setMore(true)}><Ionicons name="ellipsis-vertical" size={21} color="#fff" /><Text style={s.lbl}>More</Text></TouchableOpacity>
            </View>
          </View>
        )}

        <Modal visible={more} transparent animationType="slide" onRequestClose={() => setMore(false)}>
          <TouchableOpacity style={s.mBg} activeOpacity={1} onPress={() => setMore(false)}>
            <View style={s.sheet}><View style={s.handle} />
              <TouchableOpacity style={s.mRow} onPress={() => { setMore(false); removeCurrent(); }}><Text style={{ color: '#EF4444', fontSize: 15, fontWeight: '600' }}>Remove from highlight</Text></TouchableOpacity>
              <TouchableOpacity style={s.mRow} onPress={() => { setMore(false); setNewTitle(highlight.title); setEditOpen(true); }}><Text style={s.mTxt}>Edit highlight</Text></TouchableOpacity>
              <TouchableOpacity style={s.mRow} onPress={() => { setMore(false); setShareOpen(true); }}><Text style={s.mTxt}>Send to...</Text></TouchableOpacity>
              <TouchableOpacity style={s.mRow} onPress={() => { setMore(false); Share.share({ message: uri }); }}><Text style={s.mTxt}>Share</Text></TouchableOpacity>
              <TouchableOpacity style={s.mRow} onPress={() => { setMore(false); setQrOpen(true); }}><Text style={s.mTxt}>Show QR code</Text></TouchableOpacity>
              <TouchableOpacity style={s.mRow} onPress={() => { setMore(false); archiveHL(); }}><Text style={s.mTxt}>Archive highlight</Text></TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(false)}>
          <View style={s.cBg}><View style={s.eCard}>
            <Text style={{ fontWeight: '700', fontSize: 16, marginBottom: 10 }}>Edit highlight</Text>
            <TextInput value={newTitle} onChangeText={setNewTitle} style={s.eInp} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 12 }}>
              <TouchableOpacity onPress={() => setEditOpen(false)}><Text style={{ color: '#6B7280' }}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveTitle}><Text style={{ color: BRAND, fontWeight: '700' }}>Save</Text></TouchableOpacity>
            </View>
          </View></View>
        </Modal>

        <ShareModal visible={shareOpen} post={{ mediaUrl: uri, mediaType: 'image', caption: highlight.title }} onClose={() => setShareOpen(false)} />
        <ShareQrModal visible={qrOpen} onClose={() => setQrOpen(false)} uid={uid} username={highlight.title} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingHorizontal: 16, zIndex: 10 },
  av: { width: 34, height: 34, borderRadius: 17 },
  inp: { color: '#fff', fontSize: 15, marginBottom: 12 },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  btn: { alignItems: 'center', gap: 4 }, lbl: { color: '#fff', fontSize: 11, fontWeight: '600' },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: 28 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 12 },
  mRow: { paddingVertical: 13 }, mTxt: { fontSize: 15, color: '#111', fontWeight: '500' },
  cBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  eCard: { width: '80%', backgroundColor: '#fff', borderRadius: 16, padding: 18 },
  eInp: { backgroundColor: '#F3F4F6', borderRadius: 10, padding: 10, fontSize: 15 },
});
