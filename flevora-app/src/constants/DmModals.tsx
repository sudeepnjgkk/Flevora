import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput, FlatList, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BRAND, BRAND_TEXT } from './theme';

export function AccountSwitcherModal({ visible, accounts, currentUid, c, onClose, onAdd }: any) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          <Text style={[s.title, { color: c.text }]}>Switch Account</Text>
          {(accounts || []).map((a: any) => (
            <View key={a.uid} style={s.row}>
              {a.photoUrl ? <Image source={{ uri: a.photoUrl }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={18} color={BRAND_TEXT} /></View>}
              <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>{a.username}</Text>
              {a.uid === currentUid && <Ionicons name="checkmark-circle" size={22} color={BRAND} />}
            </View>
          ))}
          <TouchableOpacity style={s.row} onPress={() => { onClose(); onAdd?.(); }}>
            <Ionicons name="add-circle-outline" size={26} color={BRAND} /><Text style={{ color: BRAND, fontWeight: '700' }}>Log in to another account</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function SelectMoreModal({ visible, c, onClose, onAction }: any) {
  const opts = [
    ['pin', 'Pin / Unpin'], ['move', 'Move Primary / General'], ['unread', 'Mark as unread'],
    ['followup', 'Mark Follow up'], ['muteMsg', 'Mute / Unmute notifications'], ['block', 'Block user'], ['delete', 'Delete from Inbox'],
  ];
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          {opts.map(([k, l]) => (
            <TouchableOpacity key={k} style={s.row} onPress={() => { onClose(); onAction(k); }}>
              <Text style={{ color: k === 'block' || k === 'delete' ? '#EF4444' : c.text, fontWeight: '700', fontSize: 15 }}>{l}</Text>
            </TouchableOpacity>
          ))}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function NewChatModal({ visible, users, c, onClose, onPick, onCreateGroup }: any) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const filtered = (users || []).filter((u: any) => (u.username || '').toLowerCase().includes(q.toLowerCase()) || (u.fullName || '').toLowerCase().includes(q.toLowerCase()));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.full, { backgroundColor: c.background }]}>
        <View style={s.hdr}>
          <TouchableOpacity onPress={onClose}><Ionicons name="close" size={26} color={c.text} /></TouchableOpacity>
          <Text style={{ color: c.text, fontSize: 17, fontWeight: '800' }}>New Message</Text>
          {picked.length >= 2 ? (
            <TouchableOpacity onPress={() => { onCreateGroup?.(picked, groupName.trim() || 'Group Chat', groupDesc.trim()); setPicked([]); setGroupName(''); setGroupDesc(''); onClose(); }}>
              <Text style={{ color: BRAND, fontWeight: '800', fontSize: 15 }}>Create</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 44 }} />}
        </View>
        <TextInput value={q} onChangeText={setQ} placeholder="Search people..." placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input }]} />
        {picked.length >= 2 && (
          <>
            <TextInput value={groupName} onChangeText={setGroupName} placeholder="Group name (required)..." placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input }]} />
            <TextInput value={groupDesc} onChangeText={setGroupDesc} placeholder="Group description (optional)..." placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input }]} />
          </>
        )}
        <FlatList data={filtered} keyExtractor={(u) => u.id} renderItem={({ item }) => {
          const sel = picked.includes(item.id);
          return (
            <TouchableOpacity style={s.row} onPress={() => (picked.length ? toggle(item.id) : onPick?.(item))} onLongPress={() => toggle(item.id)}>
              {item.photoUrl || item.avatar ? <Image source={{ uri: item.photoUrl || item.avatar }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={18} color={BRAND_TEXT} /></View>}
              <View style={{ flex: 1 }}><Text style={{ color: c.text, fontWeight: '700' }}>@{item.username}</Text>{!!item.fullName && <Text style={{ color: c.muted, fontSize: 12 }}>{item.fullName}</Text>}</View>
              <TouchableOpacity onPress={() => toggle(item.id)}><Ionicons name={sel ? 'checkbox' : 'square-outline'} size={22} color={sel ? BRAND : c.muted} /></TouchableOpacity>
            </TouchableOpacity>
          );
        }} />
      </View>
    </Modal>
  );
}

export function ForwardModal({ visible, users, c, onClose, onForwardTo }: any) {
  const [q, setQ] = useState('');
  const filtered = (users || []).filter((u: any) => (u.username || '').toLowerCase().includes(q.toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card, maxHeight: '70%' }]}>
          <View style={s.handle} />
          <Text style={[s.title, { color: c.text }]}>Forward To</Text>
          <TextInput value={q} onChangeText={setQ} placeholder="Search user..." placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input }]} />
          <FlatList data={filtered} keyExtractor={(u) => u.id} renderItem={({ item }) => (
            <TouchableOpacity style={s.row} onPress={() => { onForwardTo(item); onClose(); }}>
              {item.photoUrl || item.avatar ? <Image source={{ uri: item.photoUrl || item.avatar }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="person" size={18} color={BRAND_TEXT} /></View>}
              <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>@{item.username}</Text>
              <View style={{ backgroundColor: BRAND, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}><Text style={{ color: BRAND_TEXT, fontWeight: '800', fontSize: 12 }}>Send</Text></View>
            </TouchableOpacity>
          )} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export function PollModal({ visible, c, onClose, onCreate }: any) {
  const [q, setQ] = useState('');
  const [o1, setO1] = useState('');
  const [o2, setO2] = useState('');
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.handle} />
          <Text style={[s.title, { color: c.text }]}>Create Poll</Text>
          <TextInput value={q} onChangeText={setQ} placeholder="Ask a question..." placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input }]} />
          <TextInput value={o1} onChangeText={setO1} placeholder="Option 1" placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input }]} />
          <TextInput value={o2} onChangeText={setO2} placeholder="Option 2" placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input }]} />
          <TouchableOpacity style={[s.btn, { backgroundColor: BRAND }]} onPress={() => {
            if (!q.trim()) return;
            onCreate({ question: q.trim(), options: [o1.trim() || 'Yes', o2.trim() || 'No'] });
            setQ(''); setO1(''); setO2(''); onClose();
          }}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Send Poll</Text></TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 16, paddingBottom: 28 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#888', alignSelf: 'center', marginBottom: 12 },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center', marginBottom: 12 },
  full: { flex: 1, paddingTop: 48, paddingHorizontal: 16 },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  inp: { borderRadius: 12, padding: 12, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  av: { width: 42, height: 42, borderRadius: 21 },
  btn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginTop: 4 },
});
