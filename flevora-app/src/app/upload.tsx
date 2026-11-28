import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from '../constants/theme';

const CLOUD_NAME = 'faqfo0lu';
const UPLOAD_PRESET = 'flevora_upload';
const MAX_BYTES = 25 * 1024 * 1024;

export default function UploadScreen() {
  const router = useRouter();
  const { remixOfId, remixOfUser } = useLocalSearchParams<{ remixOfId?: string; remixOfUser?: string }>();
  const { c } = useTheme();
  const [assets, setAssets] = useState<{ uri: string; type: 'image' | 'video' }[]>([]);
  const [caption, setCaption] = useState('');
  const [tags, setTags] = useState('');
  const [location, setLocation] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const validateAndSet = (picked: ImagePicker.ImagePickerAsset[]) => {
    const valid = picked.filter((a) => !a.fileSize || a.fileSize <= MAX_BYTES);
    if (valid.length < picked.length) Alert.alert('File Too Large', 'Each photo/video must be under 25 MB.');
    setAssets(valid.map((a) => ({ uri: a.uri, type: a.type === 'video' ? 'video' : 'image' })));
  };

  const pickGallery = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: 5, quality: 0.7 });
    if (!res.canceled) validateAndSet(res.assets);
  };

  const pickAndCrop = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!res.canceled && res.assets[0]) validateAndSet([res.assets[0]]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Needed', 'Please allow camera access.');
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], allowsEditing: true, quality: 0.7 });
    if (!res.canceled && res.assets[0]) validateAndSet([res.assets[0]]);
  };

  const uploadFile = (uri: string, type: 'image' | 'video'): Promise<string> =>
    new Promise((resolve, reject) => {
      const data = new FormData();
      data.append('file', { uri, type: type === 'video' ? 'video/mp4' : 'image/jpeg', name: `flevora_${Date.now()}.${type === 'video' ? 'mp4' : 'jpg'}` } as any);
      data.append('upload_preset', UPLOAD_PRESET);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${type}/upload`);
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        const json = JSON.parse(xhr.responseText);
        if (json.secure_url) resolve(json.secure_url);
        else reject(new Error('Upload failed'));
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(data);
    });

  const handlePublish = async () => {
    if (uploading) return;
    if (!assets.length) return Alert.alert('No Media', 'Please select a photo or video first.');
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    setUploading(true);
    setProgress(0);
    try {
      const urls = await Promise.all(assets.map((a) => uploadFile(a.uri, a.type)));
      const userSnap = await getDoc(doc(db, 'users', uid));
      const userData = userSnap.exists() ? userSnap.data() : {};
      const hashtags = (caption.match(/#\w+/g) || []).map((h) => h.toLowerCase());
      const taggedUsers = tags.split(/[\s,]+/).map((t) => t.replace(/^@/, '').toLowerCase()).filter(Boolean);
      const isVideo = assets[0].type === 'video';

      await addDoc(collection(db, 'posts'), {
        uid, username: userData.username || 'user', userAvatar: userData.avatar || '',
        mediaUrl: urls[0], media: urls, mediaType: isVideo ? 'video' : 'image',
        caption: caption.trim(), hashtags, taggedUsers, location: location.trim(),
        ...(remixOfId ? { remixOf: { postId: remixOfId, username: remixOfUser || '' } } : {}),
        likes: [], views: 0, createdAt: serverTimestamp(),
      });
      setAssets([]); setCaption(''); setTags(''); setLocation('');
      Alert.alert('Published', 'Your post is live!');
      router.replace('/' as any);
    } catch {
      Alert.alert('Upload Failed', 'Network error. Try again?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Retry', onPress: handlePublish }]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]}>
      <Text style={[styles.title, { color: c.text }]}>{remixOfId ? 'Remix Reel' : 'New Post'}</Text>
      {!!remixOfId && (
        <View style={[styles.remixBanner, { backgroundColor: c.input, borderColor: c.border }]}>
          <Ionicons name="git-branch-outline" size={18} color={BRAND} />
          <Text style={{ color: c.text, fontWeight: '700' }}>Remixing @{remixOfUser || 'creator'}'s Reel</Text>
        </View>
      )}
      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.pickBtn, { backgroundColor: c.input, borderColor: c.border }]} onPress={pickGallery}>
          <Ionicons name="images-outline" size={20} color={BRAND} /><Text style={[styles.pickText, { color: c.text }]}>Gallery</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pickBtn, { backgroundColor: c.input, borderColor: c.border }]} onPress={pickAndCrop}>
          <Ionicons name="crop-outline" size={20} color={BRAND} /><Text style={[styles.pickText, { color: c.text }]}>Crop</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pickBtn, { backgroundColor: c.input, borderColor: c.border }]} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={20} color={BRAND} /><Text style={[styles.pickText, { color: c.text }]}>Camera</Text>
        </TouchableOpacity>
      </View>
      {assets.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }}>
          {assets.map((a, i) => <Image key={i} source={{ uri: a.uri }} style={styles.preview} />)}
        </ScrollView>
      )}
      <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text, height: 90 }]} placeholder="Write a caption and #hashtags..." placeholderTextColor={c.muted} multiline value={caption} onChangeText={setCaption} />
      <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Tag users (e.g. @alex @sam)" placeholderTextColor={c.muted} value={tags} onChangeText={setTags} />
      <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Add location (optional)" placeholderTextColor={c.muted} value={location} onChangeText={setLocation} />
      <TouchableOpacity style={styles.pubBtn} onPress={handlePublish} disabled={uploading}>
        {uploading ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator color={BRAND_TEXT} /><Text style={styles.pubText}>Uploading {progress}%</Text></View> : <Text style={styles.pubText}>Publish Post</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 52 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  remixBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 12 },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, borderWidth: 1 },
  pickText: { fontWeight: '600', fontSize: 13 },
  preview: { width: 140, height: 140, borderRadius: 12, marginRight: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12, textAlignVertical: 'top' },
  pubBtn: { backgroundColor: BRAND, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 8, marginBottom: 40 },
  pubText: { color: BRAND_TEXT, fontWeight: '700', fontSize: 16 },
});
