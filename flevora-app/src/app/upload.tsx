import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND } from '../constants/theme';

const CLOUD_NAME = 'faqfo0lu';
const UPLOAD_PRESET = 'flevora_upload';
const MODES = ['POST', 'STORY', 'REEL', 'LIVE'] as const;
const FILTERS = ['Normal', 'Warm', 'Cool', 'Vivid', 'B&W', 'Fade', 'Dramatic'];

export default function UploadScreen({ initialMode, onClose }: { initialMode?: 'POST' | 'STORY' | 'REEL' | 'LIVE'; onClose?: () => void }) {
  const router = useRouter();
  const { mode: paramMode } = useLocalSearchParams<{ mode?: string }>();
  const { c } = useTheme();
  const [mode, setMode] = useState<'POST' | 'STORY' | 'REEL' | 'LIVE'>(initialMode || (paramMode as any) || 'POST');
  const [asset, setAsset] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [filter, setFilter] = useState('Normal');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [cfOnly, setCfOnly] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  const closeAll = () => (onClose ? onClose() : router.back());

  const handleClose = () => {
    if (!asset && !caption.trim()) return closeAll();
    Alert.alert('Discard changes?', undefined, [
      { text: 'Keep editing', style: 'cancel' },
      { text: 'Start over', onPress: () => { setAsset(null); setCaption(''); setLocation(''); } },
      { text: 'Discard', style: 'destructive', onPress: closeAll },
    ]);
  };

  const pickGallery = async () => {
    const mediaTypes: any = mode === 'REEL' ? ['videos'] : ['images', 'videos'];
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes, quality: 0.75 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setAsset({ uri: a.uri, type: a.type === 'video' ? 'video' : 'image' });
    }
  };

  const openCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Needed', 'Please allow camera access.');
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: mode === 'REEL' ? ['videos'] : ['images', 'videos'], quality: 0.75 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setAsset({ uri: a.uri, type: a.type === 'video' ? 'video' : 'image' });
    }
  };

  const handlePublish = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (mode === 'LIVE') return Alert.alert('Live Streaming', 'Live video streaming server key ke bina free plan par available nahi hai. Reel ya Story post kar sakte ho!');
    if (!asset) return Alert.alert('Select Media', 'Pehle gallery ya camera se photo/video select karo.');
    setUploading(true);
    try {
      const data = new FormData();
      data.append('file', { uri: asset.uri, type: asset.type === 'video' ? 'video/mp4' : 'image/jpeg', name: `flev_${Date.now()}` } as any);
      data.append('upload_preset', UPLOAD_PRESET);
      const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${asset.type}/upload`, { method: 'POST', body: data });
      const json = await res.json();
      if (!json.secure_url) throw new Error('Upload failed');

      const uSnap = await getDoc(doc(db, 'users', uid));
      const ud = uSnap.data() || {};
      if (mode === 'STORY') {
        await addDoc(collection(db, 'stories'), {
          uid, username: ud.username || 'user', mediaUrl: json.secure_url, mediaType: asset.type,
          closeFriendsOnly: cfOnly, allowedUids: cfOnly ? (ud.closeFriends || []) : [],
          viewers: [], viewerNames: [], likes: [], replies: {}, expiresAt: Date.now() + 86400000, createdAt: serverTimestamp(),
        });
      } else {
        await addDoc(collection(db, 'posts'), {
          uid, username: ud.username || 'user', avatar: ud.photoUrl || ud.avatar || '',
          mediaUrl: json.secure_url, mediaType: mode === 'REEL' ? 'video' : asset.type,
          caption: caption.trim(), location: location.trim(), filter, likes: [], reposts: [], commentsCount: 0, views: 0,
          createdAt: serverTimestamp(),
        });
      }
      setAsset(null); setCaption(''); setLocation('');
      closeAll();
    } catch {
      Alert.alert('Error', 'Upload failed, please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={[s.wrap, { backgroundColor: c.background }]}>
      <View style={[s.top, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={handleClose} hitSlop={10}><Ionicons name="close" size={28} color={c.text} /></TouchableOpacity>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>New {mode.charAt(0) + mode.slice(1).toLowerCase()}</Text>
        <TouchableOpacity onPress={handlePublish} disabled={uploading} style={[s.shareBtn, { opacity: uploading ? 0.5 : 1 }]}>
          {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Share</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={[s.preview, { backgroundColor: c.card, borderColor: c.border }]}>
          {asset ? (
            asset.type === 'image' ? <Image source={{ uri: asset.uri }} style={s.media} resizeMode="cover" /> : (
              <View style={{ alignItems: 'center', gap: 8 }}><Ionicons name="videocam" size={48} color={BRAND} /><Text style={{ color: c.text, fontWeight: '700' }}>Video Selected ({filter})</Text></View>
            )
          ) : (
            <View style={{ alignItems: 'center', gap: 10 }}>
              <Ionicons name={mode === 'LIVE' ? 'radio' : 'images-outline'} size={48} color={BRAND} />
              <Text style={{ color: c.muted }}>{mode === 'LIVE' ? 'Ready to go Live' : 'Choose photo or video'}</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity onPress={pickGallery} style={[s.pickBtn, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="images" size={20} color={BRAND} /><Text style={{ color: c.text, fontWeight: '700' }}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openCamera} style={[s.pickBtn, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="camera" size={20} color={BRAND} /><Text style={{ color: c.text, fontWeight: '700' }}>Camera</Text>
          </TouchableOpacity>
        </View>

        {mode !== 'LIVE' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {FILTERS.map((f) => (
              <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[s.chip, { backgroundColor: filter === f ? BRAND : c.card, borderColor: c.border }]}>
                <Text style={{ color: filter === f ? '#fff' : c.text, fontWeight: '600', fontSize: 13 }}>{f}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {mode === 'STORY' ? (
          <TouchableOpacity onPress={() => setCfOnly((v) => !v)} style={[s.cfRow, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="star" size={20} color={cfOnly ? '#10B981' : c.muted} />
            <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>Close Friends Only</Text>
            <Ionicons name={cfOnly ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={cfOnly ? '#10B981' : c.muted} />
          </TouchableOpacity>
        ) : (
          <>
            <TextInput value={caption} onChangeText={setCaption} placeholder="Write a caption & #hashtags..." placeholderTextColor={c.muted} multiline style={[s.input, { color: c.text, backgroundColor: c.card, borderColor: c.border, minHeight: 80 }]} />
            <TextInput value={location} onChangeText={setLocation} placeholder="Add location..." placeholderTextColor={c.muted} style={[s.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]} />
          </>
        )}
      </ScrollView>

      <View style={[s.modeBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
        {MODES.map((m) => (
          <TouchableOpacity key={m} onPress={() => setMode(m)} style={[s.modePill, mode === m && { backgroundColor: BRAND }]}>
            <Text style={{ color: mode === m ? '#fff' : c.muted, fontWeight: '800', fontSize: 12 }}>{m}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1 },
  shareBtn: { backgroundColor: BRAND, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  preview: { height: 250, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  media: { width: '100%', height: '100%' },
  pickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, borderRadius: 12, borderWidth: 1 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  cfRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  modeBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, paddingHorizontal: 10, borderTopWidth: 1 },
  modePill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18 },
});
