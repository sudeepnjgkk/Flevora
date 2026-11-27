import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, Image, TextInput, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND } from './theme';

const REPORT_REASONS = [
  'Spam',
  'Impersonation',
  'Harassment',
  'Inappropriate content',
  'Fake account',
  'Other',
];

function StoryVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.play(); });
  return <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" />;
}

// Read-only Story / Highlight Viewer for Visitors (No edit/delete controls)
export function VisitorStoryModal({
  visible, title, stories, onClose,
}: {
  visible: boolean; title: string; stories: any[]; onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  if (!visible || !stories.length) return null;
  const current = stories[idx] || stories[0];
  const isVideo = current.mediaType === 'video';

  const next = () => {
    if (idx + 1 < stories.length) setIdx(idx + 1);
    else { setIdx(0); onClose(); }
  };
  const prev = () => { if (idx > 0) setIdx(idx - 1); };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.storyWrap}>
        {isVideo ? (
          <StoryVideo uri={current.mediaUrl} />
        ) : (
          <Image source={{ uri: current.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        )}
        <View style={styles.storyTop}>
          <View style={styles.barRow}>
            {stories.map((s, i) => (
              <View key={s.id || i} style={[styles.bar, { backgroundColor: i <= idx ? '#fff' : 'rgba(255,255,255,0.35)' }]} />
            ))}
          </View>
          <View style={styles.storyHead}>
            <Text style={styles.storyTitle}>{title}</Text>
            <TouchableOpacity onPress={() => { setIdx(0); onClose(); }}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.tapZones}>
          <TouchableOpacity style={{ flex: 1 }} onPress={prev} />
          <TouchableOpacity style={{ flex: 2 }} onPress={next} />
        </View>
      </View>
    </Modal>
  );
}

// Report Account Modal with Categories & Validation
export function ReportAccountModal({
  visible, targetUser, myUid, onClose,
}: {
  visible: boolean; targetUser: any; myUid: string; onClose: () => void;
}) {
  const { c } = useTheme();
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!myUid) return Alert.alert('Sign In Required', 'Please sign in to report an account.');
    if (sending || !targetUser?.id) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'reports'), {
        targetUid: targetUser.id,
        type: 'user',
        category: reason,
        reason: details.trim() ? `${reason}: ${details.trim()}` : reason,
        reporterUid: myUid,
        reportedBy: myUid,
        status: 'pending',
        createdAt: serverTimestamp(),
      });
      setDetails('');
      onClose();
      Alert.alert('Report Submitted', 'Thank you. Our team will review this account.');
    } catch {
      Alert.alert('Error', 'Could not submit report. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBg}>
        <View style={[styles.sheetCard, { backgroundColor: c.background }]}>
          <View style={[styles.sheetHead, { borderBottomColor: c.border }]}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>Report @{targetUser?.username}</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={c.text} /></TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 340 }}>
            {REPORT_REASONS.map((r) => (
              <TouchableOpacity key={r} onPress={() => setReason(r)} style={[styles.reasonRow, { borderBottomColor: c.border }]}>
                <Text style={{ color: c.text, fontSize: 14, fontWeight: reason === r ? '700' : '400' }}>{r}</Text>
                <Ionicons name={reason === r ? 'radio-button-on' : 'radio-button-off'} size={20} color={reason === r ? BRAND : c.muted} />
              </TouchableOpacity>
            ))}
            <TextInput
              style={[styles.detailsIn, { backgroundColor: c.input, borderColor: c.border, color: c.text }]}
              placeholder="Optional details..."
              placeholderTextColor={c.muted}
              value={details}
              onChangeText={setDetails}
              multiline
              maxLength={400}
            />
          </ScrollView>
          <TouchableOpacity onPress={submit} disabled={sending} style={[styles.submitBtn, { backgroundColor: '#EF4444' }]}>
            {sending ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '800' }}>Submit Report</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// Visitor More Options Sheet (No Owner Controls)
export function VisitorMoreModal({
  visible, profile, isFollowing, isRequested, isBlocked, isMuted, isRestricted,
  onClose, onShare, onCopyLink, onBlock, onMute, onRestrict, onUnfollow, onCancelReq, onReport, onAbout,
}: {
  visible: boolean; profile: any; isFollowing: boolean; isRequested: boolean;
  isBlocked: boolean; isMuted: boolean; isRestricted: boolean;
  onClose: () => void; onShare: () => void; onCopyLink: () => void;
  onBlock: () => void; onMute: () => void; onRestrict: () => void;
  onUnfollow: () => void; onCancelReq: () => void; onReport: () => void; onAbout: () => void;
}) {
  const { c } = useTheme();
  if (!visible || !profile) return null;

  const items: { label: string; color?: string; action: () => void }[] = [
    { label: 'Share Profile', action: onShare },
    { label: 'Copy Profile Link', action: onCopyLink },
    { label: 'About This Account', action: onAbout },
    { label: isMuted ? 'Unmute Account' : 'Mute Account', action: onMute },
    { label: isRestricted ? 'Unrestrict Account' : 'Restrict Account', action: onRestrict },
  ];
  if (isFollowing) items.push({ label: 'Unfollow', color: '#EF4444', action: onUnfollow });
  if (isRequested) items.push({ label: 'Cancel Follow Request', color: '#F59E0B', action: onCancelReq });
  items.push({ label: isBlocked ? 'Unblock Account' : 'Block Account', color: '#EF4444', action: onBlock });
  items.push({ label: 'Report Account', color: '#EF4444', action: onReport });

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={styles.sheetBg} activeOpacity={1} onPress={onClose}>
        <View style={[styles.sheetCard, { backgroundColor: c.background }]}>
          {items.map((it) => (
            <TouchableOpacity key={it.label} style={[styles.optRow, { borderBottomColor: c.border }]} onPress={() => { onClose(); it.action(); }}>
              <Text style={{ color: it.color || c.text, fontWeight: '600', fontSize: 15 }}>{it.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.optRow} onPress={onClose}>
            <Text style={{ color: c.muted, fontWeight: '700', fontSize: 15 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function showProfileLinkDialog(uid: string, username: string) {
  const link = `flevora://user/${uid}`;
  Alert.alert('Profile Link', `@${username}\n${link}`, [
    { text: 'Share / Copy', onPress: () => Share.share({ message: link, title: `@${username} on Flevora` }).catch(() => {}) },
    { text: 'Close', style: 'cancel' },
  ]);
}

const styles = StyleSheet.create({
  storyWrap: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  storyTop: { position: 'absolute', top: 44, left: 12, right: 12, zIndex: 20 },
  barRow: { flexDirection: 'row', gap: 4, marginBottom: 10 },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  storyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  storyTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  tapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row', zIndex: 10 },
  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheetCard: { borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingBottom: 24, overflow: 'hidden' },
  sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 0.5 },
  reasonRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 0.5 },
  detailsIn: { margin: 14, borderWidth: 1, borderRadius: 10, padding: 10, minHeight: 70, fontSize: 14 },
  submitBtn: { marginHorizontal: 14, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  optRow: { paddingVertical: 14, paddingHorizontal: 18, borderBottomWidth: 0.5, alignItems: 'center' },
});
