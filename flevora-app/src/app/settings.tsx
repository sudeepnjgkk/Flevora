import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, TouchableOpacity, ScrollView, StyleSheet, Alert, Share, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut, deleteUser } from 'firebase/auth';
import { doc, getDoc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme } from '../constants/theme';
import { useLang, Lang } from '../constants/i18n';

export default function SettingsScreen(props: any) {
  const onClose = props?.onClose;
  const router = useRouter();
  const { isDark, toggleTheme, c } = useTheme();
  const { lang, setLang } = useLang();
  const uid = auth.currentUser?.uid || '';
  const [q, setQ] = useState('');
  const [user, setUser] = useState<any>({});
  const [wordModal, setWordModal] = useState(false);
  const [word, setWord] = useState('');

  useEffect(() => {
    if (uid) getDoc(doc(db, 'users', uid)).then((s) => s.exists() && setUser(s.data()));
  }, [uid]);

  const setPref = async (patch: Record<string, any>) => {
    setUser((p: any) => ({ ...p, ...patch }));
    if (uid) await updateDoc(doc(db, 'users', uid), patch);
  };

  const handleDelete = () => {
    Alert.alert('Delete Account', 'Saari posts, stories aur account permanently delete ho jayenge. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          for (const col of ['posts', 'stories']) {
            const snap = await getDocs(query(collection(db, col), where('uid', '==', uid)));
            for (const d of snap.docs) await deleteDoc(d.ref);
          }
          for (const fld of ['toUid', 'fromUid']) {
            const snap = await getDocs(query(collection(db, 'notifications'), where(fld, '==', uid)));
            for (const d of snap.docs) await deleteDoc(d.ref);
          }
          await deleteDoc(doc(db, 'users', uid));
          if (auth.currentUser) await deleteUser(auth.currentUser);
        } catch (e: any) { Alert.alert('Re-login Required', e?.message || 'Please log out and log in again to delete.'); }
      }},
    ]);
  };

  const sections = [
    { title: 'How you use Flevora', items: [
      { label: 'Saved', icon: 'bookmark-outline', onPress: () => { if (onClose) onClose(); router.push('/explore'); } },
      { label: 'Archive', icon: 'time-outline', onPress: () => Alert.alert('Archive', 'Your archived stories & posts appear here.') },
      { label: 'Your activity', icon: 'pulse-outline', onPress: () => Alert.alert('Your activity', `Followers: ${(user.followers || []).length} | Saved: ${(user.savedPosts || []).length}`) },
      { label: 'Notifications (Likes & Comments)', icon: 'notifications-outline', sw: user.notifLikes !== false, onSw: (v: boolean) => setPref({ notifLikes: v, notifComments: v }) },
      { label: 'Time management', icon: 'hourglass-outline', onPress: () => Alert.alert('Time management', 'Daily reminder active: Take breaks while scrolling.') },
    ]},
    { title: 'Your insights and tools', items: [
      { label: 'Professional dashboard', icon: 'bar-chart-outline', sw: user.proDashboard !== false, onSw: (v: boolean) => setPref({ proDashboard: v }) },
      { label: 'Profile type and tools', icon: 'stats-chart-outline', val: user.category || 'Creator', onPress: () => setPref({ category: user.category === 'Creator' ? 'Business' : user.category === 'Business' ? 'Personal' : 'Creator' }) },
      { label: 'Ads payments', icon: 'card-outline', onPress: () => Alert.alert('Ads payments', 'Free tier par paid ads billing disabled hai.') },
    ]},
    { title: 'Who can see your content', items: [
      { label: 'Profile privacy (Private)', icon: 'lock-closed-outline', sw: !!user.isPrivate, onSw: (v: boolean) => setPref({ isPrivate: v }) },
      { label: 'Close Friends', icon: 'star-outline', val: String((user.closeFriends || []).length), onPress: () => Alert.alert('Close Friends', 'Story upload karte waqt Close Friends select karein.') },
      { label: 'Blocked', icon: 'ban-outline', val: String((user.blockedUsers || []).length), onPress: () => (user.blockedUsers || []).length ? setPref({ blockedUsers: [] }) : Alert.alert('Blocked', 'Koi blocked user nahi hai.') },
      { label: 'Story, live and location (Online)', icon: 'radio-outline', sw: user.showOnline !== false, onSw: (v: boolean) => setPref({ showOnline: v }) },
    ]},
    { title: 'How others can interact with you', items: [
      { label: 'Messages and story replies', icon: 'paper-plane-outline', onPress: () => setPref({ allowMsgReq: user.allowMsgReq === false }) },
      { label: 'Comments & Hidden Words', icon: 'text-outline', val: String((user.hiddenWords || []).length), onPress: () => setWordModal(true) },
      { label: 'Limit interactions', icon: 'alert-circle-outline', sw: !!user.limitInteractions, onSw: (v: boolean) => setPref({ limitInteractions: v }) },
      { label: 'Follow and invite friends', icon: 'person-add-outline', onPress: () => Share.share({ message: 'Join me on Flevora!' }) },
    ]},
    { title: 'What you see & media', items: [
      { label: 'Hide like and share counts', icon: 'heart-dislike-outline', sw: !!user.hideCounts, onSw: (v: boolean) => setPref({ hideCounts: v }) },
      { label: 'Dark mode (Accessibility)', icon: 'contrast-outline', sw: isDark, onSw: toggleTheme },
      { label: 'Language and translations', icon: 'language-outline', val: lang, onPress: () => { const ls: Lang[] = ['English', 'Hindi', 'Hinglish']; const n = ls[(ls.indexOf(lang) + 1) % ls.length]; setLang(n); setPref({ language: n }); } },
    ]},
    { title: 'Family Center & Support', items: [
      { label: 'Supervision for Teen Accounts', icon: 'people-outline', onPress: () => Alert.alert('Family Center', 'Teen safety filters are active.') },
      { label: 'Help & Support', icon: 'help-buoy-outline', onPress: () => Alert.alert('Support', 'Contact: deepakk770485@gmail.com') },
      { label: 'Privacy Center & About', icon: 'shield-checkmark-outline', onPress: () => Alert.alert('Flevora', 'Version 1.0 · Privacy & Terms active.') },
      { label: 'Delete account permanently', icon: 'trash-outline', danger: true, onPress: handleDelete },
    ]},
  ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background, paddingTop: 46 }}>
      <View style={s.hdr}>
        <TouchableOpacity onPress={() => (onClose ? onClose() : router.back())}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: c.text }}>Settings and activity</Text>
        <View style={{ width: 24 }} />
      </View>
      <View style={[s.sBox, { backgroundColor: c.input }]}><Ionicons name="search" size={17} color={c.muted} /><TextInput value={q} onChangeText={setQ} placeholder="Search" placeholderTextColor={c.muted} style={{ flex: 1, marginLeft: 8, color: c.text }} /></View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {sections.map((sec) => {
          const fil = sec.items.filter((it: any) => it.label.toLowerCase().includes(q.toLowerCase()));
          if (!fil.length) return null;
          return (
            <View key={sec.title} style={{ borderBottomWidth: 0.5, borderColor: c.border, paddingVertical: 8 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: c.muted, paddingHorizontal: 16, paddingVertical: 6 }}>{sec.title}</Text>
              {fil.map((it: any) => (
                <TouchableOpacity key={it.label} style={s.row} disabled={it.sw !== undefined} onPress={it.onPress}>
                  <Ionicons name={it.icon} size={21} color={it.danger ? '#EF4444' : c.text} />
                  <Text style={{ flex: 1, marginLeft: 14, fontSize: 15, color: it.danger ? '#EF4444' : c.text }}>{it.label}</Text>
                  {it.val ? <Text style={{ color: c.muted, marginRight: 6 }}>{it.val}</Text> : null}
                  {it.sw !== undefined ? <Switch value={it.sw} onValueChange={it.onSw} /> : <Ionicons name="chevron-forward" size={18} color={c.muted} />}
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
        <View style={{ padding: 16, gap: 16 }}>
          <TouchableOpacity onPress={() => signOut(auth)}><Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 15 }}>Add profile</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => signOut(auth)}><Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 15 }}>Log out</Text></TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={wordModal} transparent animationType="fade" onRequestClose={() => setWordModal(false)}>
        <View style={s.mBg}><View style={[s.mCard, { backgroundColor: c.background }]}>
          <Text style={{ fontWeight: '700', fontSize: 16, color: c.text, marginBottom: 8 }}>Hidden Words</Text>
          <TextInput value={word} onChangeText={setWord} placeholder="Add offensive word..." placeholderTextColor={c.muted} style={{ backgroundColor: c.input, color: c.text, borderRadius: 10, padding: 10 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 14, marginTop: 12 }}>
            <TouchableOpacity onPress={() => setWordModal(false)}><Text style={{ color: c.muted }}>Close</Text></TouchableOpacity>
            <TouchableOpacity onPress={async () => { if (word.trim()) { await setPref({ hiddenWords: [...(user.hiddenWords || []), word.trim()] }); setWord(''); } setWordModal(false); }}><Text style={{ color: '#3B82F6', fontWeight: '700' }}>Add</Text></TouchableOpacity>
          </View>
        </View></View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 10 },
  sBox: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  mCard: { width: '82%', borderRadius: 16, padding: 18 },
});
