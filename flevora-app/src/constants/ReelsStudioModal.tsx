import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView, Image,
  StyleSheet, Alert, ActivityIndicator, Switch, FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { AudioModule, RecordingPresets, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import {
  DEFAULT_REELS_CAPABILITIES, deleteReelDraft, detectReelsCapabilities,
  loadReelDrafts, publishReelToFirestore, REEL_DURATIONS, REEL_FILTERS,
  REEL_PREVIEW_SPEEDS, ReelAudience, ReelCaptionLine, ReelDraft,
  ReelStickerLayer, ReelTextLayer, saveReelDraft, uploadFileWithProgress,
  validateReelVideoAsset,
} from './reelsSystem';

const STICKER_EMOJIS = ['🔥', '❤️', '😂', '✨', '🎵', '💯', '🇮🇳', '👏', '🤩', '⚡'];
const TEXT_COLORS = ['#FFFFFF', '#111827', '#D9FF36', '#EF4444', '#38BDF8', '#F59E0B'];

const emptyDraft = (): ReelDraft => ({
  id: `rd_${Date.now()}`,
  videoUri: '',
  coverUri: '',
  durationSec: 15,
  trimStart: 0,
  trimEnd: 15,
  speed: 1,
  filter: 'Original',
  textLayers: [],
  stickers: [],
  captionsList: [],
  voiceoverUri: '',
  videoVolume: 1,
  voiceVolume: 1,
  audioName: '',
  caption: '',
  location: '',
  audience: 'everyone',
  commentsDisabled: false,
  allowRepost: true,
  allowRemix: true,
  allowDownload: false,
  hideLikeCount: false,
  updatedAt: Date.now(),
});

export function ReelsStudioModal({
  visible, uid, me, allUsers, remixOf, onClose, onPublished,
}: {
  visible: boolean;
  uid: string;
  me: any;
  allUsers: any[];
  remixOf?: { postId: string; username: string } | null;
  onClose: () => void;
  onPublished?: (reelId: string) => void;
}) {
  const { c } = useTheme();
  const [step, setStep] = useState<'pick' | 'edit' | 'details' | 'done'>('pick');
  const [maxDuration, setMaxDuration] = useState<number>(30);
  const [draft, setDraft] = useState<ReelDraft>(emptyDraft);
  const [history, setHistory] = useState<ReelDraft[]>([]);
  const [drafts, setDrafts] = useState<ReelDraft[]>([]);
  const [draftsOpen, setDraftsOpen] = useState(false);
  const [caps, setCaps] = useState(DEFAULT_REELS_CAPABILITIES);
  const [editTab, setEditTab] = useState<'trim' | 'filter' | 'text' | 'sticker' | 'captions' | 'audio'>('trim');

  const [newTxt, setNewTxt] = useState('');
  const [txtColor, setTxtColor] = useState('#FFFFFF');
  const [newSub, setNewSub] = useState('');
  const [recordingVo, setRecordingVo] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const [publishedId, setPublishedId] = useState('');
  const cachedUrls = useRef<{ videoUrl?: string; coverUrl?: string; voiceUrl?: string }>({});
  const xhrRef = useRef<XMLHttpRequest | null>(null);

  const player = useVideoPlayer(draft.videoUri || null, (p) => { p.loop = true; });
  const voPlayer = useAudioPlayer(draft.voiceoverUri || null);
  const voRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  useEffect(() => {
    if (!visible) return;
    detectReelsCapabilities().then(setCaps);
    if (uid) loadReelDrafts(uid).then(setDrafts);
  }, [visible, uid]);

  useEffect(() => {
    player.playbackRate = draft.speed || 1;
    player.volume = draft.videoVolume ?? 1;
  }, [draft.speed, draft.videoVolume]);

  useEffect(() => {
    if (step === 'edit' && draft.videoUri) player.play();
    else player.pause();
  }, [step, draft.videoUri]);

  const updateDraft = (patch: Partial<ReelDraft>, recordUndo = true) => {
    setDraft((prev) => {
      if (recordUndo) setHistory((h) => [...h.slice(-10), prev]);
      return { ...prev, ...patch, updatedAt: Date.now() };
    });
  };

  const handleUndo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setDraft(prev);
  };

  const loadSelectedAsset = (a: ImagePicker.ImagePickerAsset) => {
    const err = validateReelVideoAsset(a);
    if (err) return Alert.alert('Video Limit / Format', err);
    const dur = Math.max(1, Math.round((a.duration || 15000) / 1000));
    cachedUrls.current = {};
    setDraft((prev) => ({
      ...prev,
      videoUri: a.uri,
      durationSec: dur,
      width: a.width,
      height: a.height,
      fileSize: a.fileSize,
      trimStart: 0,
      trimEnd: dur,
    }));
    setStep('edit');
  };

  const recordVideo = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera Permission', 'Please allow camera & microphone access in Settings.');
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], videoMaxDuration: maxDuration, quality: 0.75 });
    if (!res.canceled && res.assets[0]) loadSelectedAsset(res.assets[0]);
  };

  const pickGalleryVideo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Gallery Permission', 'Please allow photo/video library access in Settings.');
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 0.75 });
    if (!res.canceled && res.assets[0]) loadSelectedAsset(res.assets[0]);
  };

  const pickCoverImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [9, 16], quality: 0.8 });
    if (!res.canceled && res.assets[0]) updateDraft({ coverUri: res.assets[0].uri });
  };

  const toggleVoiceoverRec = async () => {
    try {
      if (!recordingVo) {
        const perm = await AudioModule.requestRecordingPermissionsAsync();
        if (!perm.granted) return Alert.alert('Microphone Permission', 'Please allow microphone access to record voiceover.');
        await voRecorder.prepareToRecordAsync();
        voRecorder.record();
        setRecordingVo(true);
      } else {
        await voRecorder.stop();
        setRecordingVo(false);
        if (voRecorder.uri) updateDraft({ voiceoverUri: voRecorder.uri });
      }
    } catch {
      setRecordingVo(false);
      Alert.alert('Voiceover Error', 'Could not record voiceover.');
    }
  };

  const handleSaveDraft = async () => {
    if (!uid) return Alert.alert('Sign In Required', 'Please sign in to save drafts.');
    await saveReelDraft(uid, draft);
    setDrafts(await loadReelDrafts(uid));
    Alert.alert('Draft Saved', 'Saved privately on this device. Clearing app data or switching devices removes local drafts.');
  };
    const handlePublish = async () => {
    if (busy || !uid || !draft.videoUri) return;
    setBusy(true);
    setProgress(0);
    try {
      if (!cachedUrls.current.videoUrl) {
        setStageText('Uploading Reel video...');
        cachedUrls.current.videoUrl = await uploadFileWithProgress(
          draft.videoUri, 'video', (p) => setProgress(Math.round(p * 0.7)), (x) => { xhrRef.current = x; }
        );
      }
      if (draft.coverUri && !cachedUrls.current.coverUrl) {
        setStageText('Uploading cover...');
        cachedUrls.current.coverUrl = await uploadFileWithProgress(
          draft.coverUri, 'image', (p) => setProgress(70 + Math.round(p * 0.15)), (x) => { xhrRef.current = x; }
        );
      }
      if (draft.voiceoverUri && !cachedUrls.current.voiceUrl) {
        setStageText('Uploading voiceover...');
        cachedUrls.current.voiceUrl = await uploadFileWithProgress(
          draft.voiceoverUri, 'raw', (p) => setProgress(85 + Math.round(p * 0.1)), (x) => { xhrRef.current = x; }
        );
      }
      setStageText('Publishing Reel...');
      setProgress(96);
      const reelId = await publishReelToFirestore({
        uid,
        userData: me || {},
        videoUrl: cachedUrls.current.videoUrl,
        coverUrl: cachedUrls.current.coverUrl || '',
        voiceoverUrl: cachedUrls.current.voiceUrl || '',
        draft,
        remixOf,
        allUsers,
      });
      await deleteReelDraft(uid, draft.id);
      setPublishedId(reelId);
      setProgress(100);
      setStep('done');
      onPublished?.(reelId);
    } catch (e: any) {
      if (e?.message !== 'Upload cancelled.') {
        Alert.alert('Publish Failed', e?.message || 'Upload failed. Retry uses already-uploaded media.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: handlePublish },
        ]);
      }
    } finally {
      setBusy(false);
      xhrRef.current = null;
    }
  };

  const activeFilter = useMemo(() => REEL_FILTERS.find((f) => f.name === draft.filter) || REEL_FILTERS[0], [draft.filter]);
  const atMatch = draft.caption.match(/@([a-zA-Z0-9._]*)$/);
  const mentionList = atMatch
    ? allUsers.filter((u) => u.id !== uid && (u.username || '').toLowerCase().includes(atMatch[1].toLowerCase())).slice(0, 5)
    : [];

  const confirmClose = () => {
    if (draft.videoUri && step !== 'done') {
      Alert.alert('Discard Reel?', 'Save as draft before closing or discard changes?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Save Draft', onPress: async () => { await handleSaveDraft(); onClose(); } },
        { text: 'Discard', style: 'destructive', onPress: () => { setDraft(emptyDraft()); setStep('pick'); onClose(); } },
      ]);
    } else {
      setDraft(emptyDraft());
      setStep('pick');
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={confirmClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={step === 'edit' ? () => setStep('pick') : step === 'details' ? () => setStep('edit') : confirmClose}>
            <Ionicons name={step === 'pick' || step === 'done' ? 'close' : 'arrow-back'} size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={[s.hdrTitle, { color: c.text }]}>
            {step === 'pick' ? 'Create Reel' : step === 'edit' ? 'Reel Editor' : step === 'details' ? 'New Reel' : 'Reel Published'}
          </Text>
          {step === 'edit' ? (
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              {history.length > 0 && <TouchableOpacity onPress={handleUndo}><Ionicons name="arrow-undo" size={20} color={c.text} /></TouchableOpacity>}
              <TouchableOpacity onPress={() => setStep('details')} style={[s.nextPill, { backgroundColor: BRAND }]}>
                <Text style={{ color: BRAND_TEXT, fontWeight: '800', fontSize: 13 }}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : drafts.length > 0 && step === 'pick' ? (
            <TouchableOpacity onPress={() => setDraftsOpen(true)}><Text style={{ color: BRAND, fontWeight: '800' }}>Drafts ({drafts.length})</Text></TouchableOpacity>
          ) : <View style={{ width: 24 }} />}
        </View>

        {step === 'pick' && (
          <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }}>
            {!!remixOf && (
              <View style={[s.card, { backgroundColor: c.input, borderColor: c.border }]}>
                <Text style={{ color: BRAND, fontWeight: '800' }}>Remixing @{remixOf.username}'s Reel</Text>
              </View>
            )}
            <Text style={{ color: c.muted, fontWeight: '700', fontSize: 12 }}>RECORDING DURATION</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {REEL_DURATIONS.map((d) => (
                <TouchableOpacity key={d} onPress={() => setMaxDuration(d)} style={[s.pill, { backgroundColor: maxDuration === d ? BRAND : c.input }]}>
                  <Text style={{ color: maxDuration === d ? BRAND_TEXT : c.text, fontWeight: '800' }}>{d}s</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={recordVideo} style={[s.bigBtn, { backgroundColor: BRAND }]}>
              <Ionicons name="videocam" size={24} color={BRAND_TEXT} />
              <Text style={{ color: BRAND_TEXT, fontWeight: '800', fontSize: 16 }}>Record Reel ({maxDuration}s)</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={pickGalleryVideo} style={[s.bigBtn, { backgroundColor: c.input, borderWidth: 1, borderColor: c.border }]}>
              <Ionicons name="images-outline" size={24} color={c.text} />
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>Import Video from Gallery</Text>
            </TouchableOpacity>
            <Text style={{ color: c.muted, fontSize: 12, lineHeight: 18 }}>
              Max file size: 25 MB (MP4). Uses native device camera & gallery picker for Expo SDK 58 compatibility.
            </Text>
          </ScrollView>
        )}

        {step === 'edit' && (
          <View style={{ flex: 1 }}>
            <View style={s.previewBox}>
              <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
              {activeFilter.opacity > 0 && <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: activeFilter.tint, opacity: activeFilter.opacity }]} />}
              {draft.textLayers.map((t) => (
                <TouchableOpacity key={t.id} onLongPress={() => updateDraft({ textLayers: draft.textLayers.filter((x) => x.id !== t.id) })} style={[s.overlayTxt, { top: `${t.yPct}%`, backgroundColor: t.bg }]}>
                  <Text style={{ color: t.color, fontSize: t.size, fontWeight: '800', textAlign: t.align }}>{t.text}</Text>
                </TouchableOpacity>
              ))}
              {draft.stickers.map((st) => (
                <TouchableOpacity key={st.id} onLongPress={() => updateDraft({ stickers: draft.stickers.filter((x) => x.id !== st.id) })} style={{ position: 'absolute', top: `${st.yPct}%`, left: `${st.xPct}%` }}>
                  <Text style={{ fontSize: st.size }}>{st.emoji}</Text>
                </TouchableOpacity>
              ))}
              {draft.captionsList[0] && (
                <View style={s.subBanner}><Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>{draft.captionsList[0].text}</Text></View>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[s.toolStrip, { borderTopColor: c.border, borderBottomColor: c.border }]} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
              {(['trim', 'filter', 'text', 'sticker', 'captions', 'audio'] as const).map((tb) => (
                <TouchableOpacity key={tb} onPress={() => setEditTab(tb)} style={[s.pill, { backgroundColor: editTab === tb ? BRAND : c.input }]}>
                  <Text style={{ color: editTab === tb ? BRAND_TEXT : c.text, fontWeight: '700', fontSize: 12, textTransform: 'capitalize' }}>{tb}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 10 }}>
              {editTab === 'trim' && (
                <View style={{ gap: 10 }}>
                  <Text style={{ color: c.text, fontWeight: '700' }}>Trim Preview: {draft.trimStart}s – {draft.trimEnd}s (Total {draft.durationSec}s)</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity onPress={() => updateDraft({ trimStart: Math.min(draft.trimEnd - 1, draft.trimStart + 1) })} style={[s.pill, { backgroundColor: c.input }]}><Text style={{ color: c.text }}>Start +1s</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => updateDraft({ trimEnd: Math.max(draft.trimStart + 1, draft.trimEnd - 1) })} style={[s.pill, { backgroundColor: c.input }]}><Text style={{ color: c.text }}>End -1s</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => updateDraft({ trimStart: 0, trimEnd: draft.durationSec })} style={[s.pill, { backgroundColor: c.input }]}><Text style={{ color: BRAND, fontWeight: '700' }}>Reset</Text></TouchableOpacity>
                  </View>
                  <Text style={{ color: c.text, fontWeight: '700', marginTop: 4 }}>Preview Speed</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {REEL_PREVIEW_SPEEDS.map((sp) => (
                      <TouchableOpacity key={sp} onPress={() => updateDraft({ speed: sp })} style={[s.pill, { backgroundColor: draft.speed === sp ? BRAND : c.input }]}>
                        <Text style={{ color: draft.speed === sp ? BRAND_TEXT : c.text, fontWeight: '700' }}>{sp}x</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={{ color: c.muted, fontSize: 11 }}>Trim & speed apply to Flevora playback; baked MP4 re-encoding requires FFmpeg/server transcoding.</Text>
                </View>
              )}

              {editTab === 'filter' && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {REEL_FILTERS.map((f) => (
                    <TouchableOpacity key={f.name} onPress={() => updateDraft({ filter: f.name })} style={[s.pill, { backgroundColor: draft.filter === f.name ? BRAND : c.input }]}>
                      <Text style={{ color: draft.filter === f.name ? BRAND_TEXT : c.text, fontWeight: '700' }}>{f.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {editTab === 'text' && (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput value={newTxt} onChangeText={setNewTxt} placeholder="Add overlay text..." placeholderTextColor={c.muted} style={[s.inp, { flex: 1, color: c.text, backgroundColor: c.input, borderColor: c.border }]} />
                    <TouchableOpacity onPress={() => {
                      if (!newTxt.trim()) return;
                      const layer: ReelTextLayer = { id: `t_${Date.now()}`, text: newTxt.trim(), color: txtColor, bg: 'rgba(0,0,0,0.55)', size: 18, align: 'center', xPct: 10, yPct: 35 + (draft.textLayers.length % 3) * 12, startSec: 0, endSec: draft.durationSec };
                      updateDraft({ textLayers: [...draft.textLayers, layer] });
                      setNewTxt('');
                    }} style={[s.nextPill, { backgroundColor: BRAND, justifyContent: 'center' }]}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Add</Text></TouchableOpacity>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {TEXT_COLORS.map((col) => <TouchableOpacity key={col} onPress={() => setTxtColor(col)} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: col, borderWidth: txtColor === col ? 2 : 0.5, borderColor: BRAND }} />)}
                  </View>
                  <Text style={{ color: c.muted, fontSize: 11 }}>Long-press any text on video to remove it.</Text>
                </View>
              )}

              {editTab === 'sticker' && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                  {STICKER_EMOJIS.map((em) => (
                    <TouchableOpacity key={em} onPress={() => {
                      const st: ReelStickerLayer = { id: `st_${Date.now()}`, emoji: em, size: 34, rotate: 0, xPct: 20 + (draft.stickers.length * 14) % 60, yPct: 25 + (draft.stickers.length * 10) % 45 };
                      updateDraft({ stickers: [...draft.stickers, st] });
                    }}><Text style={{ fontSize: 30 }}>{em}</Text></TouchableOpacity>
                  ))}
                </View>
              )}

              {editTab === 'captions' && (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput value={newSub} onChangeText={setNewSub} placeholder="Add manual subtitle..." placeholderTextColor={c.muted} style={[s.inp, { flex: 1, color: c.text, backgroundColor: c.input, borderColor: c.border }]} />
                    <TouchableOpacity onPress={() => {
                      if (!newSub.trim()) return;
                      const line: ReelCaptionLine = { id: `sub_${Date.now()}`, text: newSub.trim(), startSec: 0, endSec: draft.durationSec };
                      updateDraft({ captionsList: [...draft.captionsList, line] });
                      setNewSub('');
                    }} style={[s.nextPill, { backgroundColor: BRAND, justifyContent: 'center' }]}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Add</Text></TouchableOpacity>
                  </View>
                  {!caps.autoCaptionsProvider && <Text style={{ color: c.muted, fontSize: 11 }}>Auto speech-to-text requires a backend speech API (Blaze/provider not configured).</Text>}
                </View>
              )}

              {editTab === 'audio' && (
                <View style={{ gap: 10 }}>
                  <TextInput value={draft.audioName} onChangeText={(v) => updateDraft({ audioName: v }, false)} placeholder="Original / Licensed Audio Title (optional)" placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input, borderColor: c.border }]} />
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity onPress={toggleVoiceoverRec} style={[s.pill, { flex: 1, backgroundColor: recordingVo ? '#EF4444' : BRAND, alignItems: 'center' }]}>
                      <Text style={{ color: recordingVo ? '#fff' : BRAND_TEXT, fontWeight: '800' }}>{recordingVo ? 'Stop Voiceover' : 'Record Voiceover'}</Text>
                    </TouchableOpacity>
                    {!!draft.voiceoverUri && (
                      <>
                        <TouchableOpacity onPress={() => voPlayer.play()} style={[s.pill, { backgroundColor: c.input }]}><Text style={{ color: c.text, fontWeight: '700' }}>Play VO</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => updateDraft({ voiceoverUri: '' })} style={[s.pill, { backgroundColor: c.input }]}><Text style={{ color: '#EF4444', fontWeight: '700' }}>Delete</Text></TouchableOpacity>
                      </>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => updateDraft({ videoVolume: draft.videoVolume > 0 ? 0 : 1 })} style={[s.pill, { backgroundColor: c.input }]}>
                    <Text style={{ color: c.text, fontWeight: '700' }}>Original Video Audio: {draft.videoVolume > 0 ? 'On (100%)' : 'Muted (0%)'}</Text>
                  </TouchableOpacity>
                  {!caps.licensedMusicProvider && (
                    <Text style={{ color: c.muted, fontSize: 11 }}>Licensed commercial music catalogue is unavailable until a music licensing provider is configured.</Text>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        )}
                {step === 'details' && (
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <TouchableOpacity onPress={pickCoverImage} style={[s.coverThumb, { backgroundColor: c.input }]}>
                {draft.coverUri ? <Image source={{ uri: draft.coverUri }} style={s.coverThumb} /> : <Ionicons name="image-outline" size={26} color={BRAND} />}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '800' }}>Reel Cover</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>Tap to upload a custom 9:16 cover image or leave default video thumbnail.</Text>
              </View>
            </View>

            <TextInput value={draft.caption} onChangeText={(v) => updateDraft({ caption: v }, false)} placeholder="Write a caption, @mentions, #hashtags..." placeholderTextColor={c.muted} multiline maxLength={2200} style={[s.inp, { height: 96, textAlignVertical: 'top', color: c.text, backgroundColor: c.input, borderColor: c.border }]} />
            <Text style={{ color: c.muted, fontSize: 11, textAlign: 'right' }}>{draft.caption.length}/2200</Text>

            {mentionList.length > 0 && (
              <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
                {mentionList.map((u) => (
                  <TouchableOpacity key={u.id} style={{ paddingVertical: 8 }} onPress={() => updateDraft({ caption: draft.caption.replace(/@([a-zA-Z0-9._]*)$/, `@${u.username} `) }, false)}>
                    <Text style={{ color: c.text, fontWeight: '700' }}>@{u.username}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TextInput value={draft.location} onChangeText={(v) => updateDraft({ location: v }, false)} placeholder="Add location (optional)" placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input, borderColor: c.border }]} />

            <Text style={{ color: c.muted, fontWeight: '700', fontSize: 12 }}>AUDIENCE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['everyone', 'followers', 'closeFriends'] as ReelAudience[]).map((a) => (
                <TouchableOpacity key={a} onPress={() => updateDraft({ audience: a }, false)} style={[s.pill, { flex: 1, alignItems: 'center', backgroundColor: draft.audience === a ? BRAND : c.input }]}>
                  <Text style={{ color: draft.audience === a ? BRAND_TEXT : c.text, fontWeight: '700', fontSize: 12 }}>{a === 'closeFriends' ? 'Close Friends' : a === 'followers' ? 'Followers' : 'Everyone'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {[
              ['Disable Comments', draft.commentsDisabled, (v: boolean) => updateDraft({ commentsDisabled: v }, false)],
              ['Allow Reposting', draft.allowRepost, (v: boolean) => updateDraft({ allowRepost: v }, false)],
              ['Allow Remixing', draft.allowRemix, (v: boolean) => updateDraft({ allowRemix: v }, false)],
              ['Allow Downloads', draft.allowDownload, (v: boolean) => updateDraft({ allowDownload: v }, false)],
              ['Hide Like Count', draft.hideLikeCount, (v: boolean) => updateDraft({ hideLikeCount: v }, false)],
            ].map(([label, val, fn]: any) => (
              <View key={label} style={s.swRow}>
                <Text style={{ color: c.text, fontWeight: '600' }}>{label}</Text>
                <Switch value={val} onValueChange={fn} />
              </View>
            ))}

            {busy && (
              <View style={[s.card, { backgroundColor: c.input, borderColor: c.border, gap: 6 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ color: c.text, fontWeight: '700' }}>{stageText} {progress}%</Text>
                  <TouchableOpacity onPress={() => xhrRef.current?.abort()}><Text style={{ color: '#EF4444', fontWeight: '700' }}>Cancel</Text></TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 30 }}>
              <TouchableOpacity disabled={busy} onPress={handleSaveDraft} style={[s.bigBtn, { flex: 1, backgroundColor: c.input }]}>
                <Text style={{ color: c.text, fontWeight: '800' }}>Save Draft</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={busy} onPress={handlePublish} style={[s.bigBtn, { flex: 2, backgroundColor: BRAND }]}>
                {busy ? <ActivityIndicator color={BRAND_TEXT} /> : <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Publish Reel</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}

        {step === 'done' && (
          <View style={s.center}>
            <Ionicons name="checkmark-circle" size={68} color={BRAND} />
            <Text style={{ color: c.text, fontSize: 20, fontWeight: '800', marginTop: 12 }}>Reel Published!</Text>
            <Text style={{ color: c.muted, marginTop: 4 }}>ID: {publishedId.slice(0, 8)}...</Text>
            <TouchableOpacity onPress={() => { setDraft(emptyDraft()); setStep('pick'); onClose(); }} style={[s.nextPill, { backgroundColor: BRAND, marginTop: 20, paddingHorizontal: 22, paddingVertical: 12 }]}>
              <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Modal visible={draftsOpen} animationType="slide" onRequestClose={() => setDraftsOpen(false)}>
        <View style={[s.wrap, { backgroundColor: c.background }]}>
          <View style={[s.hdr, { borderBottomColor: c.border }]}>
            <TouchableOpacity onPress={() => setDraftsOpen(false)}><Ionicons name="close" size={24} color={c.text} /></TouchableOpacity>
            <Text style={[s.hdrTitle, { color: c.text }]}>Reel Drafts</Text>
            <View style={{ width: 24 }} />
          </View>
          <FlatList data={drafts} keyExtractor={(d) => d.id} contentContainerStyle={{ padding: 14 }} renderItem={({ item }) => (
            <View style={[s.card, { borderColor: c.border, flexDirection: 'row', alignItems: 'center', marginBottom: 10 }]}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => { setDraft(item); setDraftsOpen(false); setStep(item.videoUri ? 'edit' : 'pick'); }}>
                <Text style={{ color: c.text, fontWeight: '700' }}>{item.caption ? item.caption.slice(0, 40) : `Draft (${item.durationSec}s)`}</Text>
                <Text style={{ color: c.muted, fontSize: 11 }}>{new Date(item.updatedAt).toLocaleString()}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Delete Draft?', 'Remove this draft permanently?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: async () => { await deleteReelDraft(uid, item.id); setDrafts(await loadReelDrafts(uid)); } },
              ])}><Ionicons name="trash-outline" size={20} color="#EF4444" /></TouchableOpacity>
            </View>
          )} />
        </View>
      </Modal>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 46 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 0.5 },
  hdrTitle: { fontSize: 17, fontWeight: '800' },
  nextPill: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12 },
  pill: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10 },
  bigBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 15, borderRadius: 14 },
  previewBox: { height: 340, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  overlayTxt: { position: 'absolute', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  subBanner: { position: 'absolute', bottom: 14, backgroundColor: 'rgba(0,0,0,0.72)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  toolStrip: { maxHeight: 54, borderTopWidth: 0.5, borderBottomWidth: 0.5, paddingVertical: 8 },
  inp: { borderWidth: 1, borderRadius: 12, padding: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12 },
  coverThumb: { width: 70, height: 110, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  swRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
});
