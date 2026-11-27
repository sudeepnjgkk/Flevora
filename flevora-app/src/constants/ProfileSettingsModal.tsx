import React, { useEffect, useState } from 'react';
import {
  View, Text, Modal, Switch, TouchableOpacity, ScrollView, StyleSheet, Alert, Share, TextInput, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { signOut, sendPasswordResetEmail, deleteUser } from 'firebase/auth';
import { doc, getDoc, updateDoc, deleteDoc, arrayRemove, addDoc, collection, query, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND } from './theme';
import { useLang, Lang } from './i18n';
import { fetchUsersByIds } from './profileHelpers';

export function ProfileSettingsModal({
  visible, onClose, onOpenEdit, onOpenRequests,
}: {
  visible: boolean;
  onClose: () => void;
  onOpenEdit?: () => void;
  onOpenRequests?: () => void;
}) {
  const { isDark, toggleTheme, c } = useTheme();
  const { lang, setLang, t } = useLang();
  const uid = auth.currentUser?.uid || '';

  const [userData, setUserData] = useState<any>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [showOnline, setShowOnline] = useState(true);
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [commentsControl, setCommentsControl] = useState<'everyone' | 'followers' | 'off'>('everyone');
  const [allowTags, setAllowTags] = useState<'everyone' | 'following' | 'none'>('everyone');
  const [hiddenWords, setHiddenWords] = useState('');
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [mutedUsers, setMutedUsers] = useState<any[]>([]);
  const [subView, setSubView] = useState<'main' | 'blocked' | 'muted' | 'hiddenWords' | 'report'>('main');
  const [bugText, setBugText] = useState('');

  useEffect(() => {
    if (!visible || !uid) return;
    setSubView('main');
    getDoc(doc(db, 'users', uid)).then(async (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      setUserData(d);
      setIsPrivate(!!d.isPrivate);
      setShowOnline(d.showOnline !== false);
      setNotifLikes(d.notifLikes !== false);
      setNotifComments(d.notifComments !== false);
      setCommentsControl(d.commentsControl || 'everyone');
      setAllowTags(d.allowTags || 'everyone');
      setHiddenWords(Array.isArray(d.hiddenWords) ? d.hiddenWords.join(', ') : '');
      if (d.language === 'English' || d.language === 'Hindi' || d.language === 'Hinglish') setLang(d.language);
      if (Array.isArray(d.blockedUsers) && d.blockedUsers.length) setBlockedUsers(await fetchUsersByIds(d.blockedUsers));
      else setBlockedUsers([]);
      if (Array.isArray(d.mutedUsers) && d.mutedUsers.length) setMutedUsers(await fetchUsersByIds(d.mutedUsers));
      else setMutedUsers([]);
    });
  }, [visible, uid]);

  const updatePref = async (patch: Record<string, any>) => {
    if (uid) await updateDoc(doc(db, 'users', uid), patch).catch(() => {});
  };

  const handlePasswordReset = async () => {
    const email = auth.currentUser?.email;
    if (!email) return;
    await sendPasswordResetEmail(auth, email);
    Alert.alert('Email Sent', `Password reset link sent to ${email}.`);
  };

  const downloadMyData = async () => {
    if (!uid) return;
    const [uSnap, pSnap] = await Promise.all([
      getDoc(doc(db, 'users', uid)),
      getDocs(query(collection(db, 'posts'), where('uid', '==', uid))),
    ]);
    const payload = { profile: uSnap.data() || {}, posts: pSnap.docs.map((d) => ({ id: d.id, ...d.data() })), exportedAt: new Date().toISOString() };
    await Share.share({ message: JSON.stringify(payload, null, 2), title: 'Flevora Data Export' });
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out of Flevora?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          onClose();
          await updatePref({ isOnline: false });
          await signOut(auth);
        },
      },
    ]);
  };

  const deactivateAccount = () => {
    Alert.alert('Deactivate Account', 'Hide your profile until you sign back in?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: async () => {
          await updatePref({ status: 'deactivated', isOnline: false });
          onClose();
          await signOut(auth);
        },
      },
    ]);
  };

  const deleteAccount = () => {
    Alert.alert('Delete Account', 'Permanently delete your account, posts, and stories?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Forever',
        style: 'destructive',
        onPress: async () => {
          try {
            if (!uid || !auth.currentUser) return;
            const [pSnap, sSnap] = await Promise.all([
              getDocs(query(collection(db, 'posts'), where('uid', '==', uid))),
              getDocs(query(collection(db, 'stories'), where('uid', '==', uid))),
            ]);
            await Promise.all([...pSnap.docs.map((d) => deleteDoc(d.ref)), ...sSnap.docs.map((d) => deleteDoc(d.ref))]);
            await deleteDoc(doc(db, 'users', uid));
            await deleteUser(auth.currentUser);
            onClose();
          } catch {
            Alert.alert('Re-login Required', 'Please log out and sign in again before deleting your account.');
          }
        },
      },
    ]);
  };

  const submitBug = async () => {
    if (!bugText.trim()) return;
    await addDoc(collection(db, 'reports'), {
      type: 'problem', reason: bugText.trim(), reporterUid: uid, reportedBy: uid, status: 'pending', createdAt: serverTimestamp(),
    });
    setBugText('');
    setSubView('main');
    Alert.alert('Submitted', 'Thank you for reporting this issue.');
  };

  const cycle = <T extends string>(arr: T[], cur: T): T => arr[(arr.indexOf(cur) + 1) % arr.length];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => subView !== 'main' ? setSubView('main') : onClose()}>
      <View style={[styles.wrap, { backgroundColor: c.background }]}>
        <View style={[styles.header, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={() => subView !== 'main' ? setSubView('main') : onClose()}>
            <Ionicons name="arrow-back" size={24} color={c.text} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: c.text }]}>
            {subView === 'blocked' ? 'Blocked Accounts' : subView === 'muted' ? 'Muted Accounts' : subView === 'hiddenWords' ? 'Hidden Words' : subView === 'report' ? 'Report a Problem' : t.settings}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {subView === 'blocked' ? (
          <ScrollView contentContainerStyle={{ padding: 14 }}>
            {blockedUsers.length === 0 ? <Text style={{ color: c.muted, textAlign: 'center', marginTop: 30 }}>No blocked accounts.</Text> : blockedUsers.map((u) => (
              <View key={u.id} style={[styles.row, { borderBottomColor: c.border }]}>
                <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>@{u.username}</Text>
                <TouchableOpacity onPress={() => Alert.alert('Unblock', `Unblock @${u.username}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Unblock', onPress: async () => { await updatePref({ blockedUsers: arrayRemove(u.id) }); setBlockedUsers((p) => p.filter((x) => x.id !== u.id)); } },
                ])}>
                  <Text style={{ color: BRAND, fontWeight: '700' }}>Unblock</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : subView === 'muted' ? (
          <ScrollView contentContainerStyle={{ padding: 14 }}>
            {mutedUsers.length === 0 ? <Text style={{ color: c.muted, textAlign: 'center', marginTop: 30 }}>No muted accounts.</Text> : mutedUsers.map((u) => (
              <View key={u.id} style={[styles.row, { borderBottomColor: c.border }]}>
                <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>@{u.username}</Text>
                <TouchableOpacity onPress={async () => { await updatePref({ mutedUsers: arrayRemove(u.id) }); setMutedUsers((p) => p.filter((x) => x.id !== u.id)); }}>
                  <Text style={{ color: BRAND, fontWeight: '700' }}>Unmute</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        ) : subView === 'hiddenWords' ? (
          <View style={{ padding: 16, gap: 12 }}>
            <Text style={{ color: c.muted, fontSize: 13 }}>Comma-separated words to filter from comments:</Text>
            <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text }]} value={hiddenWords} onChangeText={setHiddenWords} placeholder="spam, promo, ..." placeholderTextColor={c.muted} />
            <TouchableOpacity style={[styles.btn, { backgroundColor: BRAND }]} onPress={async () => {
              const list = hiddenWords.split(',').map((w) => w.trim().toLowerCase()).filter(Boolean);
              await updatePref({ hiddenWords: list });
              setSubView('main');
              Alert.alert('Saved', 'Hidden words updated.');
            }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Save Words</Text>
            </TouchableOpacity>
          </View>
        ) : subView === 'report' ? (
          <View style={{ padding: 16, gap: 12 }}>
            <TextInput style={[styles.input, { backgroundColor: c.input, borderColor: c.border, color: c.text, minHeight: 100 }]} multiline placeholder="Describe the issue..." placeholderTextColor={c.muted} value={bugText} onChangeText={setBugText} />
            <TouchableOpacity style={[styles.btn, { backgroundColor: BRAND }]} onPress={submitBug}><Text style={{ color: '#fff', fontWeight: '700' }}>Submit Report</Text></TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <Text style={[styles.sec, { color: c.muted }]}>YOUR ACCOUNT</Text>
            {onOpenEdit && <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => { onClose(); onOpenEdit(); }}><Text style={{ color: c.text }}>Personal Details & Edit Profile</Text><Ionicons name="chevron-forward" size={18} color={c.muted} /></TouchableOpacity>}
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={handlePasswordReset}><Text style={{ color: c.text }}>Password & Security (Reset Link)</Text><Ionicons name="chevron-forward" size={18} color={c.muted} /></TouchableOpacity>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={downloadMyData}><Text style={{ color: c.text }}>Download Your Information</Text><Ionicons name="download-outline" size={18} color={c.muted} /></TouchableOpacity>

            <Text style={[styles.sec, { color: c.muted }]}>WHO CAN SEE YOUR CONTENT</Text>
            <View style={[styles.row, { borderBottomColor: c.border }]}><Text style={{ color: c.text }}>{t.privateAcc}</Text><Switch value={isPrivate} onValueChange={(v) => { setIsPrivate(v); updatePref({ isPrivate: v }); }} trackColor={{ true: BRAND }} /></View>
            {isPrivate && onOpenRequests && <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => { onClose(); onOpenRequests(); }}><Text style={{ color: c.text }}>Follow Requests ({userData?.followRequests?.length || 0})</Text><Ionicons name="chevron-forward" size={18} color={c.muted} /></TouchableOpacity>}
            <View style={[styles.row, { borderBottomColor: c.border }]}><Text style={{ color: c.text }}>{t.activity}</Text><Switch value={showOnline} onValueChange={(v) => { setShowOnline(v); updatePref({ showOnline: v, isOnline: v }); }} trackColor={{ true: BRAND }} /></View>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => setSubView('blocked')}><Text style={{ color: c.text }}>Blocked Accounts ({blockedUsers.length})</Text><Ionicons name="chevron-forward" size={18} color={c.muted} /></TouchableOpacity>

            <Text style={[styles.sec, { color: c.muted }]}>HOW OTHERS CAN INTERACT</Text>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => { const n = cycle(['everyone', 'followers', 'off'], commentsControl); setCommentsControl(n); updatePref({ commentsControl: n }); }}>
              <Text style={{ color: c.text }}>Comments Allowed</Text><Text style={{ color: BRAND, fontWeight: '700', textTransform: 'capitalize' }}>{commentsControl}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => { const n = cycle(['everyone', 'following', 'none'], allowTags); setAllowTags(n); updatePref({ allowTags: n }); }}>
              <Text style={{ color: c.text }}>Tags & Mentions</Text><Text style={{ color: BRAND, fontWeight: '700', textTransform: 'capitalize' }}>{allowTags}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => setSubView('hiddenWords')}><Text style={{ color: c.text }}>Hidden Words</Text><Ionicons name="chevron-forward" size={18} color={c.muted} /></TouchableOpacity>

            <Text style={[styles.sec, { color: c.muted }]}>WHAT YOU SEE & NOTIFICATIONS</Text>
            <View style={[styles.row, { borderBottomColor: c.border }]}><Text style={{ color: c.text }}>{t.darkMode}</Text><Switch value={isDark} onValueChange={() => { toggleTheme(); updatePref({ darkMode: !isDark }); }} trackColor={{ true: BRAND }} /></View>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => { const n = cycle<Lang>(['English', 'Hindi', 'Hinglish'], lang); setLang(n); updatePref({ language: n }); }}>
              <Text style={{ color: c.text }}>Language</Text><Text style={{ color: BRAND, fontWeight: '700' }}>{lang}</Text>
            </TouchableOpacity>
            <View style={[styles.row, { borderBottomColor: c.border }]}><Text style={{ color: c.text }}>{t.likeNotif}</Text><Switch value={notifLikes} onValueChange={(v) => { setNotifLikes(v); updatePref({ notifLikes: v }); }} trackColor={{ true: BRAND }} /></View>
            <View style={[styles.row, { borderBottomColor: c.border }]}><Text style={{ color: c.text }}>{t.commentNotif}</Text><Switch value={notifComments} onValueChange={(v) => { setNotifComments(v); updatePref({ notifComments: v }); }} trackColor={{ true: BRAND }} /></View>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => setSubView('muted')}><Text style={{ color: c.text }}>Muted Accounts ({mutedUsers.length})</Text><Ionicons name="chevron-forward" size={18} color={c.muted} /></TouchableOpacity>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={async () => { await AsyncStorage.removeItem(`flevora_searches_${uid}`); Alert.alert('Cleared', 'Search history cleared.'); }}><Text style={{ color: c.text }}>Clear Search History</Text><Ionicons name="trash-outline" size={18} color={c.muted} /></TouchableOpacity>

            <Text style={[styles.sec, { color: c.muted }]}>APP & SUPPORT</Text>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => setSubView('report')}><Text style={{ color: c.text }}>Report a Problem</Text><Ionicons name="chevron-forward" size={18} color={c.muted} /></TouchableOpacity>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={() => Alert.alert('About Flevora', 'Flevora Social App v1.0.0\nShare Your World.')}><Text style={{ color: c.text }}>About Flevora (v1.0.0)</Text><Ionicons name="information-circle-outline" size={18} color={c.muted} /></TouchableOpacity>

            <Text style={[styles.sec, { color: c.muted }]}>LOGIN & ACCOUNT ACTIONS</Text>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={handleLogout}><Text style={{ color: BRAND, fontWeight: '700' }}>Log Out</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={deactivateAccount}><Text style={{ color: '#F59E0B', fontWeight: '700' }}>Deactivate Account</Text></TouchableOpacity>
            <TouchableOpacity style={[styles.row, { borderBottomColor: c.border }]} onPress={deleteAccount}><Text style={{ color: '#EF4444', fontWeight: '700' }}>Delete Account Permanently</Text></TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 46 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 16, fontWeight: '800' },
  sec: { fontSize: 11, fontWeight: '800', paddingHorizontal: 14, paddingTop: 18, paddingBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 0.5 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
});
            
