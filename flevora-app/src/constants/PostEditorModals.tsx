import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput, ScrollView, FlatList,
  Image, Switch, StyleSheet, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { ASPECT_RATIOS, MediaSlide, POST_FILTERS } from './postCreationSystem';

const W = Dimensions.get('window').width;

function EditorVideo({ uri, muted }: { uri: string; muted: boolean }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = muted; p.play(); });
  React.useEffect(() => { player.muted = muted; }, [muted, player]);
  return <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls />;
}

export function PhotoVideoEditorModal({
  visible, slides, setSlides, aspectRatio, setAspectRatio, onClose,
}: {
  visible: boolean; slides: MediaSlide[]; setSlides: (fn: (p: MediaSlide[]) => MediaSlide[]) => void;
  aspectRatio: string; setAspectRatio: (r: string) => void; onClose: () => void;
}) {
  const { c } = useTheme();
  const [idx, setIdx] = useState(0);
  if (!visible || !slides.length) return null;
  const cur = slides[idx] || slides[0];
  const ratioObj = ASPECT_RATIOS.find((a) => a.key === aspectRatio) || ASPECT_RATIOS[0];
  const filterTint = POST_FILTERS.find((f) => f.name === cur.filter)?.tint || 'transparent';

  const updateCur = (patch: Partial<MediaSlide>) => {
    setSlides((prev) => prev.map((sl, i) => (i === idx ? { ...sl, ...patch } : sl)));
  };

  const moveSlide = (dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= slides.length) return;
    setSlides((prev) => {
      const next = [...prev];
      [next[idx], next[target]] = [next[target], next[idx]];
      return next;
    });
    setIdx(target);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[s.title, { color: c.text }]}>Edit ({idx + 1}/{slides.length})</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ color: BRAND, fontWeight: '800', fontSize: 15 }}>Done</Text></TouchableOpacity>
        </View>

        <View style={{ width: W, height: W * ratioObj.ratio, backgroundColor: '#000', alignSelf: 'center', overflow: 'hidden' }}>
          {cur.type === 'video' ? (
            <EditorVideo uri={cur.uri} muted={cur.muted} />
          ) : (
            <Image
              source={{ uri: cur.uri }}
              style={{
                width: '100%', height: '100%',
                transform: [{ rotate: `${cur.rotate}deg` }, { scaleX: cur.flip ? -1 : 1 }],
              }}
              resizeMode="cover"
            />
          )}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: filterTint }]} pointerEvents="none" />
        </View>

        <ScrollView contentContainerStyle={{ padding: 14, gap: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            {ASPECT_RATIOS.map((ar) => (
              <TouchableOpacity key={ar.key} onPress={() => setAspectRatio(ar.key)} style={[s.chip, { backgroundColor: aspectRatio === ar.key ? BRAND : c.input }]}>
                <Text style={{ color: aspectRatio === ar.key ? BRAND_TEXT : c.text, fontWeight: '700', fontSize: 12 }}>{ar.label}</Text>
              </TouchableOpacity>
            ))}
            {cur.type === 'image' ? (
              <>
                <TouchableOpacity onPress={() => updateCur({ rotate: (cur.rotate + 90) % 360 })} style={[s.chip, { backgroundColor: c.input }]}><Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>↻ Rotate</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => updateCur({ flip: !cur.flip })} style={[s.chip, { backgroundColor: c.input }]}><Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>⇄ Flip</Text></TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity onPress={() => updateCur({ muted: !cur.muted })} style={[s.chip, { backgroundColor: c.input }]}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 12 }}>{cur.muted ? '🔇 Muted' : '🔊 Sound On'}</Text>
              </TouchableOpacity>
            )}
          </View>

          {slides.length > 1 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => moveSlide(-1)} style={[s.chip, { backgroundColor: c.input }]}><Text style={{ color: c.text, fontWeight: '700' }}>← Move</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => moveSlide(1)} style={[s.chip, { backgroundColor: c.input }]}><Text style={{ color: c.text, fontWeight: '700' }}>Move →</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setSlides((p) => p.filter((_, i) => i !== idx)); setIdx(0); }} style={[s.chip, { backgroundColor: '#EF4444' }]}><Text style={{ color: '#fff', fontWeight: '700' }}>Remove</Text></TouchableOpacity>
            </View>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>FILTERS</Text>
            {slides.length > 1 && (
              <TouchableOpacity onPress={() => setSlides((p) => p.map((sl) => ({ ...sl, filter: cur.filter })))}>
                <Text style={{ color: BRAND, fontWeight: '700', fontSize: 12 }}>Apply to All Slides</Text>
              </TouchableOpacity>
            )}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {POST_FILTERS.map((f) => (
              <TouchableOpacity key={f.name} onPress={() => updateCur({ filter: f.name })} style={[s.chip, { backgroundColor: cur.filter === f.name ? BRAND : c.input }]}>
                <Text style={{ color: cur.filter === f.name ? BRAND_TEXT : c.text, fontWeight: '700', fontSize: 12 }}>{f.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </ScrollView>
      </View>
    </Modal>
  );
}
export function TagAndCollabModal({
  visible, users, myUid, taggedUids, setTaggedUids, collabUids, setCollabUids, onClose,
}: any) {
  const { c } = useTheme();
  const [mode, setMode] = useState<'tag' | 'collab'>('tag');
  const [q, setQ] = useState('');
  const filtered = (users || []).filter((u: any) => u.id !== myUid && (u.username || '').toLowerCase().includes(q.trim().toLowerCase()));
  const activeList = mode === 'tag' ? taggedUids : collabUids;
  const setActiveList = mode === 'tag' ? setTaggedUids : setCollabUids;

  const toggle = (id: string) => setActiveList((p: string[]) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[s.title, { color: c.text }]}>Tag & Collaborators</Text>
          <TouchableOpacity onPress={onClose}><Text style={{ color: BRAND, fontWeight: '800' }}>Done</Text></TouchableOpacity>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, padding: 12 }}>
          <TouchableOpacity onPress={() => setMode('tag')} style={[s.chip, { flex: 1, alignItems: 'center', backgroundColor: mode === 'tag' ? BRAND : c.input }]}>
            <Text style={{ color: mode === 'tag' ? BRAND_TEXT : c.text, fontWeight: '700' }}>Tag People ({taggedUids.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMode('collab')} style={[s.chip, { flex: 1, alignItems: 'center', backgroundColor: mode === 'collab' ? BRAND : c.input }]}>
            <Text style={{ color: mode === 'collab' ? BRAND_TEXT : c.text, fontWeight: '700' }}>Invite Collaborator ({collabUids.length})</Text>
          </TouchableOpacity>
        </View>
        <TextInput value={q} onChangeText={setQ} placeholder="Search Flevora users..." placeholderTextColor={c.muted} style={[s.inp, { marginHorizontal: 12, backgroundColor: c.input, color: c.text }]} />
        <FlatList
          data={filtered}
          keyExtractor={(u) => u.id}
          renderItem={({ item }) => {
            const sel = activeList.includes(item.id);
            return (
              <TouchableOpacity style={[s.uRow, { borderBottomColor: c.border }]} onPress={() => toggle(item.id)}>
                <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>@{item.username}</Text>
                <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={22} color={sel ? BRAND : c.muted} />
              </TouchableOpacity>
            );
          }}
        />
      </View>
    </Modal>
  );
}

