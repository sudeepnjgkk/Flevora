import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, ScrollView, FlatList,
  Image, ActivityIndicator, Alert, StyleSheet, Dimensions, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import {
  REPORT_CATEGORIES, NOT_INTERESTED_REASONS, canRemixReel, fetchMyReelReport,
  fetchReelsWithSameAudio, getAudioMeta, getWhySeeingReasons, submitReelReport,
} from './reelOptionsSystem';

const W = (Dimensions.get('window').width - 36) / 3;

function SheetWrap({ visible, title, onClose, children }: any) {
  const { c } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.backdrop}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          <View style={[s.head, { borderBottomColor: c.border }]}>
            <Text style={[s.title, { color: c.text }]}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}><Ionicons name="close" size={22} color={c.text} /></TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function AboutReelModal({ visible, reel, owner, onClose }: any) {
  const { c } = useTheme();
  if (!reel) return null;
  const audio = getAudioMeta(reel, owner);
  const dateStr = reel.createdAt?.toDate ? reel.createdAt.toDate().toLocaleDateString() : 'Recently';
  const tags = Array.isArray(reel.hashtags) ? reel.hashtags.join(' ') : '';
  return (
    <SheetWrap visible={visible} title="About this Reel" onClose={onClose}>
      <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
        <View style={s.infoRow}>
          <Ionicons name="person-circle-outline" size={20} color={c.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '700' }}>@{owner?.username || reel.username || 'user'}</Text>
            {!!owner?.fullName && <Text style={{ color: c.muted, fontSize: 12 }}>{owner.fullName}</Text>}
          </View>
        </View>
        <View style={s.infoRow}>
          <Ionicons name="calendar-outline" size={20} color={c.muted} />
          <Text style={{ color: c.text }}>Published: {dateStr}</Text>
        </View>
        <View style={s.infoRow}>
          <Ionicons name="musical-notes-outline" size={20} color={c.muted} />
          <Text style={{ color: c.text, flex: 1 }}>{audio.title} • {audio.artist}</Text>
        </View>
        {!!reel.remixOf?.username && (
          <View style={s.infoRow}>
            <Ionicons name="git-branch-outline" size={20} color={BRAND} />
            <Text style={{ color: c.text }}>Remix of @{reel.remixOf.username}'s Reel</Text>
          </View>
        )}
        {!!reel.caption && (
          <View style={[s.box, { backgroundColor: c.input, borderColor: c.border }]}>
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>CAPTION</Text>
            <Text style={{ color: c.text }}>{reel.caption}</Text>
            {!!tags && <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{tags}</Text>}
          </View>
        )}
        <View style={[s.box, { backgroundColor: c.input, borderColor: c.border }]}>
          <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>STATS & METADATA</Text>
          <Text style={{ color: c.text, fontSize: 13 }}>
            {reel.views || 0} plays • {reel.likes?.length || 0} likes • {reel.commentsCount || 0} comments • {reel.reposts?.length || 0} reposts
          </Text>
          {!!reel.location && <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Location: {reel.location}</Text>}
        </View>
        <View style={[s.box, { backgroundColor: c.input, borderColor: c.border }]}>
          <Text style={{ color: c.muted, fontSize: 11, fontWeight: '700', marginBottom: 4 }}>AI DESCRIPTION</Text>
          <Text style={{ color: c.muted, fontSize: 12 }}>
            AI-generated Reel description is unavailable because no server-side AI vision service is configured yet.
          </Text>
        </View>
      </ScrollView>
    </SheetWrap>
  );
}

export function AskFlevoraAIModal({ visible, reel, onClose }: any) {
  const { c } = useTheme();
  return (
    <SheetWrap visible={visible} title="Ask Flevora AI" onClose={onClose}>
      <View style={{ padding: 18, gap: 12 }}>
        <View style={[s.box, { backgroundColor: c.input, borderColor: c.border, alignItems: 'center', gap: 8 }]}>
          <Ionicons name="sparkles-outline" size={32} color={BRAND} />
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>Flevora AI Backend Required</Text>
          <Text style={{ color: c.muted, fontSize: 13, textAlign: 'center', lineHeight: 19 }}>
            Ask Flevora AI needs a server-side AI endpoint (such as a Firebase Cloud Function proxying Gemini API with a server-side API key) to analyze Reel context safely.
          </Text>
          {!!reel?.caption && (
            <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>
              Detected Reel context ready for backend: "{reel.caption.slice(0, 80)}"
            </Text>
          )}
        </View>
      </View>
    </SheetWrap>
  );
}

