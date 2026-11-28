import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, Image, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND, BRAND_TEXT } from './theme';

export function StoryActivityModal({ visible, onClose, story, allUsers, allStories, onOpenSettings, onDelete, onNewStory, onDmUser }: any) {
  const { c } = useTheme();
  const [tab, setTab] = useState<'viewers' | 'insights'>('viewers');
  const viewers: string[] = story?.viewers || [];
  const likes: string[] = story?.likes || [];
  const reacts: any[] = story?.reactions || [];
  const qResps: any[] = Array.isArray(story?.questionResponses) ? story.questionResponses : [];
  const vUsers = allUsers.filter((u: any) => viewers.includes(u.id));
  const interactions = likes.length + reacts.length + (story?.comments || []).length + qResps.length;

  const confirmDel = () => Alert.alert('Delete this story?', 'It will be permanently deleted.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => { onClose(); onDelete(); } },
  ]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 46 }}>
        <View style={s.hdr}>
          <TouchableOpacity onPress={onOpenSettings}><Ionicons name="settings-outline" size={24} color={c.text} /></TouchableOpacity>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color={c.text} /></TouchableOpacity>
        </View>

        <View style={s.previewRow}>
          <View style={s.thumbBox}>
            {story?.mediaUrl ? <Image source={{ uri: story.mediaUrl }} style={s.thumb} /> : <View style={[s.thumb, { backgroundColor: story?.bgColor || '#111' }]} />}
            <Text style={s.thumbCnt}>👁 {viewers.length}</Text>
          </View>
          <TouchableOpacity style={s.camCard} onPress={() => { onClose(); onNewStory(); }}><Ionicons name="camera-outline" size={28} color="#fff" /></TouchableOpacity>
        </View>

        <View style={[s.tabBar, { borderColor: c.border }]}>
          <TouchableOpacity style={[s.tBtn, tab === 'insights' && { borderBottomWidth: 2, borderColor: BRAND }]} onPress={() => setTab('insights')}>
            <Ionicons name="bar-chart-outline" size={21} color={tab === 'insights' ? c.text : c.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={[s.tBtn, tab === 'viewers' && { borderBottomWidth: 2, borderColor: BRAND }]} onPress={() => setTab('viewers')}>
            <Text style={{ fontWeight: '700', color: tab === 'viewers' ? c.text : c.muted }}>👥 {viewers.length}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={confirmDel} style={{ padding: 12 }}><Ionicons name="trash-outline" size={22} color={c.text} /></TouchableOpacity>
        </View>

        {tab === 'viewers' ? (
          <FlatList
            data={vUsers} keyExtractor={(i) => i.id}
            ListHeaderComponent={<Text style={{ fontWeight: '700', fontSize: 15, padding: 16, color: c.text }}>Who viewed your story</Text>}
            ListEmptyComponent={<Text style={{ textAlign: 'center', color: c.muted, marginTop: 40 }}>No views yet</Text>}
            renderItem={({ item }) => {
              const liked = likes.includes(item.id);
              const rObj = reacts.find((r) => r.uid === item.id);
              const hasSt = allStories.some((st: any) => st.uid === item.id);
              return (
                <View style={s.vRow}>
                  <View style={{ position: 'relative' }}>
                    <View style={[s.ring, hasSt && { borderColor: BRAND, borderWidth: 2 }]}>
                      {item.photoUrl || item.avatar ? <Image source={{ uri: item.photoUrl || item.avatar }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={18} color={BRAND_TEXT} /></View>}
                    </View>
                    {liked && <View style={s.heartBadge}><Ionicons name="heart" size={11} color="#fff" /></View>}
                    {!!rObj?.emoji && <Text style={s.emoBadge}>{rObj.emoji}</Text>}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontWeight: '700', color: c.text }}>@{item.username}</Text>
                    <Text style={{ fontSize: 12, color: c.muted }}>{item.fullName || item.name || ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { onClose(); onDmUser(item); }}><Ionicons name="paper-plane-outline" size={21} color={c.text} /></TouchableOpacity>
                </View>
              );
            }}
          />
        ) : (
          <FlatList
            data={qResps}
            keyExtractor={(i, idx) => i.id || String(idx)}
            contentContainerStyle={{ padding: 18 }}
            ListHeaderComponent={(
              <View>
                <Text style={{ fontSize: 16, fontWeight: '700', marginBottom: 12, color: c.text }}>Overview</Text>
                {[['Views', viewers.length], ['Interactions', interactions], ['Likes', likes.length], ['Reactions', reacts.length], ['Comments', (story?.comments || []).length], ['Question Responses', qResps.length]].map(([k, v]) => (
                  <View key={String(k)} style={[s.statRow, { borderColor: c.border }]}>
                    <Text style={{ fontSize: 15, color: c.text }}>{k}</Text>
                    <Text style={{ fontWeight: '700', fontSize: 15, color: c.text }}>{v}</Text>
                  </View>
                ))}
                {qResps.length > 0 && <Text style={{ fontSize: 15, fontWeight: '700', marginTop: 18, marginBottom: 8, color: c.text }}>Private Question Responses</Text>}
              </View>
            )}
            renderItem={({ item }) => {
              const sender = allUsers.find((u: any) => u.id === item.uid);
              return (
                <View style={[s.qCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700' }}>@{sender?.username || 'user'}</Text>
                  <Text style={{ color: c.text, fontSize: 14, marginTop: 2 }}>{item.text}</Text>
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  hdr: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  previewRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, paddingBottom: 16 },
  thumbBox: { width: 90, height: 140, borderRadius: 10, overflow: 'hidden', backgroundColor: '#111' },
  thumb: { width: '100%', height: '100%' },
  thumbCnt: { position: 'absolute', bottom: 4, alignSelf: 'center', color: '#fff', fontSize: 11, fontWeight: '700', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 6, borderRadius: 6 },
  camCard: { width: 70, height: 110, borderRadius: 10, backgroundColor: '#111', alignItems: 'center', justifyContent: 'center' },
  tabBar: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 0.5, paddingHorizontal: 8 },
  tBtn: { paddingHorizontal: 18, paddingVertical: 12 },
  vRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  ring: { padding: 2, borderRadius: 26 }, av: { width: 44, height: 44, borderRadius: 22 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  heartBadge: { position: 'absolute', right: -2, bottom: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#EC4899', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  emoBadge: { position: 'absolute', left: -2, bottom: -2, fontSize: 14 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5 },
  qCard: { padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 8 },
});