export function AdvancedSettingsModal({
  visible, slides, setSlides, hideLikes, setHideLikes, hideViews, setHideViews,
  commentsOff, setCommentsOff, allowReshare, setAllowReshare, onClose,
}: any) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[s.title, { color: c.text }]}>Advanced Settings</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
          {[
            ['Hide like count on this post', hideLikes, setHideLikes],
            ['Hide view count on this post', hideViews, setHideViews],
            ['Turn off commenting', commentsOff, setCommentsOff],
            ['Allow sharing / reposting', allowReshare, setAllowReshare],
          ].map(([label, val, setter]: any) => (
            <View key={String(label)} style={s.swRow}>
              <Text style={{ color: c.text, fontSize: 15, flex: 1 }}>{label}</Text>
              <Switch value={Boolean(val)} onValueChange={setter} trackColor={{ true: BRAND }} />
            </View>
          ))}
          <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', marginTop: 8 }}>ALT TEXT (ACCESSIBILITY)</Text>
          {(slides || []).map((sl: MediaSlide, i: number) => (
            <TextInput
              key={sl.id}
              value={sl.altText}
              onChangeText={(txt) => setSlides((p: MediaSlide[]) => p.map((x, idx) => (idx === i ? { ...x, altText: txt } : x)))}
              placeholder={`Alt text for slide #${i + 1}...`}
              placeholderTextColor={c.muted}
              style={[s.inp, { backgroundColor: c.input, color: c.text }]}
            />
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function PostPreviewModal({
  visible, user, slides, caption, location, audience, collabCount, onClose, onPublish,
}: any) {
  const { c } = useTheme();
  if (!visible) return null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[s.title, { color: c.text }]}>Final Preview</Text>
          <TouchableOpacity onPress={() => { onClose(); onPublish(); }}><Text style={{ color: BRAND, fontWeight: '800', fontSize: 15 }}>Publish</Text></TouchableOpacity>
        </View>
        <ScrollView>
          <View style={{ padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }}><Ionicons name="person" size={18} color={BRAND_TEXT} /></View>
            <View>
              <Text style={{ color: c.text, fontWeight: '800' }}>@{user?.username || 'you'}</Text>
              {!!location && <Text style={{ color: c.muted, fontSize: 12 }}>{location}</Text>}
            </View>
          </View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {(slides || []).map((sl: MediaSlide) => (
              <Image key={sl.id} source={{ uri: sl.uri }} style={{ width: W, height: W * 1.1, backgroundColor: '#000' }} resizeMode="cover" />
            ))}
          </ScrollView>
          <View style={{ padding: 14, gap: 6 }}>
            <Text style={{ color: c.muted, fontSize: 12 }}>Audience: {audience} {collabCount > 0 ? `• ${collabCount} pending collaborator(s)` : ''}</Text>
            {!!caption && <Text style={{ color: c.text, fontSize: 14 }}><Text style={{ fontWeight: '800' }}>@{user?.username || 'you'} </Text>{caption}</Text>}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 46 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 0.5 },
  title: { fontSize: 16, fontWeight: '800' },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  inp: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  uRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 0.5 },
  swRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
