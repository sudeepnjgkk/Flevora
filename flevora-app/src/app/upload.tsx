import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet, ScrollView,
  ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { collection, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from '../constants/theme';
import { useLang } from '../constants/i18n';
import {
  DEFAULT_POST_CAPABILITIES, deletePostDraft, detectPostCapabilities,
  loadPostDrafts, MediaSlide, POST_MAX_CAROUSEL, PostDraft, postT,
  publishPostToFirestore, savePostDraft, uploadPostMediaToCloudinary, validatePostAsset,
} from '../constants/postCreationSystem';
import {
  AdvancedSettingsModal, PhotoVideoEditorModal, PostPreviewModal, TagAndCollabModal,
} from '../constants/PostEditorModals';
import { ReelsStudioModal } from '../constants/ReelsStudioModal';

export default function UploadScreen({ initialMode, onClose }: { initialMode?: string; onClose?: () => void }) {
  const router = useRouter();
  const { remixOfId, remixOfUser } = useLocalSearchParams<{ remixOfId?: string; remixOfUser?: string }>();
  const { c } = useTheme();
  const { lang } = useLang();
  const L = postT(lang);
  const uid = auth.currentUser?.uid || '';

  const [me, setMe] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [caps, setCaps] = useState(DEFAULT_POST_CAPABILITIES);
  const [reelStudioOpen, setReelStudioOpen] = useState(initialMode === 'REEL' || !!remixOfId);
  const [draftId, setDraftId] = useState(`draft_${Date.now()}`);
  const [drafts, setDrafts] = useState<PostDraft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);

  const [slides, setSlides] = useState<MediaSlide[]>([]);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [caption, setCaption] = useState('');
  const [location, setLocation] = useState('');
  const [taggedUids, setTaggedUids] = useState<string[]>([]);
  const [collabUids, setCollabUids] = useState<string[]>([]);
  const [audience, setAudience] = useState<'everyone' | 'followers' | 'closeFriends'>('everyone');
  const [hideLikes, setHideLikes] = useState(false);
  const [hideViews, setHideViews] = useState(false);
  const [commentsOff, setCommentsOff] = useState(false);
  const [allowReshare, setAllowReshare] = useState(true);

  const [editorOpen, setEditorOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const [status, setStatus] = useState<'idle' | 'uploading' | 'publishing' | 'published' | 'failed'>('idle');
  const [progress, setProgress] = useState(0);
  const [publishedId, setPublishedId] = useState('');

  useEffect(() => {
    if (initialMode === 'REEL' || !!remixOfId) setReelStudioOpen(true);
  }, [initialMode, remixOfId]);

  useEffect(() => {
    detectPostCapabilities().then(setCaps);
    if (!uid) return;
    loadPostDrafts(uid).then(setDrafts);
    const u1 = onSnapshot(doc(db, 'users', uid), (s) => { if (s.exists()) setMe({ id: s.id, ...s.data() }); });
    const u2 = onSnapshot(collection(db, 'users'), (s) => setAllUsers(s.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
    return () => { u1(); u2(); };
  }, [uid]);

  useEffect(() => {
    if (!uid || (!slides.length && !caption.trim())) return;
    const t = setTimeout(() => {
      savePostDraft(uid, {
        id: draftId, slides, aspectRatio, caption, location, taggedUids,
        collaboratorUids: collabUids, audience, hideLikeCount: hideLikes,
        hideViewCount: hideViews, commentsDisabled: commentsOff, allowReshare, updatedAt: Date.now(),
      }).then(() => loadPostDrafts(uid).then(setDrafts));
    }, 900);
    return () => clearTimeout(t);
  }, [uid, draftId, slides, aspectRatio, caption, location, taggedUids, collabUids, audience, hideLikes, hideViews, commentsOff, allowReshare]);

  const appendAssets = (picked: ImagePicker.ImagePickerAsset[]) => {
    const next: MediaSlide[] = [];
    for (const a of picked) {
      const err = validatePostAsset(a);
      if (err) Alert.alert('Skipped Media', err);
      else next.push({ id: `sl_${Date.now()}_${Math.random()}`, uri: a.uri, type: a.type === 'video' ? 'video' : 'image', filter: 'Original', rotate: 0, flip: false, muted: false, altText: '' });
    }
    setSlides((prev) => [...prev, ...next].slice(0, POST_MAX_CAROUSEL));
  };

  const pickGallery = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Needed', 'Please allow gallery access in Settings.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, selectionLimit: POST_MAX_CAROUSEL, quality: 0.75 });
    if (!res.canceled) appendAssets(res.assets);
  };

  const pickAndCrop = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!res.canceled && res.assets[0]) appendAssets([res.assets[0]]);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission Needed', 'Please allow camera access.');
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], allowsEditing: true, quality: 0.75 });
    if (!res.canceled && res.assets[0]) appendAssets([res.assets[0]]);
  };

  const atMatch = caption.match(/@([a-zA-Z0-9_]*)$/);
  const mentionList = atMatch
    ? allUsers.filter((u) => u.id !== uid && (u.username || '').toLowerCase().includes(atMatch[1].toLowerCase())).slice(0, 5)
    : [];
    const handlePublish = async () => {
    if (status === 'uploading' || status === 'publishing') return;
    if (!slides.length) return Alert.alert('No Media', 'Please select at least 1 photo or video.');
    if (!uid) return Alert.alert('Sign In Required', 'Please sign in to publish.');
    setStatus('uploading');
    setProgress(0);
    try {
      const urls: string[] = [];
      const updatedSlides = [...slides];
      for (let i = 0; i < updatedSlides.length; i++) {
        const sl = updatedSlides[i];
        if (sl.uploadedUrl) {
          urls.push(sl.uploadedUrl);
        } else {
          const u = await uploadPostMediaToCloudinary(sl.uri, sl.type, (p) => setProgress(Math.round(((i + p / 100) / updatedSlides.length) * 100)));
          updatedSlides[i] = { ...sl, uploadedUrl: u };
          setSlides([...updatedSlides]);
          urls.push(u);
        }
      }
      setStatus('publishing');
      const userSnap = await getDoc(doc(db, 'users', uid));
      const userData = userSnap.exists() ? userSnap.data() : (me || {});
      const postId = await publishPostToFirestore({
        uid, userData, slides: updatedSlides, uploadedUrls: urls, aspectRatio, caption, location,
        taggedUids, collaboratorUids: collabUids, audience, hideLikeCount: hideLikes,
        hideViewCount: hideViews, commentsDisabled: commentsOff, allowReshare,
        remixOf: remixOfId ? { postId: remixOfId, username: remixOfUser || '' } : null,
        allUsers,
      });
      await deletePostDraft(uid, draftId);
      setDrafts(await loadPostDrafts(uid));
      setPublishedId(postId);
      setStatus('published');
    } catch (e: any) {
      setStatus('failed');
      Alert.alert('Upload Failed', e?.message || 'Network error. Already uploaded slides are cached.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: handlePublish },
      ]);
    }
  };

  const resetForm = () => {
    setSlides([]); setCaption(''); setLocation(''); setTaggedUids([]); setCollabUids([]);
    setDraftId(`draft_${Date.now()}`); setStatus('idle'); setPublishedId('');
  };

  if (status === 'published') {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Ionicons name="checkmark-circle" size={68} color={BRAND} />
        <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', marginTop: 12 }}>{L.publishedTitle}</Text>
        <Text style={{ color: c.muted, marginTop: 4 }}>Post ID: {publishedId.slice(0, 8)}...</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
          <TouchableOpacity onPress={() => { resetForm(); onClose ? onClose() : router.replace('/' as any); }} style={[styles.chipBtn, { backgroundColor: BRAND }]}>
            <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>View Feed</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { resetForm(); onClose ? onClose() : router.replace('/profile' as any); }} style={[styles.chipBtn, { backgroundColor: c.input }]}>
            <Text style={{ color: c.text, fontWeight: '800' }}>Profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {!!onClose && <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color={c.text} /></TouchableOpacity>}
          <Text style={[styles.title, { color: c.text, marginBottom: 0 }]}>{L.newPost}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity onPress={() => setReelStudioOpen(true)} style={[styles.draftPill, { backgroundColor: BRAND }]}>
            <Text style={{ color: BRAND_TEXT, fontWeight: '800', fontSize: 12 }}>Reel Studio</Text>
          </TouchableOpacity>
          {drafts.length > 0 && (
            <TouchableOpacity onPress={() => setDraftsOpen(true)} style={[styles.draftPill, { backgroundColor: c.input }]}>
              <Text style={{ color: BRAND, fontWeight: '800', fontSize: 12 }}>{L.drafts} ({drafts.length})</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.btnRow}>
        <TouchableOpacity style={[styles.pickBtn, { backgroundColor: c.input, borderColor: c.border }]} onPress={pickGallery}>
          <Ionicons name="images-outline" size={20} color={BRAND} /><Text style={[styles.pickText, { color: c.text }]}>{L.gallery}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pickBtn, { backgroundColor: c.input, borderColor: c.border }]} onPress={pickAndCrop}>
          <Ionicons name="crop-outline" size={20} color={BRAND} /><Text style={[styles.pickText, { color: c.text }]}>{L.crop}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pickBtn, { backgroundColor: c.input, borderColor: c.border }]} onPress={takePhoto}>
          <Ionicons name="camera-outline" size={20} color={BRAND} /><Text style={[styles.pickText, { color: c.text }]}>{L.camera}</Text>
        </TouchableOpacity>
      </View>

      {slides.length > 0 && (
        <View style={{ marginVertical: 10 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {slides.map((sl, i) => (
              <TouchableOpacity key={sl.id} onPress={() => setEditorOpen(true)} style={{ marginRight: 10 }}>
                <Image source={{ uri: sl.uri }} style={styles.preview} />
                <View style={styles.slideBadge}><Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{i + 1}</Text></View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity onPress={() => setEditorOpen(true)} style={[styles.rowOpt, { borderColor: c.border }]}>
            <Ionicons name="color-wand-outline" size={18} color={BRAND} /><Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>{L.editMedia} ({slides.length}/{POST_MAX_CAROUSEL})</Text><Ionicons name="chevron-forward" size={16} color={c.muted} />
          </TouchableOpacity>
        </View>
      )}

      <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text, height: 90 }]} placeholder="Write a caption, @mentions, and #hashtags..." placeholderTextColor={c.muted} multiline maxLength={2200} value={caption} onChangeText={setCaption} />
      {mentionList.length > 0 && (
        <View style={[styles.mBox, { backgroundColor: c.card, borderColor: c.border }]}>
          {mentionList.map((u) => (
            <TouchableOpacity key={u.id} style={{ padding: 10 }} onPress={() => setCaption((p) => p.replace(/@([a-zA-Z0-9_]*)$/, `@${u.username} `))}>
              <Text style={{ color: c.text, fontWeight: '700' }}>@{u.username}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Add location (optional)" placeholderTextColor={c.muted} value={location} onChangeText={setLocation} />

      <TouchableOpacity style={[styles.rowOpt, { borderColor: c.border }]} onPress={() => setTagOpen(true)}>
        <Ionicons name="person-add-outline" size={18} color={c.text} /><Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{L.tagPeople} ({taggedUids.length + collabUids.length})</Text><Ionicons name="chevron-forward" size={16} color={c.muted} />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.rowOpt, { borderColor: c.border }]} onPress={() => Alert.alert('Music', caps.musicProvider ? 'Ready' : L.musicUnavailable)}>
        <Ionicons name="musical-notes-outline" size={18} color={c.muted} /><Text style={{ color: c.muted, fontWeight: '600', flex: 1 }}>Add Music (Unavailable)</Text>
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
        {(['everyone', 'followers', 'closeFriends'] as const).map((a) => (
          <TouchableOpacity key={a} onPress={() => setAudience(a)} style={[styles.audChip, { backgroundColor: audience === a ? BRAND : c.input }]}>
            <Text style={{ color: audience === a ? BRAND_TEXT : c.text, fontWeight: '700', fontSize: 12 }}>{a === 'closeFriends' ? 'Close Friends' : a === 'followers' ? 'Followers' : 'Everyone'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={[styles.rowOpt, { borderColor: c.border }]} onPress={() => setAdvOpen(true)}>
        <Ionicons name="settings-outline" size={18} color={c.text} /><Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{L.advanced}</Text><Ionicons name="chevron-forward" size={16} color={c.muted} />
      </TouchableOpacity>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 12, marginBottom: 44 }}>
        <TouchableOpacity style={[styles.pubBtn, { flex: 1, backgroundColor: c.input, marginTop: 0, marginBottom: 0 }]} onPress={() => setPreviewOpen(true)}>
          <Text style={{ color: c.text, fontWeight: '700' }}>{L.preview}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.pubBtn, { flex: 2, marginTop: 0, marginBottom: 0 }]} onPress={handlePublish} disabled={status === 'uploading' || status === 'publishing'}>
          {status === 'uploading' || status === 'publishing' ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator color={BRAND_TEXT} /><Text style={styles.pubText}>{status === 'publishing' ? 'Publishing...' : `${progress}%`}</Text></View>
          ) : <Text style={styles.pubText}>{L.publish}</Text>}
        </TouchableOpacity>
      </View>

      <PhotoVideoEditorModal visible={editorOpen} slides={slides} setSlides={setSlides} aspectRatio={aspectRatio} setAspectRatio={setAspectRatio} onClose={() => setEditorOpen(false)} />
      <TagAndCollabModal visible={tagOpen} users={allUsers} myUid={uid} taggedUids={taggedUids} setTaggedUids={setTaggedUids} collabUids={collabUids} setCollabUids={setCollabUids} onClose={() => setTagOpen(false)} />
      <AdvancedSettingsModal visible={advOpen} slides={slides} setSlides={setSlides} hideLikes={hideLikes} setHideLikes={setHideLikes} hideViews={hideViews} setHideViews={setHideViews} commentsOff={commentsOff} setCommentsOff={setCommentsOff} allowReshare={allowReshare} setAllowReshare={setAllowReshare} onClose={() => setAdvOpen(false)} />
      <PostPreviewModal visible={previewOpen} user={me} slides={slides} caption={caption} location={location} audience={audience} collabCount={collabUids.length} onClose={() => setPreviewOpen(false)} onPublish={handlePublish} />
      <ReelsStudioModal
        visible={reelStudioOpen}
        uid={uid}
        me={me}
        allUsers={allUsers}
        remixOf={remixOfId ? { postId: remixOfId, username: remixOfUser || '' } : null}
        onClose={() => { setReelStudioOpen(false); if (initialMode === 'REEL' && onClose) onClose(); }}
        onPublished={() => { if (onClose) onClose(); }}
      />

      <Modal visible={draftsOpen} animationType="slide" onRequestClose={() => setDraftsOpen(false)}>
        <View style={[styles.container, { backgroundColor: c.background }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={[styles.title, { color: c.text }]}>{L.drafts}</Text>
            <TouchableOpacity onPress={() => setDraftsOpen(false)}><Ionicons name="close" size={26} color={c.text} /></TouchableOpacity>
          </View>
          <FlatList data={drafts} keyExtractor={(d) => d.id} renderItem={({ item }) => (
            <View style={[styles.rowOpt, { borderColor: c.border }]}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => { setDraftId(item.id); setSlides(item.slides || []); setAspectRatio(item.aspectRatio || '1:1'); setCaption(item.caption || ''); setLocation(item.location || ''); setTaggedUids(item.taggedUids || []); setCollabUids(item.collaboratorUids || []); setAudience(item.audience || 'everyone'); setDraftsOpen(false); }}>
                <Text style={{ color: c.text, fontWeight: '700' }}>{item.caption ? item.caption.slice(0, 36) : `${item.slides?.length || 0} media slide(s)`}</Text>
                <Text style={{ color: c.muted, fontSize: 11 }}>{new Date(item.updatedAt).toLocaleString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => { await deletePostDraft(uid, item.id); setDrafts(await loadPostDrafts(uid)); }}><Ionicons name="trash-outline" size={20} color="#EF4444" /></TouchableOpacity>
            </View>
          )} />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 52 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  draftPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  btnRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pickBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 12, borderRadius: 12, borderWidth: 1 },
  pickText: { fontWeight: '600', fontSize: 13 },
  preview: { width: 120, height: 120, borderRadius: 12 },
  slideBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.65)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 10, textAlignVertical: 'top' },
  mBox: { borderWidth: 1, borderRadius: 12, marginBottom: 10 },
  rowOpt: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 0.5 },
  audChip: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  chipBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  pubBtn: { backgroundColor: BRAND, padding: 15, borderRadius: 12, alignItems: 'center' },
  pubText: { color: BRAND_TEXT, fontWeight: '800', fontSize: 15 },
});
              
