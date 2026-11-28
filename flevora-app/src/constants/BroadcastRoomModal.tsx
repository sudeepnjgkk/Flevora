import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput, FlatList, Image,
  ActivityIndicator, Alert, Linking, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { VideoView, useVideoPlayer } from 'expo-video';
import {
  addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy,
  query, serverTimestamp, updateDoc, increment,
} from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { useLang } from './i18n';
import {
  broadcastT, canModerateReplies, canPublishAnnouncement, DEFAULT_BC_CAPABILITIES,
  detectBroadcastCapabilities, getChannelRole, joinChannelIdempotent, loadChannelDraft,
  notifyChannelMembers, saveChannelDraft, uploadBroadcastMediaToCloudinary, validateBcAsset,
} from './broadcastCapabilities';
import { ChannelDetailsModal } from './BroadcastModals';

const BC_REACTS = ['❤️', '🔥', '😂', '👏', '🎉'];

function BcVideo({ uri }: { uri: string }) {
  const [muted, setMuted] = useState(true);
  const player = useVideoPlayer(uri, (p) => { p.loop = true; p.muted = true; });
  useEffect(() => { player.muted = muted; }, [muted, player]);
  return (
    <View style={{ width: '100%', height: 220, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginTop: 6 }}>
      <VideoView player={player} style={{ width: '100%', height: '100%' }} contentFit="cover" nativeControls />
      <TouchableOpacity onPress={() => setMuted((m) => !m)} style={{ position: 'absolute', right: 10, bottom: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 6, borderRadius: 14 }}>
        <Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={16} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

export function BroadcastRoomModal({ visible, channel: initChannel, myUid, me, allUsers = [], onClose }: any) {
  const { c } = useTheme();
  const { lang } = useLang();
  const L = broadcastT(lang);

  const [channel, setChannel] = useState<any>(initChannel);
  const [anns, setAnns] = useState<any[]>([]);
  const [annLimit, setAnnLimit] = useState(25);
  const [loading, setLoading] = useState(true);

  const [text, setText] = useState('');
  const [editing, setEditing] = useState<any>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInp, setShowLinkInp] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [pollQ, setPollQ] = useState('');
  const [pollO1, setPollO1] = useState('');
  const [pollO2, setPollO2] = useState('');
  const [pollMulti, setPollMulti] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [caps, setCaps] = useState(DEFAULT_BC_CAPABILITIES);

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [replyAnn, setReplyAnn] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyTxt, setReplyTxt] = useState('');
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const chId = initChannel?.id || '';
  const role = getChannelRole(channel, myUid);
  const isAdmin = canPublishAnnouncement(role);
  const isMod = canModerateReplies(role);
  const isMember = role !== 'none';

  useEffect(() => {
    if (!visible || !chId) return;
    detectBroadcastCapabilities().then(setCaps);
    loadChannelDraft(myUid, chId).then((d) => { if (d) setText(d); });
    const u1 = onSnapshot(doc(db, 'channels', chId), (s) => { if (s.exists()) setChannel({ id: s.id, ...s.data() }); });
    const u2 = onSnapshot(query(collection(db, 'channels', chId, 'announcements'), orderBy('createdAt', 'desc'), limit(annLimit)), (s) => {
      setAnns(s.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => { u1(); u2(); };
  }, [visible, chId, annLimit, myUid]);

  useEffect(() => { if (chId) saveChannelDraft(myUid, chId, text); }, [text, myUid, chId]);

  useEffect(() => {
    if (!replyAnn?.id || !chId) { setReplies([]); return; }
    return onSnapshot(query(collection(db, 'channels', chId, 'announcements', replyAnn.id, 'replies'), orderBy('createdAt', 'asc'), limit(50)), (s) => {
      setReplies(s.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [replyAnn?.id, chId]);

  if (!visible || !channel) return null;

  const publish = async (mediaUrl = '', mediaType: 'text' | 'image' | 'video' | 'poll' | 'link' = 'text', extra: Record<string, any> = {}) => {
    if (!isAdmin || !chId) return;
    const body = text.trim();
    if (!body && !mediaUrl && !extra.poll && !linkUrl.trim()) return;
    if (editing) {
      await updateDoc(doc(db, 'channels', chId, 'announcements', editing.id), { text: body, editedAt: serverTimestamp() }).catch(() => Alert.alert('Error', 'Could not edit.'));
      setEditing(null); setText(''); return;
    }
    const prev = text;
    setText(''); setShowLinkInp(false); setLinkUrl('');
    try {
      const payload = {
        channelId: chId,
        authorUid: myUid,
        authorName: me?.username || 'admin',
        authorAvatar: me?.photoUrl || me?.avatar || '',
        type: extra.poll ? 'poll' : linkUrl.trim() ? 'link' : mediaType,
        text: body,
        mediaUrl,
        linkUrl: linkUrl.trim(),
        pinned: false,
        reactions: {},
        repliesCount: 0,
        ...extra,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, 'channels', chId, 'announcements'), payload);
      await updateDoc(doc(db, 'channels', chId), {
        lastMessage: body || (extra.poll ? `📊 ${extra.poll.question}` : '📢 Announcement'),
        lastMessageAt: Date.now(),
        updatedAt: serverTimestamp(),
      });
      notifyChannelMembers(channel, myUid, me?.username || 'creator', body || 'New announcement');
    } catch {
      setText(prev);
      Alert.alert('Failed', 'Could not publish. Your draft is preserved.');
    }
  };

  const pickMedia = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.75 });
    if (res.canceled || !res.assets[0]) return;
    const err = validateBcAsset(res.assets[0]);
    if (err) return Alert.alert('Invalid File', err);
    const t = res.assets[0].type === 'video' ? 'video' : 'image';
    try {
      setUploadPct(1);
      const url = await uploadBroadcastMediaToCloudinary(res.assets[0].uri, t, setUploadPct);
      setUploadPct(null);
      await publish(url, t);
    } catch {
      setUploadPct(null);
      Alert.alert('Upload Failed', 'Could not upload media.');
    }
  };
    const votePoll = async (ann: any, optIdx: number) => {
    if (!isMember || ann.poll?.closed) return;
    const prev = ann.pollVotes?.[myUid];
    if (ann.poll?.multiChoice) {
      const arr: number[] = Array.isArray(prev) ? prev : [];
      const next = arr.includes(optIdx) ? arr.filter((x) => x !== optIdx) : [...arr, optIdx];
      await updateDoc(doc(db, 'channels', chId, 'announcements', ann.id), { [`pollVotes.${myUid}`]: next }).catch(() => {});
    } else {
      await updateDoc(doc(db, 'channels', chId, 'announcements', ann.id), { [`pollVotes.${myUid}`]: optIdx }).catch(() => {});
    }
  };

  const pinnedAnn = anns.find((a) => a.pinned && !a.isDeleted);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[s.wrap, { backgroundColor: c.background }]}>
        <View style={[s.hdr, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => setDetailsOpen(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            {channel.avatarUrl ? <Image source={{ uri: channel.avatarUrl }} style={s.av} /> : <View style={[s.av, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}><Ionicons name="megaphone" size={18} color={BRAND_TEXT} /></View>}
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }} numberOfLines={1}>{channel.name}</Text>
              <Text style={{ color: c.muted, fontSize: 12 }}>{channel.memberCount || channel.members?.length || 1} {L.members}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDetailsOpen(true)}><Ionicons name="information-circle-outline" size={24} color={c.text} /></TouchableOpacity>
        </View>

        {!!pinnedAnn && (
          <View style={[s.pinBar, { backgroundColor: c.card, borderBottomColor: c.border }]}>
            <Ionicons name="pin" size={15} color={BRAND} />
            <Text style={{ color: c.text, fontSize: 12, fontWeight: '700', flex: 1 }} numberOfLines={1}>{pinnedAnn.text || 'Pinned announcement'}</Text>
          </View>
        )}

        {uploadPct !== null && <View style={{ padding: 6, backgroundColor: c.card, alignItems: 'center' }}><Text style={{ color: BRAND, fontWeight: '700' }}>Uploading {uploadPct}%...</Text></View>}

        {loading ? <ActivityIndicator style={{ marginTop: 40 }} color={BRAND} /> : (
          <FlatList
            inverted
            data={anns.filter((a) => !a.isDeleted)}
            keyExtractor={(i) => i.id}
            contentContainerStyle={{ padding: 14, gap: 12 }}
            ListFooterComponent={anns.length >= annLimit ? (
              <TouchableOpacity onPress={() => setAnnLimit((n) => n + 25)} style={{ padding: 10, alignItems: 'center' }}>
                <Text style={{ color: BRAND, fontWeight: '700' }}>Load older announcements</Text>
              </TouchableOpacity>
            ) : null}
            ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>{channel.welcomeMessage || 'No announcements yet.'}</Text>}
            renderItem={({ item }) => {
              const reactSummary = Object.values(item.reactions || {}).reduce((acc: any, em: any) => { if (em) acc[em] = (acc[em] || 0) + 1; return acc; }, {});
              return (
                <View style={[s.annCard, { backgroundColor: c.card, borderColor: c.border }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: BRAND, fontWeight: '800', fontSize: 12 }}>@{item.authorName || 'creator'} {item.pinned ? '📌' : ''}</Text>
                    {isAdmin && (
                      <TouchableOpacity onPress={() => Alert.alert('Announcement', undefined, [
                        { text: item.pinned ? 'Unpin' : 'Pin', onPress: () => updateDoc(doc(db, 'channels', chId, 'announcements', item.id), { pinned: !item.pinned }) },
                        ...(item.authorUid === myUid && item.text ? [{ text: 'Edit', onPress: () => { setEditing(item); setText(item.text); } }] : []),
                        ...(item.poll && !item.poll.closed ? [{ text: 'Close Poll', onPress: () => updateDoc(doc(db, 'channels', chId, 'announcements', item.id), { 'poll.closed': true }) }] : []),
                        { text: 'Delete', style: 'destructive' as const, onPress: () => deleteDoc(doc(db, 'channels', chId, 'announcements', item.id)) },
                        { text: 'Cancel', style: 'cancel' as const },
                      ])}><Ionicons name="ellipsis-horizontal" size={18} color={c.muted} /></TouchableOpacity>
                    )}
                  </View>

                  {item.type === 'image' && !!item.mediaUrl && (
                    <TouchableOpacity onPress={() => setPreviewImg(item.mediaUrl)}>
                      <Image source={{ uri: item.mediaUrl }} style={s.media} resizeMode="cover" />
                    </TouchableOpacity>
                  )}
                  {item.type === 'video' && !!item.mediaUrl && <BcVideo uri={item.mediaUrl} />}
                  {!!item.text && <Text style={{ color: c.text, fontSize: 15, marginTop: 4 }}>{item.text}{item.editedAt ? ' (edited)' : ''}</Text>}
                  {!!item.linkUrl && (
                    <TouchableOpacity onPress={() => item.linkUrl.startsWith('http') && Linking.openURL(item.linkUrl)} style={[s.linkBox, { backgroundColor: c.input }]}>
                      <Ionicons name="link" size={16} color={BRAND} /><Text style={{ color: BRAND, fontWeight: '700', flex: 1 }} numberOfLines={1}>{item.linkUrl}</Text>
                    </TouchableOpacity>
                  )}

                  {!!item.poll && (
                    <View style={{ gap: 6, marginTop: 8 }}>
                      <Text style={{ color: c.text, fontWeight: '800' }}>{item.poll.question} {item.poll.closed ? '(Closed)' : ''}</Text>
                      {(item.poll.options || []).map((opt: string, idx: number) => {
                        const votes = Object.values(item.pollVotes || {}).filter((v: any) => (Array.isArray(v) ? v.includes(idx) : v === idx)).length;
                        const myV = item.pollVotes?.[myUid];
                        const picked = Array.isArray(myV) ? myV.includes(idx) : myV === idx;
                        return (
                          <TouchableOpacity key={idx} onPress={() => votePoll(item, idx)} style={[s.pollOpt, { backgroundColor: c.input, borderColor: picked ? BRAND : c.border, borderWidth: picked ? 1.5 : 1 }]}>
                            <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>{opt}</Text>
                            <Text style={{ color: BRAND, fontWeight: '800' }}>{votes}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  <View style={s.reactRow}>
                    {BC_REACTS.map((em) => (
                      <TouchableOpacity key={em} onPress={() => isMember && updateDoc(doc(db, 'channels', chId, 'announcements', item.id), { [`reactions.${myUid}`]: item.reactions?.[myUid] === em ? null : em })} style={[s.reactChip, { backgroundColor: item.reactions?.[myUid] === em ? `${BRAND}33` : c.input }]}>
                        <Text style={{ fontSize: 13 }}>{em} {reactSummary[em] || ''}</Text>
                      </TouchableOpacity>
                    ))}
                    {channel.allowReplies && (
                      <TouchableOpacity onPress={() => setReplyAnn(item)} style={{ marginLeft: 'auto' }}>
                        <Text style={{ color: BRAND, fontWeight: '700', fontSize: 12 }}>Replies ({item.repliesCount || 0})</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
          />
        )}

        {!isMember ? (
          <View style={[s.footer, { borderTopColor: c.border }]}>
            <TouchableOpacity style={[s.joinBtn, { backgroundColor: BRAND }]} onPress={() => joinChannelIdempotent(channel, myUid).catch((e: any) => Alert.alert('Error', e.message))}>
              <Text style={{ color: BRAND_TEXT, fontWeight: '800', fontSize: 15 }}>{L.join}</Text>
            </TouchableOpacity>
          </View>
        ) : isAdmin ? (
          <View style={{ borderTopWidth: 0.5, borderTopColor: c.border, padding: 10, gap: 8 }}>
            {showLinkInp && <TextInput value={linkUrl} onChangeText={setLinkUrl} placeholder="https://..." placeholderTextColor={c.muted} autoCapitalize="none" style={[s.inp, { backgroundColor: c.input, color: c.text }]} />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={pickMedia}><Ionicons name="image-outline" size={23} color={BRAND} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setPollOpen(true)}><Ionicons name="stats-chart-outline" size={21} color={c.text} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowLinkInp((v) => !v)}><Ionicons name="link-outline" size={22} color={c.text} /></TouchableOpacity>
              <TouchableOpacity onPress={() => Alert.alert('Scheduled Publishing', caps.scheduledAnnouncements ? 'Ready' : L.scheduleUnavailable)}><Ionicons name="time-outline" size={20} color={c.muted} /></TouchableOpacity>
              <TextInput value={text} onChangeText={setText} placeholder={L.announcementsPlaceholder} placeholderTextColor={c.muted} multiline style={[s.inp, { flex: 1, backgroundColor: c.input, color: c.text, maxHeight: 80 }]} />
              <TouchableOpacity onPress={() => publish()}><Ionicons name="send" size={22} color={BRAND} /></TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={[s.footer, { borderTopColor: c.border }]}>
            <Text style={{ color: c.muted, fontSize: 12, textAlign: 'center' }}>{L.repliesOff}</Text>
          </View>
        )}

        <Modal visible={pollOpen} transparent animationType="slide" onRequestClose={() => setPollOpen(false)}>
          <View style={s.mBg}><View style={[s.mCard, { backgroundColor: c.card }]}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>Create Channel Poll</Text>
            <TextInput value={pollQ} onChangeText={setPollQ} placeholder="Question..." placeholderTextColor={c.muted} style={[s.inp, { backgroundColor: c.input, color: c.text }]} />
            <TextInput value={pollO1} onChangeText={setPollO1} placeholder="Option 1" placeholderTextColor={c.muted} style={[s.inp, { backgroundColor: c.input, color: c.text }]} />
            <TextInput value={pollO2} onChangeText={setPollO2} placeholder="Option 2" placeholderTextColor={c.muted} style={[s.inp, { backgroundColor: c.input, color: c.text }]} />
            <TouchableOpacity onPress={() => setPollMulti((m) => !m)}><Text style={{ color: BRAND, fontWeight: '700' }}>Mode: {pollMulti ? 'Multiple Choice' : 'Single Choice'} (Tap to switch)</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { if (!pollQ.trim()) return; publish('', 'poll', { poll: { question: pollQ.trim(), options: [pollO1.trim() || 'Yes', pollO2.trim() || 'No'], multiChoice: pollMulti, closed: false } }); setPollQ(''); setPollO1(''); setPollO2(''); setPollOpen(false); }} style={[s.joinBtn, { backgroundColor: BRAND }]}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Publish Poll</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setPollOpen(false)} style={{ alignItems: 'center' }}><Text style={{ color: c.muted }}>Cancel</Text></TouchableOpacity>
          </View></View>
        </Modal>

        <Modal visible={!!replyAnn} transparent animationType="slide" onRequestClose={() => setReplyAnn(null)}>
          <View style={s.mBg}><View style={[s.mCard, { backgroundColor: c.card, maxHeight: '70%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: c.text, fontWeight: '800' }}>Discussion Replies</Text><TouchableOpacity onPress={() => setReplyAnn(null)}><Ionicons name="close" size={22} color={c.text} /></TouchableOpacity></View>
            <FlatList data={replies} keyExtractor={(i) => i.id} renderItem={({ item }) => (
              <View style={{ flexDirection: 'row', paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ color: c.text, flex: 1 }}><Text style={{ fontWeight: '800' }}>@{item.username}: </Text>{item.text}</Text>
                {(item.uid === myUid || isMod) && <TouchableOpacity onPress={() => deleteDoc(doc(db, 'channels', chId, 'announcements', replyAnn.id, 'replies', item.id))}><Ionicons name="trash-outline" size={16} color="#EF4444" /></TouchableOpacity>}
              </View>
            )} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput value={replyTxt} onChangeText={setReplyTxt} placeholder="Reply..." placeholderTextColor={c.muted} style={[s.inp, { flex: 1, backgroundColor: c.input, color: c.text }]} />
              <TouchableOpacity onPress={async () => { if (!replyTxt.trim()) return; await addDoc(collection(db, 'channels', chId, 'announcements', replyAnn.id, 'replies'), { uid: myUid, username: me?.username || 'user', text: replyTxt.trim(), createdAt: serverTimestamp() }); await updateDoc(doc(db, 'channels', chId, 'announcements', replyAnn.id), { repliesCount: increment(1) }); setReplyTxt(''); }} style={{ backgroundColor: BRAND, paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10 }}><Ionicons name="send" size={18} color={BRAND_TEXT} /></TouchableOpacity>
            </View>
          </View></View>
        </Modal>

        <Modal visible={!!previewImg} animationType="fade" onRequestClose={() => setPreviewImg(null)}>
          <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
            {!!previewImg && <Image source={{ uri: previewImg }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
            <TouchableOpacity onPress={() => setPreviewImg(null)} style={{ position: 'absolute', top: 48, right: 16 }}><Ionicons name="close" size={30} color="#fff" /></TouchableOpacity>
          </View>
        </Modal>

        <ChannelDetailsModal visible={detailsOpen} channel={channel} myUid={myUid} me={me} allUsers={allUsers} onLeaveOrDelete={onClose} onClose={() => setDetailsOpen(false)} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 46 },
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 12, borderBottomWidth: 0.5 },
  av: { width: 38, height: 38, borderRadius: 19 },
  pinBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: 0.5 },
  annCard: { borderWidth: 1, borderRadius: 16, padding: 12, gap: 6 },
  media: { width: '100%', height: 220, borderRadius: 12, marginTop: 6 },
  linkBox: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 10, marginTop: 4 },
  pollOpt: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 10 },
  reactRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 6 },
  reactChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  footer: { padding: 14, borderTopWidth: 0.5 },
  joinBtn: { paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  inp: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  mBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  mCard: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, gap: 10 },
});
