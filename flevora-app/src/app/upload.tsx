import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ScrollView, Switch, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, addDoc, serverTimestamp, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, NEON } from '../constants/theme';
import { sendNotification } from '../constants/notify';

const CLOUD_NAME = 'faqfo0lu';
const UPLOAD_PRESET = 'flevora_upload';
const MAX_BYTES = 40 * 1024 * 1024;
const MODES = ['POST', 'REEL', 'STORY', 'LIVE'] as const;
const TEXT_COLORS = ['#FFFFFF', '#111111', '#EC4899', '#8B5CF6', '#F59E0B', '#10B981'];

export default function UploadScreen({ initialMode, onClose }: { initialMode?: 'POST' | 'REEL' | 'STORY' | 'LIVE'; onClose?: () => void }) {
  const router = useRouter();
  const { mode: paramMode } = useLocalSearchParams<{ mode?: string }>();
  const { c } = useTheme();
  const [mode, setMode] = useState<'POST' | 'REEL' | 'STORY' | 'LIVE'>(initialMode || (paramMode as any) || 'POST');
  const [assets, setAssets] = useState<{ uri: string; type: 'image' | 'video'; duration?: number }[]>([]);
  const [coverUri, setCoverUri] = useState('');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [altText, setAltText] = useState('');
  const [storyText, setStoryText] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [sticker, setSticker] = useState('');
  const [allowComments, setAllowComments] = useState(true);
  const [hideLikes, setHideLikes] = useState(false);
  const [audience, setAudience] = useState<'public' | 'followers' | 'closeFriends'>('public');
  const [liveTitle, setLiveTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => { if (initialMode) setMode(initialMode); }, [initialMode]);
  const closeAll = () => (onClose ? onClose() : router.back());

  const uploadOne = (uri: string, type: 'image' | 'video'): Promise<string> => new Promise((resolve, reject) => {
    const data = new FormData();
    data.append('file', { uri, type: type === 'video' ? 'video/mp4' : 'image/jpeg', name: `flev_${Date.now()}` } as any);
    data.append('upload_preset', UPLOAD_PRESET);
    const xhr = new XMLHttpRequest();
    xhrRef.current = xhr;
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${type}/upload`);
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)); };
    xhr.onload = () => {
      try { const j = JSON.parse(xhr.responseText); j.secure_url ? resolve(j.secure_url) : reject(new Error('Upload failed')); }
      catch { reject(new Error('Invalid response')); }
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onabort = () => reject(new Error('Cancelled'));
    xhr.send(data);
  });

  const pickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Gallery Permission', 'Please allow media library access to select photos/videos.');
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mode === 'REEL' ? ['videos'] : mode === 'POST' ? ['images'] : ['images', 'videos'],
      allowsMultipleSelection: mode === 'POST',
      selectionLimit: mode === 'POST' ? 5 : 1,
      allowsEditing: mode === 'REEL',
      quality: 0.75,
    });
    if (res.canceled) return;
    const valid = res.assets.filter((a) => !a.fileSize || a.fileSize <= MAX_BYTES);
    if (valid.length < res.assets.length) Alert.alert('File Too Large', 'Max file size is 40 MB.');
    setAssets(valid.map((a) => ({ uri: a.uri, type: a.type === 'video' ? 'video' : 'image', duration: a.duration ? Math.round(a.duration / 1000) : undefined })));
  };

  const openCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera Permission', 'Please allow camera access.');
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: mode === 'REEL' ? ['videos'] : ['images', 'videos'], allowsEditing: true, quality: 0.75 });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setAssets([{ uri: a.uri, type: a.type === 'video' ? 'video' : 'image' }]);
    }
  };

  const pickCover = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [9, 16], quality: 0.7 });
    if (!res.canceled && res.assets[0]) setCoverUri(res.assets[0].uri);
  };

  const notifyMentions = async (txt: string, fromUid: string, uname: string, postId: string, mediaUrl: string) => {
    const matches = txt.match(/@[a-zA-Z0-9_]+/g) || [];
    for (const m of matches.slice(0, 5)) {
      const target = m.slice(1).toLowerCase();
      const q = await getDocs(query(collection(db, 'users'), where('username', '==', target))).catch(() => null);
      q?.docs.forEach((d) => sendNotification({
        toUid: d.id, fromUid, fromUsername: uname, type: 'mention',
        message: `mentioned you: ${txt.slice(0, 50)}`, postId, mediaUrl,
      }));
    }
  };

  const handlePublish = async () => {
    const uid = auth.currentUser?.uid;
    if (!uid || uploading) return;
    if (mode === 'LIVE') {
      const cam = await ImagePicker.requestCameraPermissionsAsync();
      if (!cam.granted) return Alert.alert('Permissions Needed', 'Camera permission is required for Live setup.');
      return Alert.alert('Streaming Infrastructure Required', 'Real-time Live video/audio streaming server (Agora/LiveKit/Mux) abhi Spark free tier par connected nahi hai. Setup ready hai!');
    }
    if (!assets.length) return Alert.alert('Select Media', 'Pehle Gallery ya Camera se media select karo.');
    setUploading(true); setProgress(0);
    try {
      const urls: string[] = [];
      for (const a of assets) urls.push(await uploadOne(a.uri, a.type));
      const coverUrl = coverUri ? await uploadOne(coverUri, 'image') : '';
      const uSnap = await getDoc(doc(db, 'users', uid));
      const ud = uSnap.data() || {};
      const uname = ud.username || 'user';

      if (mode === 'STORY') {
        await addDoc(collection(db, 'stories'), {
          uid, username: uname, userPhoto: ud.photoUrl || ud.avatar || '', mediaUrl: urls[0], mediaType: assets[0].type,
          storyText: storyText.trim(), textColor, textAlign, sticker, location: location.trim(),
          closeFriendsOnly: audience === 'closeFriends', allowedUids: audience === 'closeFriends' ? (ud.closeFriends || []) : [],
          viewers: [], viewerNames: [], likes: [], comments: [], expiresAt: Date.now() + 86400000, createdAt: serverTimestamp(),
        });
      } else {
        const ref = await addDoc(collection(db, 'posts'), {
          uid, username: uname, avatar: ud.photoUrl || ud.avatar || '',
          mediaUrl: urls[0], mediaUrls: urls, coverUrl, mediaType: mode === 'REEL' ? 'video' : assets[0].type,
          duration: assets[0].duration || 0, caption: caption.trim(), location: location.trim(), altText: altText.trim(),
          commentsDisabled: !allowComments, hideLikes, audience, audioName: mode === 'REEL' ? `Original Audio - @${uname}` : '',
          likes: [], reposts: [], commentsCount: 0, views: 0, createdAt: serverTimestamp(),
        });
        notifyMentions(caption, uid, uname, ref.id, urls[0]);
      }
      setAssets([]); setCaption(''); setLocation(''); setStoryText(''); setCoverUri('');
      Alert.alert('Published!', `${mode} successfully shared.`);
      closeAll();
    } catch (e: any) {
      if (e?.message !== 'Cancelled') Alert.alert('Upload Failed', 'Weak connection or upload error.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Retry', onPress: handlePublish }]);
    } finally {
      setUploading(false); xhrRef.current = null;
    }
  };

  return (
    <View style={[s.wrap, { backgroundColor: c.background }]}>
      <View style={[s.top, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => { xhrRef.current?.abort(); closeAll(); }}><Ionicons name="close" size={28} color={c.text} /></TouchableOpacity>
        <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>{mode === 'LIVE' ? 'Go Live' : `New ${mode.charAt(0) + mode.slice(1).toLowerCase()}`}</Text>
        <TouchableOpacity onPress={handlePublish} disabled={uploading} style={[s.shareBtn, { opacity: uploading ? 0.6 : 1 }]}>
          {uploading ? <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>{progress}%</Text> : <Text style={{ color: '#fff', fontWeight: '700' }}>{mode === 'LIVE' ? 'Start Live' : 'Share'}</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={[s.preview, { backgroundColor: c.card, borderColor: c.border }]}>
          {assets.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, padding: 8 }}>
              {assets.map((a, i) => (
                <View key={i} style={s.thumbWrap}>
                  {a.type === 'image' ? <Image source={{ uri: a.uri }} style={s.thumb} /> : <View style={s.vidBox}><Ionicons name="videocam" size={34} color={BRAND} /><Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>{a.duration ? `${a.duration}s` : 'Video'}</Text></View>}
                  <TouchableOpacity onPress={() => setAssets((p) => p.filter((_, idx) => idx !== i))} style={s.rmBtn}><Ionicons name="close" size={14} color="#fff" /></TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          ) : (
            <View style={{ alignItems: 'center', gap: 8 }}>
              <Ionicons name={mode === 'LIVE' ? 'radio' : 'images-outline'} size={44} color={BRAND} />
              <Text style={{ color: c.muted }}>{mode === 'LIVE' ? 'Live Setup Preview (Streaming Server Needed)' : 'Select photo or video'}</Text>
            </View>
          )}
          {mode === 'STORY' && !!storyText && (
            <Text style={[s.storyOverlay, { color: textColor, textAlign }]}>{storyText}</Text>
          )}
        </View>

        {mode !== 'LIVE' && (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={pickGallery} style={[s.pickBtn, { backgroundColor: c.card, borderColor: c.border }]}><Ionicons name="images" size={20} color={BRAND} /><Text style={{ color: c.text, fontWeight: '700' }}>Gallery</Text></TouchableOpacity>
            <TouchableOpacity onPress={openCamera} style={[s.pickBtn, { backgroundColor: c.card, borderColor: c.border }]}><Ionicons name="camera" size={20} color={BRAND} /><Text style={{ color: c.text, fontWeight: '700' }}>Camera</Text></TouchableOpacity>
          </View>
        )}

        {mode === 'REEL' && (
          <TouchableOpacity onPress={pickCover} style={[s.rowBox, { backgroundColor: c.card, borderColor: c.border }]}>
            <Ionicons name="image-outline" size={20} color={BRAND} /><Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>{coverUri ? 'Cover Selected ✓' : 'Select Reel Cover Image'}</Text>
          </TouchableOpacity>
        )}

        {mode === 'STORY' ? (
          <>
            <TextInput value={storyText} onChangeText={setStoryText} placeholder="Add story text..." placeholderTextColor={c.muted} style={[s.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {TEXT_COLORS.map((col) => <TouchableOpacity key={col} onPress={() => setTextColor(col)} style={[s.cDot, { backgroundColor: col, borderWidth: textColor === col ? 2.5 : 1, borderColor: BRAND }]} />)}
              <TouchableOpacity onPress={() => setTextAlign((a) => (a === 'left' ? 'center' : a === 'center' ? 'right' : 'left'))} style={[s.chip, { borderColor: c.border }]}><Text style={{ color: c.text, fontSize: 12, fontWeight: '700' }}>Align: {textAlign}</Text></TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {['📍 Location', '@Mention', '#Hashtag'].map((st) => <TouchableOpacity key={st} onPress={() => setSticker(st)} style={[s.chip, { backgroundColor: sticker === st ? BRAND : c.card, borderColor: c.border }]}><Text style={{ color: sticker === st ? '#fff' : c.text, fontSize: 12, fontWeight: '700' }}>{st}</Text></TouchableOpacity>)}
            </View>
          </>
        ) : mode === 'LIVE' ? (
          <TextInput value={liveTitle} onChangeText={setLiveTitle} placeholder="Enter Live title..." placeholderTextColor={c.muted} style={[s.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]} />
        ) : (
          <>
            <TextInput value={caption} onChangeText={setCaption} placeholder="Write a caption, @mentions & #hashtags..." placeholderTextColor={c.muted} multiline style={[s.input, { color: c.text, backgroundColor: c.card, borderColor: c.border, minHeight: 75 }]} />
            <TextInput value={location} onChangeText={setLocation} placeholder="Add location..." placeholderTextColor={c.muted} style={[s.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]} />
            {mode === 'POST' && <TextInput value={altText} onChangeText={setAltText} placeholder="Alt text (accessibility)..." placeholderTextColor={c.muted} style={[s.input, { color: c.text, backgroundColor: c.card, borderColor: c.border }]} />}
            <View style={[s.rowBox, { backgroundColor: c.card, borderColor: c.border }]}><Text style={{ color: c.text, flex: 1, fontWeight: '600' }}>Allow Comments</Text><Switch value={allowComments} onValueChange={setAllowComments} /></View>
            <View style={[s.rowBox, { backgroundColor: c.card, borderColor: c.border }]}><Text style={{ color: c.text, flex: 1, fontWeight: '600' }}>Hide Like Count</Text><Switch value={hideLikes} onValueChange={setHideLikes} /></View>
          </>
        )}

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['public', 'followers', 'closeFriends'] as const).map((a) => (
            <TouchableOpacity key={a} onPress={() => setAudience(a)} style={[s.chip, { flex: 1, alignItems: 'center', backgroundColor: audience === a ? BRAND : c.card, borderColor: c.border }]}>
              <Text style={{ color: audience === a ? '#fff' : c.text, fontSize: 12, fontWeight: '700' }}>{a === 'closeFriends' ? 'Close Friends' : a === 'followers' ? 'Followers' : 'Public'}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
  shareBtn: { backgroundColor: BRAND, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, minWidth: 68, alignItems: 'center' },
  preview: { height: 210, borderRadius: 16, borderWidth: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  thumbWrap: { width: 170, height: 190, borderRadius: 12, overflow: 'hidden' },
  thumb: { width: '100%', height: '100%' },
  vidBox: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(139,92,246,0.12)', gap: 6 },
  rmBtn: { position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  storyOverlay: { position: 'absolute', left: 16, right: 16, fontSize: 20, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
  pickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 12, borderWidth: 1 },
  rowBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 14 },
  cDot: { width: 24, height: 24, borderRadius: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, borderWidth: 1 },
  modeBar: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, borderTopWidth: 1 },
  modePill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18 },
});
