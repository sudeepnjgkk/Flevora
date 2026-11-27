import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Switch, StyleSheet, Alert, BackHandler,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config';
import { useTheme, BRAND } from '../constants/theme';
import { useLang, Lang } from '../constants/i18n';
import {
  AccountDetailsPage, DeactivateDeletePage, HelpSupportPage, NotificationsPrefsPage,
  PasswordSecurityPage, TimeManagementPage, exportUserInformation,
} from '../constants/SettingsAccountPages';
import {
  CloseFriendsPage, InteractionPrivacyPage, SavedPostsPage, UserListManagePage, YourActivityPage,
} from '../constants/SettingsContentPages';
import { EditProfileModal, FollowListModal, ProfessionalModal } from '../constants/ProfileSubModals';
import { fetchUserPostsPage } from '../constants/profileHelpers';

type SubPage =
  | 'menu' | 'account' | 'security' | 'deactivate' | 'saved' | 'activity'
  | 'notifications' | 'time' | 'privacy' | 'closeFriends' | 'blocked'
  | 'restricted' | 'muted' | 'interactions' | 'help' | 'report' | 'about';

export default function SettingsScreen({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const { isDark, toggleTheme, c } = useTheme();
  const { lang, setLang } = useLang();
  const uid = auth.currentUser?.uid || '';

  const [user, setUser] = useState<any>(null);
  const [myPosts, setMyPosts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [subPage, setSubPage] = useState<SubPage>('menu');
  const [editOpen, setEditOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, 'users', uid), (s) => {
      if (s.exists()) {
        const d = s.data();
        setUser({ id: s.id, ...d });
        if (d.language === 'English' || d.language === 'Hindi' || d.language === 'Hinglish') setLang(d.language);
      }
    });
    fetchUserPostsPage(uid, null, 25).then((r) => setMyPosts(r.items)).catch(() => {});
    return unsub;
  }, [uid]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (subPage !== 'menu') { setSubPage('menu'); return true; }
      return false;
    });
    return () => sub.remove();
  }, [subPage]);

  const updatePref = async (patch: Record<string, any>) => {
    if (!uid) return;
    await updateDoc(doc(db, 'users', uid), patch).catch(() => Alert.alert('Error', 'Could not save setting.'));
  };

  const handleBack = () => {
    if (subPage !== 'menu') setSubPage('menu');
    else if (onClose) onClose();
    else router.back();
  };

  const sections = useMemo(() => [
    {
      title: 'Your account',
      items: [
        { key: 'account', title: 'Account & Personal Details', sub: 'Name, username, email, privacy info', icon: 'person-circle-outline', onPress: () => setSubPage('account') },
        { key: 'security', title: 'Password and Security', sub: 'Change password, reset link, login activity', icon: 'shield-checkmark-outline', onPress: () => setSubPage('security') },
        { key: 'download', title: 'Download Your Information', sub: 'Export your profile and posts JSON', icon: 'download-outline', onPress: () => uid && exportUserInformation(uid) },
        { key: 'deactivate', title: 'Deactivation and Deletion', sub: 'Deactivate or permanently delete account', icon: 'trash-outline', onPress: () => setSubPage('deactivate') },
      ],
    },
    {
      title: 'How you use Flevora',
      items: [
        { key: 'saved', title: 'Saved', sub: `${user?.savedPosts?.length || 0} saved posts`, icon: 'bookmark-outline', onPress: () => setSubPage('saved') },
        { key: 'activity', title: 'Your Activity', sub: 'Posts, likes, and search history', icon: 'time-outline', onPress: () => setSubPage('activity') },
        { key: 'notifications', title: 'Notifications', sub: 'Likes, comments, follows, pause alerts', icon: 'notifications-outline', onPress: () => setSubPage('notifications') },
        { key: 'time', title: 'Time Management', sub: 'Daily usage reminder goal', icon: 'hourglass-outline', onPress: () => setSubPage('time') },
      ],
    },
    {
      title: 'Your insights and tools',
      items: [
        { key: 'pro', title: 'Professional Dashboard & Account Type', sub: `${user?.accountType || 'Personal'} • Real insights`, icon: 'stats-chart-outline', onPress: () => setProOpen(true) },
      ],
    },
    {
      title: 'Who can see your content',
      items: [
        { key: 'privacy', title: 'Account Privacy', sub: user?.isPrivate ? 'Private' : 'Public', icon: 'lock-closed-outline', onPress: () => setSubPage('privacy') },
        { key: 'closeFriends', title: 'Close Friends', sub: `${user?.closeFriends?.length || 0} people`, icon: 'star-outline', onPress: () => setSubPage('closeFriends') },
        { key: 'blocked', title: 'Blocked Accounts', sub: `${user?.blockedUsers?.length || 0} blocked`, icon: 'ban-outline', onPress: () => setSubPage('blocked') },
        { key: 'restricted', title: 'Restricted Accounts', sub: `${user?.restrictedUsers?.length || 0} restricted`, icon: 'eye-off-outline', onPress: () => setSubPage('restricted') },
      ],
    },
    {
      title: 'How others can interact with you',
      items: [
        { key: 'interactions', title: 'Messages, Comments, Tags & Hidden Words', sub: 'Control replies, mentions, DMs, filters', icon: 'chatbubbles-outline', onPress: () => setSubPage('interactions') },
      ],
    },
    {
      title: 'What you see',
      items: [
        { key: 'muted', title: 'Muted Accounts', sub: `${user?.mutedUsers?.length || 0} muted`, icon: 'volume-mute-outline', onPress: () => setSubPage('muted') },
        { key: 'theme', title: `Appearance (${isDark ? 'Dark' : 'Light'})`, sub: 'Switch light or dark mode', icon: 'contrast-outline', onPress: () => { toggleTheme(); updatePref({ darkMode: !isDark }); } },
        { key: 'lang', title: `Language (${lang})`, sub: 'English / Hindi / Hinglish', icon: 'language-outline', onPress: () => {
          const list: Lang[] = ['English', 'Hindi', 'Hinglish'];
          const next = list[(list.indexOf(lang) + 1) % list.length];
          setLang(next);
          updatePref({ language: next });
        } },
      ],
    },
    {
      title: 'App and support',
      items: [
        { key: 'help', title: 'Help Center', sub: 'FAQs & support guide', icon: 'help-circle-outline', onPress: () => setSubPage('help') },
        { key: 'report', title: 'Report a Problem', sub: 'Send technical feedback', icon: 'flag-outline', onPress: () => setSubPage('report') },
        { key: 'about', title: 'About Flevora', sub: 'Version 1.0.0 & App Permissions', icon: 'information-circle-outline', onPress: () => setSubPage('about') },
      ],
    },
  ], [user, isDark, lang, uid]);

  const q = search.trim().toLowerCase();
  const filteredSections = sections
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => !q || it.title.toLowerCase().includes(q) || it.sub.toLowerCase().includes(q)) }))
    .filter((sec) => sec.items.length > 0);

  const pageTitles: Record<SubPage, string> = {
    menu: 'Settings and activity', account: 'Account & Personal Details', security: 'Password and Security',
    deactivate: 'Deactivation and Deletion', saved: 'Saved', activity: 'Your Activity',
    notifications: 'Notifications', time: 'Time Management', privacy: 'Account Privacy',
    closeFriends: 'Close Friends', blocked: 'Blocked Accounts', restricted: 'Restricted Accounts',
    muted: 'Muted Accounts', interactions: 'Interactions & Hidden Words', help: 'Help Center',
    report: 'Report a Problem', about: 'About Flevora',
  };

  return (
    <View style={[styles.wrap, { backgroundColor: c.background }]}>
      <View style={[styles.hdr, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={handleBack}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
        <Text style={[styles.title, { color: c.text }]}>{pageTitles[subPage]}</Text>
        <View style={{ width: 24 }} />
      </View>

      {subPage === 'menu' ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
          <View style={[styles.searchBox, { backgroundColor: c.input, borderColor: c.border }]}>
            <Ionicons name="search" size={18} color={c.muted} />
            <TextInput style={{ flex: 1, color: c.text, fontSize: 14 }} placeholder="Search settings..." placeholderTextColor={c.muted} value={search} onChangeText={setSearch} />
            {!!search && <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={18} color={c.muted} /></TouchableOpacity>}
          </View>

          {filteredSections.length === 0 ? (
            <Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No settings found for "{search}".</Text>
          ) : filteredSections.map((sec) => (
            <View key={sec.title}>
              <Text style={[styles.secHead, { color: c.muted }]}>{sec.title}</Text>
              {sec.items.map((it) => (
                <TouchableOpacity key={it.key} style={[styles.row, { borderBottomColor: c.border }]} onPress={it.onPress}>
                  <Ionicons name={it.icon as any} size={22} color={c.text} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '600', fontSize: 15 }}>{it.title}</Text>
                    <Text style={{ color: c.muted, fontSize: 12 }}>{it.sub}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={c.muted} />
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {!q && (
            <View style={{ padding: 16, gap: 10 }}>
              <View style={[styles.row, { borderBottomColor: c.border, paddingHorizontal: 0 }]}>
                <Text style={{ color: c.text, fontWeight: '600', flex: 1 }}>Show Activity Status</Text>
                <Switch value={user?.showOnline !== false} onValueChange={(v) => updatePref({ showOnline: v, isOnline: v })} trackColor={{ true: BRAND }} />
              </View>
              <TouchableOpacity
                onPress={() => Alert.alert('Log Out', 'Are you sure you want to log out?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Log Out', style: 'destructive', onPress: async () => { await updatePref({ isOnline: false }); await signOut(auth); if (onClose) onClose(); } },
                ])}
                style={{ paddingVertical: 12 }}
              >
                <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 15 }}>Log Out</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : subPage === 'account' ? <AccountDetailsPage user={user} onOpenEdit={() => setEditOpen(true)} />
        : subPage === 'security' ? <PasswordSecurityPage user={user} />
        : subPage === 'deactivate' ? <DeactivateDeletePage uid={uid} onDone={() => onClose && onClose()} />
        : subPage === 'saved' ? <SavedPostsPage user={user} uid={uid} />
        : subPage === 'activity' ? <YourActivityPage user={user} uid={uid} />
        : subPage === 'notifications' ? <NotificationsPrefsPage user={user} updatePref={updatePref} />
        : subPage === 'time' ? <TimeManagementPage user={user} updatePref={updatePref} />
        : subPage === 'closeFriends' ? <CloseFriendsPage user={user} uid={uid} />
        : subPage === 'blocked' ? <UserListManagePage field="blockedUsers" emptyText="No blocked accounts." uid={uid} user={user} />
        : subPage === 'restricted' ? <UserListManagePage field="restrictedUsers" emptyText="No restricted accounts." uid={uid} user={user} />
        : subPage === 'muted' ? <UserListManagePage field="mutedUsers" emptyText="No muted accounts." uid={uid} user={user} />
        : subPage === 'interactions' ? <InteractionPrivacyPage user={user} updatePref={updatePref} />
        : subPage === 'privacy' ? (
          <View style={{ padding: 16, gap: 14 }}>
            <View style={[styles.row, { borderBottomColor: c.border, paddingHorizontal: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: c.text, fontWeight: '700', fontSize: 15 }}>Private Account</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>Only approved followers can see your posts and stories.</Text>
              </View>
              <Switch value={!!user?.isPrivate} onValueChange={(v) => updatePref({ isPrivate: v })} trackColor={{ true: BRAND }} />
            </View>
            {user?.isPrivate && (
              <TouchableOpacity onPress={() => setReqOpen(true)} style={[styles.row, { borderBottomColor: c.border, paddingHorizontal: 0 }]}>
                <Text style={{ color: BRAND, fontWeight: '700', flex: 1 }}>Manage Follow Requests ({user?.followRequests?.length || 0})</Text>
                <Ionicons name="chevron-forward" size={18} color={BRAND} />
              </TouchableOpacity>
            )}
          </View>
        ) : <HelpSupportPage mode={subPage as 'help' | 'report' | 'about'} uid={uid} />}

      <EditProfileModal visible={editOpen} user={user} uid={uid} onClose={() => setEditOpen(false)} />
      <ProfessionalModal visible={proOpen} uid={uid} user={user} posts={myPosts} onClose={() => setProOpen(false)} />
      <FollowListModal mode={reqOpen ? 'requests' : null} ids={user?.followRequests || []} ownerUid={uid} me={user} myUid={uid} onClose={() => setReqOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 46 },
  hdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontWeight: '800' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, paddingHorizontal: 12, height: 42, borderRadius: 12, borderWidth: 1 },
  secHead: { fontSize: 12, fontWeight: '800', paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 0.5 },
});
