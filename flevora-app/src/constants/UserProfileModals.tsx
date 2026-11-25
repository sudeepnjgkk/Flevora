import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Switch, FlatList, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND } from './theme';

export function FollowingOptionsModal({ visible, onClose, username, isCF, isFav, isRestr, onToggleCF, onToggleFav, onOpenMute, onToggleRestr, onUnfollow, c }: any) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <View style={[s.sheet, { backgroundColor: c.background }]}>
          <View style={s.handle} />
          <Text style={[s.title, { color: c.text }]}>{username}</Text>
          <TouchableOpacity style={s.row} onPress={onToggleCF}><Text style={[s.lbl, { color: c.text }]}>{isCF ? 'Remove from Close Friends' : 'Add to Close Friends list'}</Text><Ionicons name={isCF ? 'star' : 'star-outline'} size={22} color={isCF ? '#10B981' : c.text} /></TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={onToggleFav}><Text style={[s.lbl, { color: c.text }]}>{isFav ? 'Remove from favorites' : 'Add to favorites'}</Text><Ionicons name={isFav ? 'star' : 'star-outline'} size={22} color={isFav ? '#F59E0B' : c.text} /></TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={() => { onClose(); onOpenMute(); }}><Text style={[s.lbl, { color: c.text }]}>Mute</Text><Ionicons name="chevron-forward" size={20} color={c.muted} /></TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={onToggleRestr}><Text style={[s.lbl, { color: c.text }]}>{isRestr ? 'Unrestrict' : 'Restrict'}</Text><Ionicons name="chevron-forward" size={20} color={c.muted} /></TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={() => { onClose(); onUnfollow(); }}><Text style={[s.lbl, { color: '#EF4444' }]}>Unfollow</Text></TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function MuteOptionsModal({ visible, onClose, prefs, onToggle, c }: any) {
  const keys = ['Posts', 'Stories', 'Activity bubbles on content', 'Notes', 'Notes on the map', 'Location on the map', 'Instants'];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <View style={[s.sheet, { backgroundColor: c.background }]}>
          <View style={s.handle} />
          <View style={s.hdr}><TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={22} color={c.text} /></TouchableOpacity><Text style={{ fontSize: 17, fontWeight: '700', color: c.text }}>Mute</Text><View style={{ width: 22 }} /></View>
          {keys.map((k) => (
            <View key={k} style={s.row}><Text style={[s.lbl, { color: c.text }]}>{k}</Text><Switch value={!!prefs[k]} onValueChange={() => onToggle(k)} /></View>
          ))}
          <Text style={{ fontSize: 12, color: c.muted, marginTop: 8 }}>Flevora won't let them know you muted them.</Text>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function UserMenuModal({ visible, onClose, isHiddenStory, isRestr, isBlocked, onAction, c }: any) {
  const items = [
    { k: 'about', lbl: 'About this account', ic: 'person-circle-outline' },
    { k: 'hideStory', lbl: isHiddenStory ? 'Unhide your story' : 'Hide your story', ic: 'eye-off-outline' },
    { k: 'copy', lbl: 'Copy profile URL', ic: 'link-outline' },
    { k: 'share', lbl: 'Share this profile', ic: 'share-social-outline' },
    { k: 'qr', lbl: 'QR code', ic: 'qr-code-outline' },
    { k: 'restrict', lbl: isRestr ? 'Unrestrict' : 'Restrict', ic: 'hand-left-outline' },
    { k: 'block', lbl: isBlocked ? 'Unblock' : 'Block', ic: 'ban-outline', red: true },
    { k: 'report', lbl: 'Report', ic: 'alert-circle-outline', red: true },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={onClose}>
        <View style={[s.sheet, { backgroundColor: c.background }]}>
          <View style={s.handle} />
          {items.map((it) => (
            <TouchableOpacity key={it.k} style={s.row} onPress={() => { onClose(); onAction(it.k); }}>
              <Ionicons name={it.ic as any} size={22} color={it.red ? '#EF4444' : c.text} />
              <Text style={[s.lbl, { color: it.red ? '#EF4444' : c.text, marginLeft: 14 }]}>{it.lbl}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function UserNotifModal({ visible, onClose, username, prefs, onSetPref, c }: any) {
  const [pickKey, setPickKey] = useState<string | null>(null);
  const cats = [
    { k: 'Posts', ic: 'images-outline' },
    { k: 'Stories', ic: 'aperture-outline' },
    { k: 'Reels', ic: 'film-outline' },
    { k: 'Features', ic: 'tv-outline' },
    { k: 'Live videos', ic: 'radio-outline' },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={s.bg} activeOpacity={1} onPress={() => { setPickKey(null); onClose(); }}>
        <View style={[s.sheet, { backgroundColor: c.background }]}>
          <View style={s.handle} />
          <Text style={{ fontSize: 13, color: c.muted, textAlign: 'center', marginBottom: 10 }}>Notifications from {username}</Text>
          {pickKey ? (
            <>
              <TouchableOpacity style={s.row} onPress={() => setPickKey(null)}><Ionicons name="arrow-back" size={20} color={c.text} /><Text style={[s.lbl, { color: c.text, marginLeft: 10, fontWeight: '700' }]}>{pickKey}</Text></TouchableOpacity>
              {['All', 'Most relevant', 'Off'].map((opt) => (
                <TouchableOpacity key={opt} style={s.row} onPress={() => { onSetPref(pickKey, opt); setPickKey(null); }}>
                  <Text style={[s.lbl, { color: c.text }]}>{opt}</Text>
                  {(prefs[pickKey] || 'Most relevant') === opt && <Ionicons name="checkmark" size={20} color="#3B82F6" />}
                </TouchableOpacity>
              ))}
            </>
          ) : (
            cats.map((ct) => (
              <TouchableOpacity key={ct.k} style={s.row} onPress={() => setPickKey(ct.k)}>
                <Ionicons name={ct.ic as any} size={22} color={c.text} />
                <View style={{ flex: 1, marginLeft: 14 }}><Text style={{ fontSize: 15, fontWeight: '600', color: c.text }}>{ct.k}</Text><Text style={{ fontSize: 12, color: c.muted }}>{prefs[ct.k] || 'Most relevant'}</Text></View>
                <Ionicons name="chevron-forward" size={18} color={c.muted} />
              </TouchableOpacity>
            ))
          )}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function SuggestedFullModal({ visible, onClose, username, list, myFollowing, onFollow, onDismiss, onOpenUser, c }: any) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 46 }}>
        <View style={s.hdr}><TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity><Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>{username} · Suggested</Text><View style={{ width: 24 }} /></View>
        <FlatList data={list} keyExtractor={(i) => i.id} renderItem={({ item }) => {
          const isF = myFollowing.includes(item.id);
          return (
            <TouchableOpacity style={s.uRow} onPress={() => { onClose(); onOpenUser(item.id); }}>
              {item.photoUrl ? <Image source={{ uri: item.photoUrl }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={18} color="#fff" /></View>}
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '700', color: c.text }}>{item.username}</Text><Text style={{ fontSize: 12, color: c.muted }}>Suggested for you</Text></View>
              <TouchableOpacity style={[s.fBtn, { backgroundColor: isF ? c.input : '#3B82F6' }]} onPress={() => onFollow(item.id)}><Text style={{ color: isF ? c.text : '#fff', fontWeight: '700' }}>{isF ? 'Following' : 'Follow'}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => onDismiss(item.id)} style={{ padding: 6 }}><Ionicons name="close" size={18} color={c.muted} /></TouchableOpacity>
            </TouchableOpacity>
          );
        }} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingBottom: 28, paddingTop: 10 },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 },
  lbl: { flex: 1, fontSize: 15, fontWeight: '500' },
  uRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  av: { width: 46, height: 46, borderRadius: 23 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  fBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
});
              
