import React, { useEffect, useState } from 'react';
import { View, Text, Switch, TouchableOpacity, TextInput, StyleSheet, ScrollView, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut, sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, NEON } from '../constants/theme';
import { useLang, Lang } from '../constants/i18n';
import { GlossyIcon } from '../constants/GlossyIcon';

export default function SettingsScreen({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const { isDark, toggleTheme, c } = useTheme();
  const { lang, setLang } = useLang();
  const [search, setSearch] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [showOnline, setShowOnline] = useState(true);
  const [notifLikes, setNotifLikes] = useState(true);
  const [blocked, setBlocked] = useState<string[]>([]);
  const uid = auth.currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, 'users', uid)).then((snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setIsPrivate(!!d.isPrivate);
      setShowOnline(d.showOnline !== false);
      setNotifLikes(d.notifLikes !== false);
      if (d.language === 'English' || d.language === 'Hindi' || d.language === 'Hinglish') setLang(d.language);
      setBlocked(d.blockedUsers || []);
    }).catch(() => {});
  }, [uid]);

  const updatePref = (patch: Record<string, any>) => uid && updateDoc(doc(db, 'users', uid), patch).catch(() => {});
  const q = search.trim().toLowerCase();
  const show = (k: string) => !q || k.includes(q);

  const handleDelete = () => Alert.alert('Delete Account', 'This permanently deletes your account. Continue?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { if (uid) await deleteDoc(doc(db, 'users', uid)); if (auth.currentUser) await deleteUser(auth.currentUser); } catch { Alert.alert('Re-login Required', 'Please log out and log in again before deleting.'); } } },
  ]);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[s.hdr, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={() => (onClose ? onClose() : router.back())}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
        <Text style={{ color: c.text, fontSize: 18, fontWeight: '800' }}>Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <View style={[s.sBox, { backgroundColor: c.input, borderColor: c.border }]}>
          <Ionicons name="search" size={18} color={NEON.purple} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search settings..." placeholderTextColor={c.muted} style={{ flex: 1, color: c.text }} />
        </View>

        <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {show('dark appearance theme') && (
            <View style={s.row}><GlossyIcon name="moon" size={18} boxSize={36} accent={NEON.purple} /><Text style={[s.lbl, { color: c.text }]}>Dark Mode</Text><Switch value={isDark} onValueChange={toggleTheme} /></View>
          )}
          {show('private privacy') && (
            <View style={s.row}><GlossyIcon name="lock-closed" size={18} boxSize={36} accent={NEON.magenta} /><Text style={[s.lbl, { color: c.text }]}>Private Account</Text><Switch value={isPrivate} onValueChange={(v) => { setIsPrivate(v); updatePref({ isPrivate: v }); }} /></View>
          )}
          {show('online activity status') && (
            <View style={s.row}><GlossyIcon name="radio" size={18} boxSize={36} accent={NEON.pink} /><Text style={[s.lbl, { color: c.text }]}>Activity Status</Text><Switch value={showOnline} onValueChange={(v) => { setShowOnline(v); updatePref({ showOnline: v }); }} /></View>
          )}
          {show('notifications alerts') && (
            <View style={s.row}><GlossyIcon name="notifications" size={18} boxSize={36} accent={NEON.orange} /><Text style={[s.lbl, { color: c.text }]}>Push Notifications</Text><Switch value={notifLikes} onValueChange={(v) => { setNotifLikes(v); updatePref({ notifLikes: v }); }} /></View>
          )}
        </View>

        {show('language') && (
          <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
            <Text style={{ color: c.muted, fontSize: 12, fontWeight: '700', marginBottom: 8 }}>LANGUAGE</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {(['English', 'Hindi', 'Hinglish'] as Lang[]).map((l) => (
                <TouchableOpacity key={l} onPress={() => { setLang(l); updatePref({ language: l }); }} style={[s.langPill, { backgroundColor: lang === l ? NEON.purple : c.surface }]}>
                  <Text style={{ color: lang === l ? '#fff' : c.text, fontWeight: '700', fontSize: 13 }}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={[s.card, { backgroundColor: c.card, borderColor: c.border }]}>
          {show('blocked') && (
            <TouchableOpacity style={s.row} onPress={() => { updatePref({ blockedUsers: [] }); setBlocked([]); Alert.alert('Cleared', 'Blocked list cleared.'); }}>
              <GlossyIcon name="ban" size={18} boxSize={36} accent="#EF4444" /><Text style={[s.lbl, { color: c.text }]}>Blocked Users ({blocked.length})</Text><Text style={{ color: NEON.purple, fontWeight: '700' }}>Clear</Text>
            </TouchableOpacity>
          )}
          {show('password security') && (
            <TouchableOpacity style={s.row} onPress={() => auth.currentUser?.email && sendPasswordResetEmail(auth, auth.currentUser.email).then(() => Alert.alert('Sent', 'Password reset email sent.'))}>
              <GlossyIcon name="key" size={18} boxSize={36} accent={NEON.purple} /><Text style={[s.lbl, { color: c.text }]}>Reset Password</Text><Ionicons name="chevron-forward" size={18} color={c.muted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.row} onPress={() => signOut(auth)}>
            <GlossyIcon name="log-out" size={18} boxSize={36} accent={NEON.orange} /><Text style={[s.lbl, { color: c.text }]}>Log Out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.row} onPress={handleDelete}>
            <GlossyIcon name="trash" size={18} boxSize={36} accent="#EF4444" /><Text style={[s.lbl, { color: '#EF4444' }]}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingBottom: 14, paddingHorizontal: 16, borderBottomWidth: 0.5 },
  sBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, height: 44 },
  card: { borderRadius: 18, borderWidth: 1, padding: 12, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  lbl: { flex: 1, fontSize: 15, fontWeight: '700' },
  langPill: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center' },
});