export function AudioDetailModal({ visible, reel, owner, me, myUid, usersMap, onSelectReel, onClose }: any) {
  const { c } = useTheme();
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const audio = getAudioMeta(reel, owner);

  const load = () => {
    if (!reel || !audio.available) return;
    setLoading(true);
    setErr('');
    fetchReelsWithSameAudio(reel, owner, me, myUid, usersMap)
      .then(setReels)
      .catch(() => setErr('Could not load audio Reels.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (visible) load(); }, [visible, reel?.id]);

  return (
    <SheetWrap visible={visible} title="Audio" onClose={onClose}>
      <View style={{ padding: 16, maxHeight: 450 }}>
        {!audio.available ? (
          <Text style={{ color: c.muted, textAlign: 'center', paddingVertical: 24 }}>Audio metadata is unavailable for this Reel.</Text>
        ) : (
          <>
            <View style={[s.infoRow, { marginBottom: 12 }]}>
              {audio.coverUrl ? <Image source={{ uri: audio.coverUrl }} style={s.audioImg} /> : (
                <View style={[s.audioImg, { backgroundColor: c.input, justifyContent: 'center', alignItems: 'center' }]}>
                  <Ionicons name="musical-notes" size={24} color={BRAND} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>{audio.title}</Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>{audio.artist} {audio.isOriginal ? '• Original Audio' : ''}</Text>
                {audio.restricted && <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 2 }}>Restricted audio</Text>}
              </View>
            </View>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>REELS WITH THIS AUDIO ({reels.length})</Text>
            {loading ? <ActivityIndicator color={BRAND} style={{ marginVertical: 20 }} /> : err ? (
              <TouchableOpacity onPress={load} style={{ padding: 16, alignItems: 'center' }}>
                <Text style={{ color: '#EF4444', fontWeight: '700' }}>{err} Tap to retry</Text>
              </TouchableOpacity>
            ) : (
              <FlatList
                data={reels}
                numColumns={3}
                keyExtractor={(i) => i.id}
                ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', paddingVertical: 20 }}>No other Reels found.</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => { onClose(); onSelectReel(item.id); }} style={s.gridItem}>
                    <View style={[s.gridBox, { backgroundColor: c.input }]}>
                      <Ionicons name="play" size={22} color={c.text} />
                      <Text style={{ color: c.muted, fontSize: 10, marginTop: 4 }}>{item.views || 0} plays</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}
      </View>
    </SheetWrap>
  );
}
export function RemixSequenceModal({ visible, reel, owner, me, myUid, onClose }: any) {
  const { c } = useTheme();
  const router = useRouter();
  if (!reel) return null;
  const remixCheck = canRemixReel(reel, owner, me, myUid);
  const uname = owner?.username || reel.username || 'user';

  const startRemix = () => {
    if (!remixCheck.allowed) return Alert.alert('Remix Unavailable', remixCheck.reason);
    onClose();
    router.push(`/upload?remixOfId=${reel.id}&remixOfUser=${encodeURIComponent(uname)}` as any);
  };

  return (
    <SheetWrap visible={visible} title="Remix & Sequence" onClose={onClose}>
      <View style={{ padding: 16, gap: 12 }}>
        <TouchableOpacity
          onPress={startRemix}
          style={[s.box, { backgroundColor: c.input, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: remixCheck.allowed ? 1 : 0.6 }]}
        >
          <Ionicons name="git-branch-outline" size={24} color={remixCheck.allowed ? BRAND : c.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>Remix this Reel</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>
              {remixCheck.allowed ? `Create a new Reel crediting @${uname}` : remixCheck.reason}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        </TouchableOpacity>

        <View style={[s.box, { backgroundColor: c.input, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: 0.7 }]}>
          <Ionicons name="film-outline" size={24} color={c.muted} />
          <View style={{ flex: 1 }}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 15 }}>Sequence (Unavailable)</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>
              Video sequence stitching requires ffmpeg-kit-react-native or server-side video concatenation (not installed).
            </Text>
          </View>
        </View>
      </View>
    </SheetWrap>
  );
}

export function WhySeeingModal({ visible, reel, owner, me, feedTab, onClose }: any) {
  const { c } = useTheme();
  const reasons = getWhySeeingReasons(reel, owner, me, feedTab);
  return (
    <SheetWrap visible={visible} title="Why you're seeing this post" onClose={onClose}>
      <View style={{ padding: 16, gap: 10 }}>
        {reasons.map((r, idx) => (
          <View key={idx} style={[s.box, { backgroundColor: c.input, borderColor: c.border, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color={BRAND} />
            <Text style={{ color: c.text, flex: 1, fontSize: 14 }}>{r}</Text>
          </View>
        ))}
      </View>
    </SheetWrap>
  );
}

export function NotInterestedModal({ visible, onSubmit, onClose }: any) {
  const { c } = useTheme();
  const [reason, setReason] = useState<string>(NOT_INTERESTED_REASONS[0]);
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    if (busy) return;
    setBusy(true);
    try { await onSubmit(reason); onClose(); } finally { setBusy(false); }
  };

  return (
    <SheetWrap visible={visible} title="Not Interested" onClose={onClose}>
      <View style={{ padding: 16, gap: 8 }}>
        <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Tell us why so we can show fewer Reels like this:</Text>
        {NOT_INTERESTED_REASONS.map((r) => (
          <TouchableOpacity key={r} onPress={() => setReason(r)} style={[s.selRow, { borderColor: c.border, backgroundColor: reason === r ? c.input : 'transparent' }]}>
            <Text style={{ color: c.text, flex: 1, fontSize: 14 }}>{r}</Text>
            <Ionicons name={reason === r ? 'radio-button-on' : 'radio-button-off'} size={20} color={reason === r ? BRAND : c.muted} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity disabled={busy} onPress={handleConfirm} style={[s.primaryBtn, { backgroundColor: BRAND, marginTop: 8 }]}>
          {busy ? <ActivityIndicator color={BRAND_TEXT} /> : <Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Submit Feedback</Text>}
        </TouchableOpacity>
      </View>
    </SheetWrap>
  );
}

export function ReportReelModal({ visible, reel, myUid, onClose }: any) {
  const { c } = useTheme();
  const [category, setCategory] = useState<string>('');
  const [details, setDetails] = useState('');
  const [existing, setExisting] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible || !reel?.id || !myUid) return;
    setCategory('');
    setDetails('');
    setLoading(true);
    fetchMyReelReport(reel.id, myUid).then(setExisting).catch(() => setExisting(null)).finally(() => setLoading(false));
  }, [visible, reel?.id, myUid]);

  const handleSend = async () => {
    if (!category || busy) return;
    setBusy(true);
    try {
      const res = await submitReelReport({ reelId: reel.id, myUid, category, details });
      if (res.duplicate) Alert.alert('Already Reported', `Status: ${res.report.status || 'pending'}`);
      else Alert.alert('Report Submitted', 'Thank you. Your report is under review and your identity stays private.');
      onClose();
    } catch (e: any) {
      Alert.alert('Report Failed', e?.message || 'Could not submit report. Please retry.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SheetWrap visible={visible} title="Report Reel" onClose={onClose}>
      <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ padding: 16, gap: 8 }}>
        {loading ? <ActivityIndicator color={BRAND} style={{ marginVertical: 20 }} /> : existing ? (
          <View style={[s.box, { backgroundColor: c.input, borderColor: c.border, gap: 6 }]}>
            <Text style={{ color: c.text, fontWeight: '800' }}>You already reported this Reel</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>Category: {existing.category || existing.reason}</Text>
            <Text style={{ color: BRAND, fontWeight: '700', fontSize: 13 }}>Status: {existing.status || 'pending'}</Text>
          </View>
        ) : (
          <>
            <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Select a reason (your identity stays private):</Text>
            {REPORT_CATEGORIES.map((cat) => (
              <TouchableOpacity key={cat} onPress={() => setCategory(cat)} style={[s.selRow, { borderColor: c.border, backgroundColor: category === cat ? c.input : 'transparent' }]}>
                <Text style={{ color: c.text, flex: 1, fontSize: 14 }}>{cat}</Text>
                <Ionicons name={category === cat ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={category === cat ? BRAND : c.muted} />
              </TouchableOpacity>
            ))}
            <TextInput
              style={[s.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
              placeholder="Optional additional details..."
              placeholderTextColor={c.muted}
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={300}
            />
            <TouchableOpacity disabled={!category || busy} onPress={handleSend} style={[s.primaryBtn, { backgroundColor: category ? '#EF4444' : c.input }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: category ? '#fff' : c.muted, fontWeight: '800' }}>Submit Report</Text>}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SheetWrap>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden', paddingBottom: 14 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#888', alignSelf: 'center', marginTop: 10 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 0.5 },
  title: { fontSize: 16, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  box: { borderWidth: 1, borderRadius: 12, padding: 12 },
  audioImg: { width: 52, height: 52, borderRadius: 10 },
  gridItem: { width: W, height: W, padding: 2 },
  gridBox: { flex: 1, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  selRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, minHeight: 72, textAlignVertical: 'top', marginTop: 4 },
  primaryBtn: { paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
});
