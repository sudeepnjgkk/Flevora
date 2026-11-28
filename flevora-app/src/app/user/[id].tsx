import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, Image, TouchableOpacity, FlatList, StyleSheet, Linking,
  Dimensions, Alert, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  collection, doc, onSnapshot, query, where, getDocs, updateDoc, arrayUnion, arrayRemove, QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { auth, db } from '../../config';
import { useTheme, BRAND, BRAND_TEXT } from '../../constants/theme';
import { ExplorePostModal } from '../../constants/ExplorePostModal';
import { getThumbUrl, isBlockedBetween, toggleFollowUser } from '../../constants/searchHelpers';
import { fetchTaggedPostsPage, fetchUserPostsPage, fetchUserStories } from '../../constants/profileHelpers';
import { fetchUserRepostsPage } from '../../constants/repostSystem';
import { FollowListModal, shareProfileLink } from '../../constants/ProfileSubModals';
import { ReportAccountModal, VisitorMoreModal, VisitorStoryModal, showProfileLinkDialog } from '../../constants/VisitorProfileModals';
import { NoteDetailModal, canSeeNote } from '../../constants/NoteModal';
import { canViewChannel, getChannelRole, joinChannelIdempotent } from '../../constants/broadcastCapabilities';
import { BroadcastRoomModal } from '../../constants/BroadcastRoomModal';

