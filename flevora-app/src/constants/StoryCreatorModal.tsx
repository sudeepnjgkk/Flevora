import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, Image, TextInput, ScrollView,
  ActivityIndicator, StyleSheet, Alert, PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import { addDoc, collection, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { useLang } from './i18n';
import {
  DEFAULT_STORIES_CAPABILITIES, detectStoriesCapabilities, deleteStoryDraft,
  loadStoryDrafts, saveStoryDraft, STORY_TTL_MS, StoryDraft, storyT,
  uploadStoryMediaToCloudinary, validateStoryAsset,
} from './storiesCapabilities';
import { StickerPickerModal, StoryStickerItem } from './StoryStickers';

const FILTERS = [
  { name: 'Normal', tint: 'transparent' },
  { name: 'Vivid', tint: 'rgba(255,140,0,0.14)' },
  { name: 'B&W', tint: 'rgba(100,116,139,0.32)' },
  { name: 'Vintage', tint: 'rgba(180,130,70,0.22)' },
  { name: 'Warm', tint: 'rgba(249,115,22,0.18)' },
  { name: 'Cool', tint: 'rgba(59,130,246,0.18)' },
];
const BG_COLORS = ['#111827', '#1E3A8A', '#7C3AED', '#BE185D', '#065F46', '#B45309'];
const PALETTE = ['#FFFFFF', '#D9FF36', '#EF4444', '#3B82F6', '#EC4899', '#10B981', '#000000'];

export function StoryCreatorModal({ visible, onClose, uid, user, me, initialAddYoursPrompt }: any) {
  const { lang } = useLang();
  const L = storyT(lang);
  const myUid = uid || auth.currentUser?.uid || '';

  const [mode, setMode] = useState<'pick' | 'media' | 'text'>('pick');
  const [items, setItems] = useState<{ uri: string; type: 'image' | 'video' }[]>([]);
  const [activeMediaIdx, setActiveMediaIdx] = useState(0);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const [fxIdx, setFxIdx] = useState(0);
  const [videoMuted, setVideoMuted] = useState(false);

  const [bgIdx, setBgIdx] = useState(0);
  const [textStoryVal, setTextStoryVal] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textSize, setTextSize] = useState(24);

  const [textItems, setTextItems] = useState<{ id: string; text: string; color: string; bg: string; size: number; y: number }[]>([]);
  const [askTxt, setAskTxt] = useState(false);
  const [draftTxt, setDraftTxt] = useState('');

  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [drawColor, setDrawColor] = useState('#D9FF36');
  const [strokes, setStrokes] = useState<{ color: string; size: number; opacity: number; pts: { x: number; y: number }[] }[]>([]);
  const [undoneStrokes, setUndoneStrokes] = useState<any[]>([]);

  const [stickers, setStickers] = useState<StoryStickerItem[]>([]);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [caps, setCaps] = useState(DEFAULT_STORIES_CAPABILITIES);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<StoryDraft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);

  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [lastAudience, setLastAudience] = useState<'Everyone' | 'Close Friends'>('Everyone');
  const [uploadError, setUploadError] = useState('');

  const curItem = items[activeMediaIdx] || items[0];
  const previewPlayer = useVideoPlayer(curItem?.type === 'video' ? curItem.uri : '', (p) => {
    p.loop = true;
    p.muted = videoMuted;
    if (curItem?.type === 'video') p.play();
  });

  useEffect(() => {
    previewPlayer.muted = videoMuted;
  }, [videoMuted, previewPlayer]);

  useEffect(() => {
    if (!visible) return;
    detectStoriesCapabilities().then(setCaps);
    loadStoryDrafts(myUid).then(setDrafts);
    if (initialAddYoursPrompt) {
      setStickers([{ id: `st_${Date.now()}`, type: 'addYours', x: 40, y: 180, data: { prompt: initialAddYoursPrompt, participants: [myUid] } }]);
    }
    return onSnapshot(collection(db, 'users'), (sn) => setAllUsers(sn.docs.map((d) => ({ id: d.id, ...d.data() }))), () => {});
  }, [visible, myUid, initialAddYoursPrompt]);

  const drawRef = useRef({ drawMode, drawTool, drawColor });
  drawRef.current = { drawMode, drawTool, drawColor };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => drawRef.current.drawMode,
      onPanResponderGrant: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const { drawTool: t, drawColor: col } = drawRef.current;
        if (t === 'eraser') {
          setStrokes((prev) => prev.slice(0, -1));
          return;
        }
        setUndoneStrokes([]);
        setStrokes((prev) => [...prev, { color: col, size: t === 'highlighter' ? 16 : 6, opacity: t === 'highlighter' ? 0.45 : 1, pts: [{ x: locationX, y: locationY }] }]);
      },
      onPanResponderMove: (e) => {
        if (drawRef.current.drawTool === 'eraser') return;
        const { locationX, locationY } = e.nativeEvent;
        setStrokes((prev) => {
          if (!prev.length) return prev;
          const copy = [...prev];
          const last = { ...copy[copy.length - 1] };
          last.pts = [...last.pts, { x: locationX, y: locationY }];
          copy[copy.length - 1] = last;
          return copy;
        });
      },
    })
  ).current;

  const resetAll = () => {
    setMode('pick'); setItems([]); setTextItems([]); setStickers([]); setStrokes([]);
    setTextStoryVal(''); setDraftTxt(''); setAskTxt(false); setDrawMode(false); setUploadError(''); setPct(0);
  };

  const handlePick = async (cam: boolean, multi = false) => {
    try {
      if (cam) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return Alert.alert('Permission Denied', 'Camera access is required.');
        const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], allowsEditing: true, quality: 0.8 });
        if (!res.canceled && res.assets[0]) {
          const err = validateStoryAsset(res.assets[0]);
          if (err) return Alert.alert('Invalid Media', err);
          setItems([{ uri: res.assets[0].uri, type: res.assets[0].type === 'video' ? 'video' : 'image' }]);
          setActiveMediaIdx(0); setMode('media');
        }
      } else {
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images', 'videos'], allowsMultipleSelection: multi, selectionLimit: multi ? 5 : 1,
          allowsEditing: !multi, quality: 0.8,
        });
        if (!res.canceled && res.assets.length) {
          const valid: { uri: string; type: 'image' | 'video' }[] = [];
          for (const a of res.assets) {
            const err = validateStoryAsset(a);
            if (err) Alert.alert('Skipped Media', err);
            else valid.push({ uri: a.uri, type: a.type === 'video' ? 'video' : 'image' });
          }
          if (valid.length) { setItems(valid); setActiveMediaIdx(0); setMode('media'); }
        }
      }
    } catch {
      Alert.alert('Error', 'Could not open media picker.');
    }
  };
    const handleCloseConfirm = () => {
    if (mode === 'pick') { resetAll(); onClose(); return; }
    Alert.alert(L.discardTitle, L.discardMsg, [
      { text: L.cancel, style: 'cancel' },
      {
        text: L.saveDraft,
        onPress: async () => {
          await saveStoryDraft(myUid, {
            id: `draft_${Date.now()}`, mode: mode === 'text' ? 'text' : items.length > 1 ? 'multi' : 'media',
            items, textItems, stickers, bgColor: BG_COLORS[bgIdx], textStoryValue: textStoryVal, updatedAt: Date.now(),
          });
          resetAll(); onClose();
        },
      },
      { text: L.discard, style: 'destructive', onPress: () => { resetAll(); onClose(); } },
    ]);
  };

  const publish = async (audience: 'Everyone' | 'Close Friends') => {
    if (!myUid || busy) return;
    setLastAudience(audience);
    setBusy(true); setUploadError(''); setPct(0);
    try {
      const u = user || me || {};
      const cfOnly = audience === 'Close Friends';
      const allowedUids = cfOnly ? (Array.isArray(u.closeFriends) ? u.closeFriends : []) : [];
      const mentionIds = stickers.filter((st) => st.type === 'mention').map((st) => st.data.uid);

      const uploadList = mode === 'text' ? [{ uri: '', type: 'text' as const }] : items;
      for (let i = 0; i < uploadList.length; i++) {
        const it = uploadList[i];
        let mediaUrl = '';
        if (it.type !== 'text') {
          mediaUrl = await uploadStoryMediaToCloudinary(it.uri, it.type, (p) => setPct(Math.round(((i + p / 100) / uploadList.length) * 100)));
        }
        const docRef = await addDoc(collection(db, 'stories'), {
          uid: myUid, username: u.username || 'user', userPhoto: u.photoUrl || u.avatar || '',
          mediaUrl, mediaType: it.type,
          bgColor: mode === 'text' ? BG_COLORS[bgIdx] : '',
          textStory: mode === 'text' ? textStoryVal.trim() : '',
          textOverlay: textItems[0]?.text || '',
          textItems, stickers, filter: FILTERS[fxIdx].name,
          audience, closeFriendsOnly: cfOnly, allowedUids,
          mentions: mentionIds, viewers: [], viewerNames: [], likes: [], comments: [], reactions: [],
          expiresAt: Date.now() + STORY_TTL_MS, createdAtMs: Date.now(), createdAt: serverTimestamp(),
        });
        for (const tid of mentionIds) {
          if (tid && tid !== myUid) {
            await addDoc(collection(db, 'notifications'), {
              toUid: tid, fromUid: myUid, fromUsername: u.username || 'user',
              type: 'mention', storyId: docRef.id, message: 'mentioned you in their story.',
              read: false, createdAt: serverTimestamp(),
            }).catch(() => {});
          }
        }
      }
      resetAll(); setBusy(false); onClose();
      Alert.alert('Published', 'Your story is live!');
    } catch (e: any) {
      setBusy(false);
      setUploadError(e?.message || 'Upload failed.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleCloseConfirm}>
      <View style={s.wrap}>
        <View style={s.top}>
          <TouchableOpacity onPress={handleCloseConfirm}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{L.addStory}</Text>
          {mode !== 'pick' ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => setAskTxt((p) => !p)} style={s.toolBtn}><Text style={{ color: '#fff', fontWeight: '800' }}>Aa</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setDrawMode((d) => !d)} style={[s.toolBtn, drawMode && { backgroundColor: BRAND }]}>
                <Ionicons name="brush" size={18} color={drawMode ? BRAND_TEXT : '#fff'} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setStickerOpen(true)} style={s.toolBtn}><Ionicons name="happy-outline" size={20} color="#fff" /></TouchableOpacity>
            </View>
          ) : <View style={{ width: 34 }} />}
        </View>

        {mode === 'pick' ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14, padding: 20 }}>
            <TouchableOpacity style={s.pickBtn} onPress={() => handlePick(true)}><Ionicons name="camera" size={22} color={BRAND_TEXT} /><Text style={s.pTxtDark}>{L.camera}</Text></TouchableOpacity>
            <TouchableOpacity style={s.pickBtnDark} onPress={() => handlePick(false, false)}><Ionicons name="image" size={22} color="#fff" /><Text style={s.pTxt}>{L.gallery}</Text></TouchableOpacity>
            <TouchableOpacity style={s.pickBtnDark} onPress={() => handlePick(false, true)}><Ionicons name="albums" size={22} color="#fff" /><Text style={s.pTxt}>{L.multiMedia}</Text></TouchableOpacity>
            <TouchableOpacity style={s.pickBtnDark} onPress={() => setMode('text')}><Ionicons name="text" size={22} color="#fff" /><Text style={s.pTxt}>{L.textStory}</Text></TouchableOpacity>
            {drafts.length > 0 && (
              <TouchableOpacity style={[s.pickBtnDark, { borderWidth: 1, borderColor: BRAND }]} onPress={() => setShowDrafts((v) => !v)}>
                <Ionicons name="document-text-outline" size={20} color={BRAND} /><Text style={{ color: BRAND, fontWeight: '700' }}>{L.drafts} ({drafts.length})</Text>
              </TouchableOpacity>
            )}
            {showDrafts && (
              <ScrollView style={{ maxHeight: 180, width: '100%' }}>
                {drafts.map((d) => (
                  <View key={d.id} style={s.draftRow}>
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => {
                      setItems(d.items || []); setTextItems(d.textItems || []); setStickers(d.stickers || []);
                      setTextStoryVal(d.textStoryValue || ''); setMode(d.mode === 'text' ? 'text' : 'media'); setShowDrafts(false);
                    }}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>{d.mode.toUpperCase()} Draft • {new Date(d.updatedAt).toLocaleTimeString()}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => { await deleteStoryDraft(myUid, d.id); setDrafts(await loadStoryDrafts(myUid)); }}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        ) : (
          <View style={{ flex: 1, backgroundColor: mode === 'text' ? BG_COLORS[bgIdx] : '#000', justifyContent: 'center', alignItems: 'center' }} {...panResponder.panHandlers}>
            {mode === 'media' && curItem?.type === 'video' && (
              <VideoView player={previewPlayer} style={StyleSheet.absoluteFill} contentFit={fitMode} nativeControls={false} surfaceType="textureView" />
            )}
            {mode === 'media' && curItem?.type === 'image' && (
              <Image source={{ uri: curItem.uri }} style={StyleSheet.absoluteFill} resizeMode={fitMode} />
            )}
            <View style={[StyleSheet.absoluteFill, { backgroundColor: FILTERS[fxIdx].tint }]} pointerEvents="none" />

            {strokes.map((st, idx) => st.pts.map((pt, j) => (
              <View key={`${idx}_${j}`} pointerEvents="none" style={{ position: 'absolute', left: pt.x - st.size / 2, top: pt.y - st.size / 2, width: st.size, height: st.size, borderRadius: st.size / 2, backgroundColor: st.color, opacity: st.opacity }} />
            )))}

            {mode === 'text' && (
              <TextInput
                value={textStoryVal}
                onChangeText={setTextStoryVal}
                placeholder="Type your story..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                multiline
                style={{ color: textColor, fontSize: textSize, fontWeight: '800', textAlign: 'center', paddingHorizontal: 24, width: '90%' }}
              />
            )}

            {textItems.map((ti) => (
              <TouchableOpacity key={ti.id} onLongPress={() => setTextItems((p) => p.filter((x) => x.id !== ti.id))} style={[s.overlayBox, { top: ti.y, backgroundColor: ti.bg }]}>
                <Text style={{ color: ti.color, fontSize: ti.size, fontWeight: '800' }}>{ti.text}</Text>
              </TouchableOpacity>
            ))}

            {stickers.map((st) => (
              <TouchableOpacity key={st.id} onLongPress={() => setStickers((p) => p.filter((x) => x.id !== st.id))} style={[s.stBadge, { top: st.y, left: st.x }]}>
                <Text style={{ color: '#111', fontWeight: '800', fontSize: 13 }}>{st.type.toUpperCase()}: {st.data.username || st.data.tag || st.data.place || st.data.question || st.data.prompt || st.data.title || st.data.label}</Text>
              </TouchableOpacity>
            ))}

            {askTxt && (
              <View style={s.txtBar}>
                <TextInput value={draftTxt} onChangeText={setDraftTxt} placeholder="Add text overlay..." placeholderTextColor="#ccc" style={s.txtInp} />
                <TouchableOpacity onPress={() => { if (draftTxt.trim()) setTextItems((p) => [...p, { id: `t_${Date.now()}`, text: draftTxt.trim(), color: textColor, bg: 'rgba(0,0,0,0.55)', size: 22, y: 140 + p.length * 46 }]); setDraftTxt(''); setAskTxt(false); }} style={s.addTxtBtn}>
                  <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Done</Text>
                </TouchableOpacity>
              </View>
            )}

            {busy && (
              <View style={s.loader}>
                <ActivityIndicator size="large" color={BRAND} />
                <Text style={{ color: '#fff', marginTop: 10, fontWeight: '700' }}>{L.uploading} {pct}%</Text>
              </View>
            )}
            {!!uploadError && (
              <View style={s.loader}>
                <Text style={{ color: '#EF4444', fontWeight: '800', marginBottom: 10 }}>{uploadError}</Text>
                <TouchableOpacity onPress={() => publish(lastAudience)} style={[s.pickBtn, { paddingVertical: 10 }]}>
                  <Text style={s.pTxtDark}>{L.retry}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {mode !== 'pick' && (
          <View style={s.bottomPanel}>
            {drawMode ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginBottom: 10 }}>
                {(['pen', 'highlighter', 'eraser'] as const).map((t) => (
                  <TouchableOpacity key={t} onPress={() => setDrawTool(t)} style={[s.fChip, drawTool === t && { borderColor: BRAND }]}>
                    <Text style={{ color: '#fff', fontSize: 12, textTransform: 'capitalize' }}>{t}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => { if (strokes.length) { setUndoneStrokes((u) => [...u, strokes[strokes.length - 1]]); setStrokes((p) => p.slice(0, -1)); } }}><Ionicons name="arrow-undo" size={20} color="#fff" /></TouchableOpacity>
                <TouchableOpacity onPress={() => { if (undoneStrokes.length) { setStrokes((p) => [...p, undoneStrokes[undoneStrokes.length - 1]]); setUndoneStrokes((u) => u.slice(0, -1)); } }}><Ionicons name="arrow-redo" size={20} color="#fff" /></TouchableOpacity>
              </View>
            ) : mode === 'text' ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, marginBottom: 10 }}>
                {BG_COLORS.map((col, idx) => (
                  <TouchableOpacity key={col} onPress={() => setBgIdx(idx)} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: col, borderWidth: bgIdx === idx ? 2 : 0, borderColor: BRAND }} />
                ))}
                {PALETTE.map((col) => (
                  <TouchableOpacity key={col} onPress={() => setTextColor(col)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: col, borderWidth: textColor === col ? 2 : 1, borderColor: '#fff' }} />
                ))}
              </ScrollView>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, marginBottom: 10 }}>
                <TouchableOpacity onPress={() => setFitMode((f) => (f === 'cover' ? 'contain' : 'cover'))} style={s.fChip}><Text style={{ color: '#fff', fontSize: 12 }}>Fit: {fitMode}</Text></TouchableOpacity>
                {curItem?.type === 'video' && (
                  <TouchableOpacity onPress={() => setVideoMuted((m) => !m)} style={s.fChip}><Text style={{ color: '#fff', fontSize: 12 }}>{videoMuted ? 'Muted' : 'Sound On'}</Text></TouchableOpacity>
                )}
                {items.map((it, i) => (
                  <TouchableOpacity key={i} onPress={() => setActiveMediaIdx(i)} onLongPress={() => { if (items.length > 1) setItems((p) => p.filter((_, idx) => idx !== i)); }} style={[s.fChip, activeMediaIdx === i && { borderColor: BRAND }]}>
                    <Text style={{ color: '#fff', fontSize: 12 }}>#{i + 1}</Text>
                  </TouchableOpacity>
                ))}
                {FILTERS.map((f, i) => (
                  <TouchableOpacity key={f.name} onPress={() => setFxIdx(i)} style={[s.fChip, fxIdx === i && { borderColor: BRAND }]}><Text style={{ color: '#fff', fontSize: 12 }}>{f.name}</Text></TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={{ flexDirection: 'row', paddingHorizontal: 14, gap: 10 }}>
              <TouchableOpacity style={s.audBtn} disabled={busy} onPress={() => publish('Everyone')}><Ionicons name="person-circle-outline" size={20} color="#fff" /><Text style={s.pTxt}>{L.everyone}</Text></TouchableOpacity>
              <TouchableOpacity style={s.audBtn} disabled={busy} onPress={() => publish('Close Friends')}><Ionicons name="star" size={18} color="#10B981" /><Text style={s.pTxt}>{L.closeFriends}</Text></TouchableOpacity>
            </View>
          </View>
        )}

        <StickerPickerModal visible={stickerOpen} capabilities={caps} allUsers={allUsers} myUid={myUid} onSelect={(st) => setStickers((p) => [...p, st])} onClose={() => setStickerOpen(false)} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingHorizontal: 16, paddingBottom: 10, zIndex: 20 },
  toolBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  pickBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: BRAND, width: 220, paddingVertical: 14, borderRadius: 24 },
  pickBtnDark: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1F2937', width: 220, paddingVertical: 14, borderRadius: 24 },
  pTxt: { color: '#fff', fontWeight: '700' },
  pTxtDark: { color: BRAND_TEXT, fontWeight: '800' },
  draftRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1F2937', padding: 12, borderRadius: 12, marginBottom: 8 },
  overlayBox: { position: 'absolute', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  stBadge: { position: 'absolute', backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  txtBar: { position: 'absolute', bottom: 20, width: '90%', flexDirection: 'row', gap: 8, alignItems: 'center' },
  txtInp: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', color: '#fff', borderRadius: 12, padding: 12 },
  addTxtBtn: { backgroundColor: BRAND, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12 },
  loader: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'center', alignItems: 'center', zIndex: 30 },
  bottomPanel: { paddingBottom: 24, paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.7)' },
  fChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1.5, borderColor: 'transparent' },
  audBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#1F2937', paddingVertical: 12, borderRadius: 22 },
});
                    
