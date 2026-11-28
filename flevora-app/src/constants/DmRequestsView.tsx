import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, FlatList, Image, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND, BRAND_TEXT } from './theme';

export function DmRequestsView({
  users, spamUsers = [], spamView, setSpamView, onBack, onOpen, onAccept, onDeleteReq, onBlockReq, onReportReq, c,
}: any) {
  const [hideBanner, setHideBanner] = useState(false);
  const [q, setQ] = useState('');
  const source = spamView ? spamUsers : users;
  const filtered = (source || []).filter((u: any) => !q.trim() || (u.username || '').toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => (spamView ? setSpamView(false) : onBack())}>
          <Ionicons name="arrow-back" size={24} color={c.text} />
        </TouchableOpacity>
        <Text style={[s.title, { color: c.text }]}>{spamView ? 'Spam Requests' : 'Message requests'}</Text>
        <View style={{ width: 24 }} />
      </View>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Search requests..."
        placeholderTextColor={c.muted}
        style={[s.search, { backgroundColor: c.input, color: c.text }]}
      />

      {!hideBanner && !spamView && (
        <View style={[s.banner, { backgroundColor: c.card }]}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: c.text }}>Hidden requests is now called Spam</Text>
            <Text style={{ fontSize: 12, color: c.muted, marginTop: 2 }}>Deleted or suspicious requests can be managed here.</Text>
          </View>
          <TouchableOpacity onPress={() => setHideBanner(true)}><Ionicons name="close" size={18} color={c.muted} /></TouchableOpacity>
        </View>
      )}

      {!spamView && (
        <TouchableOpacity style={s.spamRow} onPress={() => setSpamView(true)}>
          <Ionicons name="eye-off-outline" size={22} color={c.text} />
          <Text style={{ flex: 1, marginLeft: 12, fontWeight: '600', color: c.text }}>Spam</Text>
          <Text style={{ color: c.muted }}>{spamUsers.length} ›</Text>
        </TouchableOpacity>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={[s.circle, { borderColor: c.border }]}><Ionicons name="paper-plane-outline" size={34} color={c.text} /></View>
            <Text style={{ fontSize: 18, fontWeight: '700', color: c.text, marginTop: 14 }}>No {spamView ? 'spam' : 'message'} requests</Text>
            <Text style={{ color: c.muted, textAlign: 'center', marginTop: 6 }}>Control who can send you message requests in Settings.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={s.row} onPress={() => onOpen(item)}>
            {item.photoUrl || item.avatar ? <Image source={{ uri: item.photoUrl || item.avatar }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={20} color={BRAND_TEXT} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: c.text }}>@{item.username}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>Wants to send you a message</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: BRAND }]} onPress={() => onAccept(item.id)}>
                <Text style={{ color: BRAND_TEXT, fontWeight: '800', fontSize: 12 }}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btn, { backgroundColor: c.input }]}
                onPress={() => Alert.alert(`@${item.username}`, 'Choose action:', [
                  { text: 'Delete Request', onPress: () => onDeleteReq?.(item.id) },
                  { text: 'Block User', style: 'destructive', onPress: () => onBlockReq?.(item.id) },
                  { text: 'Report', style: 'destructive', onPress: () => onReportReq?.(item.id) },
                  { text: 'Cancel', style: 'cancel' },
                ])}
              >
                <Ionicons name="ellipsis-horizontal" size={16} color={c.text} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 48, paddingBottom: 10, paddingHorizontal: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  search: { marginHorizontal: 14, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 },
  banner: { flexDirection: 'row', marginHorizontal: 14, marginBottom: 8, padding: 14, borderRadius: 12, alignItems: 'center' },
  spamRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  av: { width: 50, height: 50, borderRadius: 25 },
  ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  btn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 60 },
  circle: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
