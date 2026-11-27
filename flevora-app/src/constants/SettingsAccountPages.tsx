import React, { useState } from 'react';
import {
  View, Text, Switch, TouchableOpacity, TextInput, ScrollView, StyleSheet,
  Alert, Linking, ActivityIndicator, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  EmailAuthProvider, reauthenticateWithCredential, updatePassword,
  sendPasswordResetEmail, signOut, deleteUser,
} from 'firebase/auth';
import {
  doc, updateDoc, deleteDoc, addDoc, collection, query, where, getDocs, serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND } from './theme';

export function AccountDetailsPage({ user, onOpenEdit }: { user: any; onOpenEdit?: () => void }) {
  const { c } = useTheme();
  const email = auth.currentUser?.email || user?.email || 'Not set';
  const joined = user?.createdAt?.toDate ? user.createdAt.toDate().toDateString() : 'Active member';

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      {[
        { label: 'Display Name', val: user?.fullName || 'Not set' },
        { label: 'Username', val: `@${user?.username || 'user'}` },
        { label: 'Email', val: email },
        { label: 'Account Privacy', val: user?.isPrivate ? 'Private Account' : 'Public Account' },
        { label: 'Account Type', val: (user?.accountType || 'personal').toUpperCase() },
        { label: 'Verified Status', val: user?.isVerified || user?.verified ? 'Verified' : 'Standard' },
        { label: 'Joined', val: joined },
      ].map((r) => (
        <View key={r.label} style={[styles.cardRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ color: c.muted, fontSize: 12 }}>{r.label}</Text>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 14, marginTop: 2 }}>{r.val}</Text>
        </View>
      ))}
      {onOpenEdit && (
        <TouchableOpacity onPress={onOpenEdit} style={[styles.btn, { backgroundColor: BRAND }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Edit Profile Information</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

export function PasswordSecurityPage({ user }: { user: any }) {
  const { c } = useTheme();
  const [curPass, setCurPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [saving, setSaving] = useState(false);

  const changePass = async () => {
    const u = auth.currentUser;
    if (!u || !u.email) return Alert.alert('Unavailable', 'Password change is available for email/password accounts.');
    if (newPass.length < 6) return Alert.alert('Weak Password', 'New password must be at least 6 characters.');
    setSaving(true);
    try {
      const cred = EmailAuthProvider.credential(u.email, curPass);
      await reauthenticateWithCredential(u, cred);
      await updatePassword(u, newPass);
      setCurPass('');
      setNewPass('');
      Alert.alert('Updated', 'Your password has been changed.');
    } catch {
      Alert.alert('Failed', 'Current password is incorrect or re-authentication failed.');
    } finally {
      setSaving(false);
    }
  };

  const sendReset = async () => {
    if (!auth.currentUser?.email) return;
    await sendPasswordResetEmail(auth, auth.currentUser.email);
    Alert.alert('Email Sent', `Reset link sent to ${auth.currentUser.email}.`);
  };

  const lastSeen = user?.lastSeen?.toDate ? user.lastSeen.toDate().toLocaleString() : 'Active now';

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={[styles.sec, { color: c.muted }]}>CHANGE PASSWORD</Text>
      <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Current Password" placeholderTextColor={c.muted} secureTextEntry value={curPass} onChangeText={setCurPass} />
      <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="New Password (min 6 chars)" placeholderTextColor={c.muted} secureTextEntry value={newPass} onChangeText={setNewPass} />
      <TouchableOpacity onPress={changePass} disabled={saving} style={[styles.btn, { backgroundColor: BRAND }]}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Update Password</Text>}
      </TouchableOpacity>
      <TouchableOpacity onPress={sendReset} style={[styles.btn, { backgroundColor: c.input }]}>
        <Text style={{ color: c.text, fontWeight: '700' }}>Send Password Reset Email</Text>
      </TouchableOpacity>
      <Text style={[styles.sec, { color: c.muted, marginTop: 10 }]}>LOGIN ACTIVITY</Text>
      <View style={[styles.cardRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={{ color: c.text, fontWeight: '700' }}>Current Session</Text>
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 2 }}>Last active: {lastSeen}</Text>
        <Text style={{ color: c.muted, fontSize: 12 }}>Status: {user?.isOnline ? 'Online' : 'Offline'}</Text>
      </View>
    </ScrollView>
  );
}

export function DeactivateDeletePage({ uid, onDone }: { uid: string; onDone: () => void }) {
  const { c } = useTheme();
  const [confirmPass, setConfirmPass] = useState('');
  const [busy, setBusy] = useState(false);

  const deactivate = () => {
    Alert.alert('Deactivate Account', 'Your profile and posts will be hidden until you log back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          await updateDoc(doc(db, 'users', uid), { status: 'deactivated', isOnline: false });
          onDone();
          await signOut(auth);
        },
      },
    ]);
  };

  const deleteForever = () => {
    Alert.alert('Delete Permanently?', 'All your posts, stories, and profile data will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Forever',
        style: 'destructive',
        onPress: async () => {
          const u = auth.currentUser;
          if (!u) return;
          setBusy(true);
          try {
            if (u.email && confirmPass) {
              await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, confirmPass));
            }
            const [pSnap, sSnap] = await Promise.all([
              getDocs(query(collection(db, 'posts'), where('uid', '==', uid))),
              getDocs(query(collection(db, 'stories'), where('uid', '==', uid))),
            ]);
            await Promise.all([...pSnap.docs.map((d) => deleteDoc(d.ref)), ...sSnap.docs.map((d) => deleteDoc(d.ref))]);
            await deleteDoc(doc(db, 'users', uid));
            await deleteUser(u);
            onDone();
          } catch {
            Alert.alert('Re-authentication Required', 'Enter your password above or log out and sign in again before deleting.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={[styles.cardRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>Temporary Deactivation</Text>
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Hides your account without deleting your posts. Logging back in reactivates your account.</Text>
        <TouchableOpacity onPress={deactivate} style={[styles.btn, { backgroundColor: '#F59E0B', marginTop: 10 }]}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Deactivate Account</Text>
        </TouchableOpacity>
      </View>
      <View style={[styles.cardRow, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 15 }}>Permanent Deletion</Text>
        <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Irreversible. Removes your profile, posts, and stories. Subcollection comments require admin/backend cleanup.</Text>
        <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text, marginTop: 10 }]} placeholder="Confirm Password (for email login)" placeholderTextColor={c.muted} secureTextEntry value={confirmPass} onChangeText={setConfirmPass} />
        <TouchableOpacity onPress={deleteForever} disabled={busy} style={[styles.btn, { backgroundColor: '#EF4444', marginTop: 8 }]}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Delete Account Permanently</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export function NotificationsPrefsPage({ user, updatePref }: { user: any; updatePref: (p: Record<string, any>) => Promise<void> }) {
  const { c } = useTheme();
  const [prefs, setPrefs] = useState({
    notifLikes: user?.notifLikes !== false,
    notifComments: user?.notifComments !== false,
    notifMentions: user?.notifMentions !== false,
    notifFollows: user?.notifFollows !== false,
    notifMessages: user?.notifMessages !== false,
    notifStories: user?.notifStories !== false,
  });

  const toggle = (key: keyof typeof prefs) => {
    const next = !prefs[key];
    setPrefs((p) => ({ ...p, [key]: next }));
    updatePref({ [key]: next });
  };

  const pauseHours = (hrs: number) => {
    const until = hrs > 0 ? Date.now() + hrs * 3600 * 1000 : 0;
    updatePref({ notifPausedUntil: until });
    Alert.alert(hrs > 0 ? 'Notifications Paused' : 'Resumed', hrs > 0 ? `Paused for ${hrs} hours.` : 'Notifications resumed.');
  };

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      {[
        { k: 'notifLikes', label: 'Likes' },
        { k: 'notifComments', label: 'Comments & Replies' },
        { k: 'notifMentions', label: 'Mentions & Tags' },
        { k: 'notifFollows', label: 'Followers & Follow Requests' },
        { k: 'notifMessages', label: 'Direct Messages' },
        { k: 'notifStories', label: 'Stories & Reels' },
      ].map((item) => (
        <View key={item.k} style={[styles.switchRow, { borderBottomColor: c.border }]}>
          <Text style={{ color: c.text, fontSize: 15 }}>{item.label}</Text>
          <Switch value={prefs[item.k as keyof typeof prefs]} onValueChange={() => toggle(item.k as keyof typeof prefs)} trackColor={{ true: BRAND }} />
        </View>
      ))}
      <Text style={[styles.sec, { color: c.muted, marginTop: 12 }]}>PAUSE PUSH NOTIFICATIONS</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TouchableOpacity onPress={() => pauseHours(1)} style={[styles.pill, { backgroundColor: c.input }]}><Text style={{ color: c.text, fontWeight: '700' }}>1h</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => pauseHours(8)} style={[styles.pill, { backgroundColor: c.input }]}><Text style={{ color: c.text, fontWeight: '700' }}>8h</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => pauseHours(0)} style={[styles.pill, { backgroundColor: BRAND }]}><Text style={{ color: '#fff', fontWeight: '700' }}>Resume</Text></TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export function TimeManagementPage({ user, updatePref }: { user: any; updatePref: (p: Record<string, any>) => Promise<void> }) {
  const { c } = useTheme();
  const [goal, setGoal] = useState<number>(user?.dailyTimeGoalMin || 0);
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={{ color: c.muted, fontSize: 13 }}>Set a daily reminder goal (saved to your account). Note: Android OS background usage tracking is not collected.</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {[0, 15, 30, 60, 120].map((m) => (
          <TouchableOpacity key={m} onPress={() => { setGoal(m); updatePref({ dailyTimeGoalMin: m }); }} style={[styles.pill, { backgroundColor: goal === m ? BRAND : c.input }]}>
            <Text style={{ color: goal === m ? '#fff' : c.text, fontWeight: '700' }}>{m === 0 ? 'Off' : `${m} min`}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

export function HelpSupportPage({ mode, uid }: { mode: 'help' | 'report' | 'about'; uid: string }) {
  const { c } = useTheme();
  const [faqQ, setFaqQ] = useState('');
  const [bug, setBug] = useState('');
  const faqs = [
    { q: 'How do I make my account private?', a: 'Go to Settings and activity → Account Privacy → Toggle Private Account ON.' },
    { q: 'How do I unblock someone?', a: 'Go to Settings and activity → Blocked Accounts → Tap Unblock.' },
    { q: 'How do I download my data?', a: 'Go to Settings and activity → Download Your Information.' },
  ].filter((f) => !faqQ.trim() || f.q.toLowerCase().includes(faqQ.toLowerCase()));

  if (mode === 'report') {
    return (
      <View style={styles.pad}>
        <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text, minHeight: 110 }]} multiline placeholder="Describe the technical problem..." placeholderTextColor={c.muted} value={bug} onChangeText={setBug} />
        <TouchableOpacity style={[styles.btn, { backgroundColor: BRAND }]} onPress={async () => {
          if (!bug.trim()) return;
          await addDoc(collection(db, 'reports'), { type: 'problem', reason: bug.trim(), reporterUid: uid, reportedBy: uid, status: 'pending', createdAt: serverTimestamp() });
          setBug('');
          Alert.alert('Sent', 'Your report has been submitted.');
        }}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Submit Report</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (mode === 'about') {
    return (
      <ScrollView contentContainerStyle={styles.pad}>
        <View style={[styles.cardRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>Flevora</Text>
          <Text style={{ color: c.muted, marginTop: 4 }}>Version 1.0.0 • Expo SDK 58 • Firebase + Cloudinary</Text>
        </View>
        <TouchableOpacity onPress={() => Linking.openSettings()} style={[styles.btn, { backgroundColor: c.input }]}>
          <Text style={{ color: c.text, fontWeight: '700' }}>Open Android App Permissions</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} placeholder="Search help topics..." placeholderTextColor={c.muted} value={faqQ} onChangeText={setFaqQ} />
      {faqs.map((f) => (
        <View key={f.q} style={[styles.cardRow, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={{ color: c.text, fontWeight: '700' }}>{f.q}</Text>
          <Text style={{ color: c.muted, fontSize: 13, marginTop: 4 }}>{f.a}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

export async function exportUserInformation(uid: string) {
  const [uSnap, pSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), where('uid', '==', uid))),
    getDocs(query(collection(db, 'posts'), where('uid', '==', uid))),
  ]);
  const payload = {
    profile: uSnap.docs[0]?.data() || {},
    posts: pSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    exportedAt: new Date().toISOString(),
  };
  await Share.share({ message: JSON.stringify(payload, null, 2), title: 'Flevora Data Export' });
}

const styles = StyleSheet.create({
  pad: { padding: 16, gap: 12 },
  sec: { fontSize: 11, fontWeight: '800' },
  cardRow: { padding: 14, borderRadius: 12, borderWidth: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  pill: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', minWidth: 64 },
});
         