const W = (Dimensions.get('window').width - 4) / 3;

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { c } = useTheme();
  const myUid = auth.currentUser?.uid || '';

  const [profile, setProfile] = useState<any>(null);
  const [visitorNote, setVisitorNote] = useState<any>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [channels, setChannels] = useState<any[]>([]);
  const [activeCh, setActiveCh] = useState<any>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);

  const [posts, setPosts] = useState<any[]>([]);
  const [repostPosts, setRepostPosts] = useState<any[]>([]);
  const [taggedPosts, setTaggedPosts] = useState<any[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeStories, setActiveStories] = useState<any[]>([]);
  const [storyViewer, setStoryViewer] = useState<{ open: boolean; title: string; items: any[] }>({ open: false, title: '', items: [] });

  const [tab, setTab] = useState<'posts' | 'reels' | 'reposts' | 'tagged'>('posts');
  const [followBusy, setFollowBusy] = useState(false);
  const [followMode, setFollowMode] = useState<'followers' | 'following' | null>(null);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    if (myUid && id === myUid) router.replace('/profile' as any);
  }, [id, myUid]);

  useEffect(() => {
    if (!id || (myUid && id === myUid)) return;
    setErrorMsg(null);
    const u1 = onSnapshot(
      doc(db, 'users', id),
      (s) => {
        if (!s.exists() || ['deleted', 'suspended', 'deactivated'].includes(s.data()?.status)) {
          setUnavailable(true); setProfile(null);
        } else {
          setUnavailable(false); setProfile({ id: s.id, ...s.data() });
        }
      },
      () => setErrorMsg('Could not load this profile. Check permissions or connection.')
    );
    const u2 = myUid ? onSnapshot(doc(db, 'users', myUid), (s) => { if (s.exists()) setMe({ id: s.id, ...s.data() }); }) : () => {};
    const u3 = onSnapshot(doc(db, 'notes', id), (s) => setVisitorNote(s.exists() ? { id: s.id, ...s.data() } : null), () => {});
    const u4 = onSnapshot(query(collection(db, 'channels'), where('ownerUid', '==', id)), (s) => {
      setChannels(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
    return () => { u1(); u2(); u3(); u4(); };
  }, [id, myUid]);

  const blocked = useMemo(() => isBlockedBetween(me, profile, myUid), [me, profile, myUid]);
  const isFollowing = Array.isArray(profile?.followers) && profile.followers.includes(myUid);
  const isRequested = Array.isArray(profile?.followRequests) && profile.followRequests.includes(myUid);
  const canView = !!profile && !blocked && (!profile.isPrivate || isFollowing);

  const loadContent = useCallback(async () => {
    if (!id || !canView) {
      setPosts([]); setActiveStories([]); setLoadingPosts(false); setRefreshing(false);
      return;
    }
    setLoadingPosts(true);
    try {
      const [pPage, stList, collabSnap] = await Promise.all([
        fetchUserPostsPage(id, null, 18),
        fetchUserStories(id),
        getDocs(query(collection(db, 'posts'), where('collaborators', 'array-contains', id))).catch(() => null),
      ]);
      const collabItems = collabSnap ? collabSnap.docs.map((d) => ({ id: d.id, ...d.data() })) : [];
      const seen = new Set(pPage.items.map((x: any) => x.id));
      const merged = [...pPage.items, ...collabItems.filter((x: any) => !seen.has(x.id))];
      merged.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(merged); setCursor(pPage.lastDoc); setHasMore(pPage.hasMore);
      const now = Date.now();
      setActiveStories(stList.filter((s: any) => (!s.expiresAt || s.expiresAt > now) && (!s.closeFriendsOnly || (Array.isArray(s.allowedUids) && s.allowedUids.includes(myUid)))));
    } catch { setErrorMsg('Failed to load posts.'); }
    finally { setLoadingPosts(false); setRefreshing(false); }
  }, [id, canView, myUid]);

  useEffect(() => { loadContent(); }, [loadContent]);

  useEffect(() => {
    if (!canView) return;
    if (tab === 'tagged' && profile?.username) {
      fetchTaggedPostsPage(profile.username.toLowerCase(), null, 18).then((r) => setTaggedPosts(r.items)).catch(() => {});
    } else if (tab === 'reposts' && id) {
      fetchUserRepostsPage(id, null, 18).then((r) => setRepostPosts(r.items)).catch(() => {});
    }
  }, [canView, tab, profile?.username, id]);
    const handleFollowPress = async () => {
    if (!myUid) return Alert.alert('Sign In Required', 'Please sign in to follow users.');
    if (followBusy || !profile || blocked) return;
    if (isFollowing) {
      Alert.alert(`Unfollow @${profile.username}?`, 'You will stop seeing their private posts.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unfollow', style: 'destructive', onPress: async () => { setFollowBusy(true); try { await toggleFollowUser(profile, me, myUid); } finally { setFollowBusy(false); } } },
      ]);
      return;
    }
    setFollowBusy(true);
    try { await toggleFollowUser(profile, me, myUid); } catch { Alert.alert('Error', 'Action failed.'); } finally { setFollowBusy(false); }
  };

  const handleMessagePress = () => {
    if (!myUid) return Alert.alert('Sign In Required', 'Please sign in to send messages.');
    if (blocked) return;
    if (profile?.isPrivate && !isFollowing && profile?.allowMessagesFrom === 'followers') {
      return Alert.alert('Cannot Message', `@${profile.username} only accepts messages from followers.`);
    }
    router.navigate({ pathname: '/messages' as any, params: { uid: id, name: profile.username } });
  };

  const handleBlockToggle = () => {
    if (!myUid || !profile) return;
    const iBlocked = Array.isArray(me?.blockedUsers) && me.blockedUsers.includes(id);
    Alert.alert(iBlocked ? `Unblock @${profile.username}?` : `Block @${profile.username}?`, iBlocked ? 'They will be able to find your profile again.' : 'They will not be able to see your posts or message you.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: iBlocked ? 'Unblock' : 'Block', style: 'destructive',
        onPress: async () => {
          await updateDoc(doc(db, 'users', myUid), { blockedUsers: iBlocked ? arrayRemove(id) : arrayUnion(id), following: arrayRemove(id), followers: arrayRemove(id) });
          if (!iBlocked) await updateDoc(doc(db, 'users', id), { followers: arrayRemove(myUid), following: arrayRemove(myUid) }).catch(() => {});
        },
      },
    ]);
  };

  const toggleListField = async (field: 'mutedUsers' | 'restrictedUsers', label: string) => {
    if (!myUid) return;
    const exists = Array.isArray(me?.[field]) && me[field].includes(id);
    await updateDoc(doc(db, 'users', myUid), { [field]: exists ? arrayRemove(id) : arrayUnion(id) });
    Alert.alert(exists ? `Un${label}` : label, `@${profile.username} updated.`);
  };

  if (unavailable) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Ionicons name="person-remove-outline" size={44} color={c.muted} />
        <Text style={{ color: c.text, fontWeight: '700', marginTop: 10 }}>User Unavailable</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 14 }}><Text style={{ color: BRAND, fontWeight: '700' }}>Go Back</Text></TouchableOpacity>
      </View>
    );
  }
  if (errorMsg && !profile) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}>
        <Text style={{ color: c.muted }}>{errorMsg}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 12 }}><Text style={{ color: BRAND, fontWeight: '700' }}>Go Back</Text></TouchableOpacity>
      </View>
    );
  }
  if (!profile) return <View style={[styles.center, { backgroundColor: c.background }]}><ActivityIndicator size="large" color={BRAND} /></View>;

  const followLabel = isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow';
  const highlights: any[] = canView && Array.isArray(profile.highlights) ? profile.highlights : [];
  const visibleChannels = blocked ? [] : channels.filter((ch) => canViewChannel(ch, myUid, me));
  const displayList = !canView ? [] : tab === 'posts' ? posts.filter((p) => p.mediaType !== 'video') : tab === 'reels' ? posts.filter((p) => p.mediaType === 'video') : tab === 'reposts' ? repostPosts : taggedPosts;
  const iBlocked = Array.isArray(me?.blockedUsers) && me.blockedUsers.includes(id);
  const isMuted = Array.isArray(me?.mutedUsers) && me.mutedUsers.includes(id);
  const isRestricted = Array.isArray(me?.restrictedUsers) && me.restrictedUsers.includes(id);
  const activeVisitorNote = canSeeNote(visitorNote, myUid, id, me, profile) ? visitorNote : null;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          {profile.isPrivate && <Ionicons name="lock-closed" size={15} color={c.text} />}
          <Text style={[styles.topTitle, { color: c.text }]} numberOfLines={1}>@{profile.username}</Text>
          {(profile.isVerified || profile.verified) && <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />}
        </View>
        <TouchableOpacity onPress={() => setMoreOpen(true)}><Ionicons name="ellipsis-vertical" size={22} color={c.text} /></TouchableOpacity>
      </View>

      <FlatList
        data={displayList}
        numColumns={3}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadContent(); }} tintColor={BRAND} />}
        onEndReached={() => {
          if (canView && hasMore && cursor && (tab === 'posts' || tab === 'reels')) {
            fetchUserPostsPage(id, cursor, 18).then((p) => { setPosts((prev) => [...prev, ...p.items]); setCursor(p.lastDoc); setHasMore(p.hasMore); });
          }
        }}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 14 }}>
            <View style={styles.infoRow}>
              <View style={{ alignItems: 'center' }}>
                {!!activeVisitorNote && (
                  <TouchableOpacity onPress={() => setNoteOpen(true)} style={[styles.noteChip, { backgroundColor: c.card, borderColor: activeVisitorNote.audience === 'closeFriends' ? '#10B981' : c.border }]}>
                    <Text style={{ color: c.text, fontSize: 11, fontWeight: '700' }} numberOfLines={1}>
                      {activeVisitorNote.promptQuestion || activeVisitorNote.text || 'Note'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity disabled={activeStories.length === 0} onPress={() => setStoryViewer({ open: true, title: `@${profile.username}`, items: activeStories })} style={[styles.ring, { borderColor: activeStories.length > 0 ? '#EC4899' : 'transparent', borderWidth: activeStories.length > 0 ? 2.5 : 0 }]}>
                  {profile.avatar ? <Image source={{ uri: profile.avatar }} style={styles.avatar} /> : (
                    <View style={[styles.avatar, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: BRAND_TEXT, fontSize: 26, fontWeight: '700' }}>{(profile.username || 'U')[0].toUpperCase()}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.stat}><Text style={[styles.statNum, { color: c.text }]}>{canView ? posts.length : '—'}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Posts</Text></View>
                <TouchableOpacity style={styles.stat} disabled={!canView} onPress={() => setFollowMode('followers')}><Text style={[styles.statNum, { color: c.text }]}>{profile.followers?.length || 0}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Followers</Text></TouchableOpacity>
                <TouchableOpacity style={styles.stat} disabled={!canView} onPress={() => setFollowMode('following')}><Text style={[styles.statNum, { color: c.text }]}>{profile.following?.length || 0}</Text><Text style={{ color: c.muted, fontSize: 12 }}>Following</Text></TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }}>{profile.fullName || ''}</Text>
              {!!profile.pronouns && !blocked && <Text style={{ color: c.muted, fontSize: 12 }}>{profile.pronouns}</Text>}
            </View>
            {!!profile.category && !blocked && <Text style={{ color: BRAND, fontSize: 12, fontWeight: '600' }}>{profile.category}</Text>}
            {!!profile.bio && !blocked && <Text style={{ color: c.text, marginTop: 2 }}>{profile.bio}</Text>}
            {!!profile.website && !blocked && <TouchableOpacity onPress={() => Linking.openURL(profile.website.startsWith('http') ? profile.website : `https://${profile.website}`)}><Text style={{ color: BRAND, marginTop: 2 }}>{profile.website}</Text></TouchableOpacity>}

            {!blocked && (
              <View style={styles.btnRow}>
                <TouchableOpacity disabled={followBusy} style={[styles.btn, { backgroundColor: isFollowing || isRequested ? c.input : BRAND }]} onPress={handleFollowPress}>
                  <Text style={{ color: isFollowing || isRequested ? c.text : BRAND_TEXT, fontWeight: '700' }}>{followLabel}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: c.input }]} onPress={handleMessagePress}>
                  <Text style={{ color: c.text, fontWeight: '700' }}>Message</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.shareIconBtn, { backgroundColor: c.input }]} onPress={() => shareProfileLink(id, profile.username || 'user')}>
                  <Ionicons name="share-social-outline" size={18} color={c.text} />
                </TouchableOpacity>
              </View>
            )}

            {visibleChannels.map((ch) => {
              const joined = getChannelRole(ch, myUid) !== 'none';
              return (
                <TouchableOpacity key={ch.id} onPress={async () => { if (!joined) await joinChannelIdempotent(ch, myUid); setActiveCh(ch); }} style={[styles.chRow, { backgroundColor: c.input }]}>
                  <Ionicons name="megaphone-outline" size={17} color={BRAND} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: c.text, fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{ch.name}</Text>
                    <Text style={{ color: c.muted, fontSize: 11 }}>{ch.memberCount || ch.members?.length || 1} members</Text>
                  </View>
                  <Text style={{ color: BRAND, fontWeight: '800', fontSize: 12 }}>{joined ? 'Open' : 'Join'}</Text>
                </TouchableOpacity>
              );
            })}

            {highlights.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 10 }}>
                {highlights.map((h) => (
                  <TouchableOpacity key={h.id} onPress={async () => { const all = await fetchUserStories(id); const items = all.filter((s) => (h.storyIds || []).includes(s.id)); if (items.length) setStoryViewer({ open: true, title: h.title, items }); }} style={{ alignItems: 'center', width: 62 }}>
                    <Image source={{ uri: h.cover }} style={[styles.hlCircle, { borderColor: BRAND }]} />
                    <Text style={{ color: c.text, fontSize: 11, marginTop: 4 }} numberOfLines={1}>{h.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {blocked ? (
              <View style={styles.lockBox}><Ionicons name="ban-outline" size={38} color={c.muted} /><Text style={{ color: c.text, fontWeight: '700', marginTop: 8 }}>Content Unavailable</Text></View>
            ) : !canView ? (
              <View style={styles.lockBox}><Ionicons name="lock-closed-outline" size={38} color={c.muted} /><Text style={{ color: c.text, fontWeight: '700', marginTop: 8 }}>This Account is Private</Text><Text style={{ color: c.muted, fontSize: 13 }}>Follow this account to see their photos and reels.</Text></View>
            ) : (
              <View style={[styles.tabs, { borderBottomColor: c.border }]}>
                {([{ k: 'posts', icon: 'grid-outline' }, { k: 'reels', icon: 'play-circle-outline' }, { k: 'reposts', icon: 'repeat-outline' }, { k: 'tagged', icon: 'person-outline' }] as const).map((t) => (
                  <TouchableOpacity key={t.k} onPress={() => setTab(t.k)} style={[styles.tabBtn, tab === t.k && { borderBottomColor: c.text, borderBottomWidth: 2 }]}>
                    <Ionicons name={t.icon} size={22} color={tab === t.k ? c.text : c.muted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        }
        ListEmptyComponent={canView ? (loadingPosts ? <ActivityIndicator style={{ marginTop: 30 }} color={BRAND} /> : <Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>No posts yet.</Text>) : null}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => setSelectedPost(item)} style={{ margin: 0.6 }}>
            <Image source={{ uri: getThumbUrl(item) }} style={styles.gridImg} />
            {Array.isArray(item.mediaItems) && item.mediaItems.length > 1 ? (
              <Ionicons name="layers" size={16} color="#fff" style={styles.badge} />
            ) : item.mediaType === 'video' ? (
              <Ionicons name="play" size={16} color="#fff" style={styles.badge} />
            ) : null}
          </TouchableOpacity>
        )}
      />

      <FollowListModal mode={followMode} ids={followMode === 'followers' ? (profile.followers || []) : (profile.following || [])} ownerUid={id} me={me} myUid={myUid} onClose={() => setFollowMode(null)} />
      <ExplorePostModal post={selectedPost} author={profile} me={me} onClose={() => setSelectedPost(null)} onPressTag={(t) => router.navigate({ pathname: '/explore', params: { q: t } } as any)} onPressPlace={(p) => router.navigate({ pathname: '/explore', params: { q: p } } as any)} />
      <NoteDetailModal visible={noteOpen} note={activeVisitorNote} owner={profile} me={me} myUid={myUid} onReplyDm={() => handleMessagePress()} onClose={() => setNoteOpen(false)} />
      <BroadcastRoomModal visible={!!activeCh} channel={activeCh} myUid={myUid} me={me} onClose={() => setActiveCh(null)} />
      <VisitorStoryModal visible={storyViewer.open} title={storyViewer.title} stories={storyViewer.items} onClose={() => setStoryViewer({ open: false, title: '', items: [] })} />
      <ReportAccountModal visible={reportOpen} targetUser={profile} myUid={myUid} onClose={() => setReportOpen(false)} />
      <VisitorMoreModal visible={moreOpen} profile={profile} isFollowing={isFollowing} isRequested={isRequested} isBlocked={iBlocked} isMuted={isMuted} isRestricted={isRestricted} onClose={() => setMoreOpen(false)} onShare={() => shareProfileLink(id, profile.username || 'user')} onCopyLink={() => showProfileLinkDialog(id, profile.username || 'user')} onAbout={() => Alert.alert(`About @${profile.username}`, `Username: @${profile.username}\nAccount Type: ${profile.accountType || 'Personal'}\nPrivate: ${profile.isPrivate ? 'Yes' : 'No'}`)} onMute={() => toggleListField('mutedUsers', 'Muted')} onRestrict={() => toggleListField('restrictedUsers', 'Restricted')} onUnfollow={handleFollowPress} onCancelReq={handleFollowPress} onBlock={handleBlockToggle} onReport={() => setReportOpen(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 46 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingBottom: 10 },
  topTitle: { fontSize: 18, fontWeight: '800' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginBottom: 10 },
  noteChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginBottom: -6, zIndex: 5, maxWidth: 92 },
  ring: { padding: 3, borderRadius: 46 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  statsRow: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  statNum: { fontSize: 17, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  shareIconBtn: { paddingHorizontal: 12, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  chRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, marginTop: 10 },
  hlCircle: { width: 58, height: 58, borderRadius: 29, borderWidth: 1.5 },
  lockBox: { alignItems: 'center', paddingVertical: 48 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, marginTop: 8 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 10 },
  gridImg: { width: W, height: W },
  badge: { position: 'absolute', top: 6, right: 6 },
});
