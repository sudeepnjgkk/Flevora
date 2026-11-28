import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView, Switch,
  FlatList, Image, Alert, ActivityIndicator, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { ReelAudience } from './reelsSystem';

export function ReelOwnerEditModal({
  visible, reel, onClose,
}: {
  visible: boolean;
  reel: any | null;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [caption, setCaption] = useState('');
  const [audience, setAudience] = useState<ReelAudience>('everyone');
  const [commentsOff, setCommentsOff] = useState(false);
  const [allowRepost, setAllowRepost] = useState(true);
  const [allowRemix, setAllowRemix] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);
  const [hideLikes, setHideLikes] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !reel) return;
    setCaption(reel.caption || '');
    setAudience((reel.audience as ReelAudience) || 'everyone');
    setCommentsOff(Boolean(reel.commentsDisabled));
    setAllowRepost(reel.allowRepost !== false);
    setAllowRemix(reel.allowRemix !== false);
    setAllowDownload(Boolean(reel.allowDownload));
    setHideLikes(Boolean(reel.hideLikeCount));
  }, [visible, reel?.id]);

  const handleSave = async () => {
    if (!reel?.id || busy) return;
    setBusy(true);
    try {
      const hashtags = Array.from(new Set((caption.match(/#[a-zA-Z0-9_]+/g) || []).map((h) => h.toLowerCase())));
      const mentions = Array.from(new Set((caption.match(/@([a-zA-Z0-9._]+)/g) || []).map((m) => m.slice(1).toLowerCase())));
      await updateDoc(doc(db, 'posts', reel.id), {
        caption: caption.trim(),
        hashtags,
        mentions,
        audience,
        isPrivate: audience !== 'everyone',
        commentsDisabled: commentsOff,
        allowRepost,
        allowRemix,
        allowDownload,
        hideLikeCount: hideLikes,
        updatedAt: serverTimestamp(),
      });
      Alert.alert('Saved', 'Reel details updated.');
      onClose();
    } catch {
      Alert.alert('Error', 'Could not update Reel.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          <View style={[s.head, { borderBottomColor: c.border }]}>
            <Text style={[s.title, { color: c.text }]}>Edit Reel</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={c.text} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="Caption, @mentions, #hashtags..."
              placeholderTextColor={c.muted}
              multiline
              maxLength={2200}
              style={[s.inp, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
            />
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>AUDIENCE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['everyone', 'followers', 'closeFriends'] as ReelAudience[]).map((a) => (
                <TouchableOpacity key={a} onPress={() => setAudience(a)} style={[s.pill, { flex: 1, backgroundColor: audience === a ? BRAND : c.input }]}>
                  <Text style={{ color: audience === a ? BRAND_TEXT : c.text, fontWeight: '700', fontSize: 12 }}>
                    {a === 'closeFriends' ? 'Close Friends' : a === 'followers' ? 'Followers' : 'Everyone'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {[
              ['Disable Comments', commentsOff, setCommentsOff],
              ['Allow Reposting', allowRepost, setAllowRepost],
              ['Allow Remixing', allowRemix, setAllowRemix],
              ['Allow Downloads', allowDownload, setAllowDownload],
              ['Hide Like Count', hideLikes, setHideLikes],
            ].map(([label, val, fn]: any) => (
              <View key={label} style={s.swRow}>
                <Text style={{ color: c.text, fontWeight: '600' }}>{label}</Text>
                <Switch value={val} onValueChange={fn} />
              </View>
            ))}
            <TouchableOpacity disabled={busy} onPress={handleSave} style={[s.primaryBtn, { backgroundColor: BRAND }]}>
              {busy ? <ActivityIndicator color={BRAND_TEXT} /> : <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Save Changes</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
export function ReelInsightsModal({
  visible, reel, onClose,
}: {
  visible: boolean;
  reel: any | null;
  onClose: () => void;
}) {
  const { c } = useTheme();
  if (!reel) return null;
  const views = reel.views || 0;
  const likes = Array.isArray(reel.likes) ? reel.likes.length : 0;
  const comments = reel.commentsCount || 0;
  const reposts = Array.isArray(reel.reposts) ? reel.reposts.length : 0;
  const shares = reel.sharesCount || 0;
  const engRate = views > 0 ? (((likes + comments + reposts + shares) / views) * 100).toFixed(1) : '0.0';

  const metrics = [
    { label: 'Plays / Views', val: views, icon: 'play-outline' },
    { label: 'Likes', val: likes, icon: 'heart-outline' },
    { label: 'Comments', val: comments, icon: 'chatbubble-outline' },
    { label: 'Reposts', val: reposts, icon: 'repeat-outline' },
    { label: 'Shares', val: shares, icon: 'paper-plane-outline' },
    { label: 'Engagement Rate', val: `${engRate}%`, icon: 'stats-chart-outline' },
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          <View style={[s.head, { borderBottomColor: c.border }]}>
            <Text style={[s.title, { color: c.text }]}>Reel Insights</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={22} color={c.text} /></TouchableOpacity>
          </View>
          <View style={{ padding: 16, gap: 10 }}>
            {metrics.map((m) => (
              <View key={m.label} style={[s.metricRow, { backgroundColor: c.input, borderColor: c.border }]}>
                <Ionicons name={m.icon as any} size={20} color={BRAND} />
                <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>{m.label}</Text>
                <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{m.val}</Text>
              </View>
            ))}
            <Text style={{ color: c.muted, fontSize: 11, marginTop: 4 }}>
              Live Firestore counts shown. Time-series retention graphs require server-side analytics (Blaze/Cloud Functions).
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function ArchivedReelsModal({
  visible, uid, onClose,
}: {
  visible: boolean;
  uid: string;
  onClose: () => void;
}) {
  const { c } = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible || !uid) return;
    setLoading(true);
    return onSnapshot(
      query(collection(db, 'posts'), where('uid', '==', uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((p: any) => p.mediaType === 'video' && p.isArchived === true && !p.isDeleted);
        setItems(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, [visible, uid]);

  const restore = async (id: string) => {
    await updateDoc(doc(db, 'posts', id), { isArchived: false, updatedAt: serverTimestamp() }).catch(() => {});
    Alert.alert('Restored', 'Reel is visible on your profile and feed again.');
  };

  const remove = (id: string) => {
    Alert.alert('Delete Reel Permanently?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteDoc(doc(db, 'posts', id)).catch(() => {}) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.fullWrap, { backgroundColor: c.background }]}>
        <View style={[s.head, { borderBottomColor: c.border, paddingTop: 46 }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <Text style={[s.title, { color: c.text }]}>Archived Reels</Text>
          <View style={{ width: 24 }} />
        </View>
        {loading ? <ActivityIndicator color={BRAND} style={{ marginTop: 40 }} /> : (
          <FlatList
            data={items}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: 14, gap: 10 }}
            ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 60 }}>No archived Reels.</Text>}
            renderItem={({ item }) => (
              <View style={[s.metricRow, { backgroundColor: c.input, borderColor: c.border }]}>
                <Image source={{ uri: item.thumbnailUrl || item.mediaUrl?.replace(/\.[^/.]+$/, '.jpg') }} style={s.thumb} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: c.text, fontWeight: '700' }} numberOfLines={1}>{item.caption || 'Untitled Reel'}</Text>
                  <Text style={{ color: c.muted, fontSize: 12 }}>{item.views || 0} plays • {item.likes?.length || 0} likes</Text>
                </View>
                <TouchableOpacity onPress={() => restore(item.id)} style={[s.miniBtn, { backgroundColor: BRAND }]}>
                  <Text style={{ color: BRAND_TEXT, fontWeight: '800', fontSize: 12 }}>Restore</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => remove(item.id)} style={{ padding: 6 }}>
                  <Ionicons name="trash-outline" size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '82%', paddingBottom: 18 },
  fullWrap: { flex: 1 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#888', alignSelf: 'center', marginTop: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 0.5 },
  title: { fontSize: 16, fontWeight: '800' },
  inp: { borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 84, textAlignVertical: 'top' },
  pill: { paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  swRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  primaryBtn: { paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 6 },
  metricRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  thumb: { width: 44, height: 58, borderRadius: 8, backgroundColor: '#111' },
  miniBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
});
