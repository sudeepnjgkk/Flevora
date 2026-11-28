import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Image, Modal,
  StyleSheet, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AudioModule, RecordingPresets, useAudioPlayer, useAudioRecorder } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useRouter } from 'expo-router';
import {
  doc, updateDoc, deleteDoc, addDoc, collection, arrayUnion, arrayRemove, serverTimestamp, writeBatch,
} from 'firebase/firestore';
import { db } from '../config';
import { BRAND, BRAND_TEXT, NEON } from './theme';
import { useLang } from './i18n';
import { sendPush } from './push';
import { ChatInfoModal } from './ChatInfoModal';
import { ForwardModal, PollModal } from './DmModals';
import {
  canMessageUser, DEFAULT_DM_CAPABILITIES, detectDmCapabilities, dmT,
  formatMsgTime, isMessageExpired, loadDmDraft, saveDmDraft,
  uploadDmMediaToCloudinary, validateDmAsset,
} from './dmCapabilities';

const REACTS = ['❤️', '😂', '😮', '😢', '👍', '🔥'];

function VoiceBubble({ uri, mine, textColor }: { uri: string; mine: boolean; textColor: string }) {
  const player = useAudioPlayer(uri);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  useEffect(() => () => { try { player.pause(); } catch {} }, [player]);

  const toggle = () => {
    if (playing) { player.pause(); setPlaying(false); }
    else { player.play(); setPlaying(true); }
  };
  const cycleSpeed = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    try { (player as any).playbackRate = next; } catch {}
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 155 }}>
      <TouchableOpacity onPress={toggle}>
        <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={28} color={mine ? BRAND_TEXT : BRAND} />
      </TouchableOpacity>
      <Text style={{ color: mine ? BRAND_TEXT : textColor, fontWeight: '700', fontSize: 13, flex: 1 }}>Voice</Text>
      <TouchableOpacity onPress={cycleSpeed} style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.12)' }}>
        <Text style={{ color: mine ? BRAND_TEXT : textColor, fontSize: 11, fontWeight: '800' }}>{rate}x</Text>
      </TouchableOpacity>
    </View>
  );
}

function DmVideoViewerModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const [muted, setMuted] = useState(false);
  const player = useVideoPlayer(uri || '', (p) => { p.loop = true; if (uri) p.play(); });
  useEffect(() => { player.muted = muted; }, [muted, player]);
  useEffect(() => { if (!uri) player.pause(); else player.play(); }, [uri, player]);
  if (!uri) return null;
  return (
    <Modal visible={!!uri} animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
        <VideoView player={player} style={{ width: '100%', height: '75%' }} contentFit="contain" nativeControls />
        <TouchableOpacity onPress={onClose} style={{ position: 'absolute', top: 48, right: 16 }}><Ionicons name="close" size={30} color="#fff" /></TouchableOpacity>
        <TouchableOpacity onPress={() => setMuted((m) => !m)} style={{ position: 'absolute', top: 48, left: 16 }}><Ionicons name={muted ? 'volume-mute' : 'volume-high'} size={26} color="#fff" /></TouchableOpacity>
      </View>
    </Modal>
  );
}

export function DmChatRoom({
  myUid, me, chatId: propChatId, convo, targetUid, targetName, otherUser, allUsers = [], msgs, onLoadMore, onBack, c,
}: any) {
  const router = useRouter();
  const { lang } = useLang();
  const L = dmT(lang);
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<any>(null);

  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editing, setEditing] = useState<any>(null);
  const [menuMsg, setMenuMsg] = useState<any>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [forwardMsg, setForwardMsg] = useState<any>(null);
  const [pollOpen, setPollOpen] = useState(false);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [previewVid, setPreviewVid] = useState<string | null>(null);
  const [chatColor, setChatColor] = useState(BRAND);
  const [caps, setCaps] = useState(DEFAULT_DM_CAPABILITIES);
  const [uploadingPct, setUploadingPct] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [recSec, setRecSec] = useState(0);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const chatId = propChatId || [myUid, targetUid].sort().join('_');
  const isGroup = convo?.type === 'group';
  const perm = isGroup ? { allowed: true } : canMessageUser(otherUser, me, myUid);
  const blocked = !perm.allowed;
  const showOnline = me?.showOnline !== false && otherUser?.showOnline !== false;
  const online = !isGroup && showOnline && (otherUser?.isOnline || (otherUser?.lastSeen?.toDate ? Date.now() - otherUser.lastSeen.toDate().getTime() < 300000 : false));
  const sub = isGroup ? `${convo?.participants?.length || 0} members` : otherUser?.typingTo === myUid ? L.typing : online ? L.activeNow : showOnline ? L.offline : '';
  const dp = otherUser?.photoUrl || otherUser?.avatar || '';

  useEffect(() => { detectDmCapabilities().then(setCaps); }, []);
  useEffect(() => { loadDmDraft(myUid, chatId).then((d) => { if (d) setText(d); }); }, [myUid, chatId]);
  useEffect(() => { saveDmDraft(myUid, chatId, text); }, [text, myUid, chatId]);

  useEffect(() => {
    if (!recording) { setRecSec(0); return; }
    const t = setInterval(() => setRecSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  useEffect(() => {
    if (!myUid || !chatId || me?.readReceipts === false) return;
    (msgs || []).forEach((m: any) => {
      if (m.senderUid !== myUid && !m.read) {
        updateDoc(doc(db, 'conversations', chatId, 'messages', m.id), { read: true, readBy: arrayUnion(myUid) }).catch(() => {});
      }
    });
  }, [msgs?.length, myUid, chatId, me?.readReceipts]);

  useEffect(() => () => {
    if (myUid) updateDoc(doc(db, 'users', myUid), { typingTo: '' }).catch(() => {});
  }, [myUid]);

  const handleTyping = (val: string) => {
    setText(val);
    if (!myUid || isGroup || blocked) return;
    updateDoc(doc(db, 'users', myUid), { typingTo: val.trim() ? targetUid : '' }).catch(() => {});
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => updateDoc(doc(db, 'users', myUid), { typingTo: '' }).catch(() => {}), 2500);
  };
    const sendMsg = async (mediaUrl = '', mediaType = 'text', extra: Record<string, any> = {}) => {
    const body = text.trim();
    if (blocked || (!body && !mediaUrl && !extra.poll)) return;
    if (editing) {
      await updateDoc(doc(db, 'conversations', chatId, 'messages', editing.id), { text: body, editedAt: serverTimestamp() }).catch(() => Alert.alert('Error', 'Could not edit message.'));
      setEditing(null); setText(''); return;
    }
    const prevText = text;
    setText('');
    if (myUid) updateDoc(doc(db, 'users', myUid), { typingTo: '' }).catch(() => {});
    const replySnapshot = replyTo ? { id: replyTo.id, text: replyTo.text || 'Media', senderUid: replyTo.senderUid } : null;
    setReplyTo(null);
    const expHours = convo?.disappearingHours || 0;
    const expiresAt = expHours > 0 ? Date.now() + expHours * 3600000 : null;

    try {
      const batch = writeBatch(db);
      const convoRef = doc(db, 'conversations', chatId);
      const msgRef = doc(collection(db, 'conversations', chatId, 'messages'));
      batch.set(convoRef, {
        participants: convo?.participants || [myUid, targetUid],
        updatedAt: serverTimestamp(),
        lastMessage: body || (mediaType === 'audio' ? '🎤 Voice message' : extra.poll ? `📊 ${extra.poll.question}` : '📷 Media'),
        lastSenderUid: myUid,
      }, { merge: true });
      batch.set(msgRef, {
        senderUid: myUid,
        senderName: me?.username || 'user',
        text: body,
        mediaUrl,
        mediaType,
        replyTo: replySnapshot,
        ...(expiresAt ? { expiresAt } : {}),
        ...extra,
        read: false,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      if (!isGroup && otherUser?.expoPushToken && !(otherUser?.mutedMsgChats?.[myUid]) && otherUser?.notifMessages !== false) {
        sendPush(otherUser.expoPushToken, me?.username || 'New Message', 'Sent you a message');
      }
    } catch {
      setText(prevText);
      Alert.alert('Failed', 'Message could not be sent. Your text is preserved.', [
        { text: 'OK' },
        { text: L.retry, onPress: () => sendMsg(mediaUrl, mediaType, extra) },
      ]);
    }
  };

  const pickMedia = async (useCam: boolean) => {
    if (blocked) return;
    const res = useCam
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.75 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.75 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const err = validateDmAsset(asset);
    if (err) return Alert.alert('Invalid File', err);
    const t = asset.type === 'video' ? 'video' : 'image';
    try {
      setUploadingPct(1);
      const url = await uploadDmMediaToCloudinary(asset.uri, t, setUploadingPct);
      setUploadingPct(null);
      await sendMsg(url, t);
    } catch {
      setUploadingPct(null);
      Alert.alert('Upload Failed', 'Could not upload media.');
    }
  };

  const startVoice = async () => {
    const permRes = await AudioModule.requestRecordingPermissionsAsync();
    if (!permRes.granted) {
      return Alert.alert('Mic Permission Denied', 'Enable microphone permission in Android Device Settings to send voice messages.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => Linking.openSettings() },
      ]);
    }
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
  };

  const stopVoice = async (send: boolean) => {
    await recorder.stop();
    setRecording(false);
    if (send && recorder.uri) {
      try {
        setUploadingPct(1);
        const url = await uploadDmMediaToCloudinary(recorder.uri, 'audio', setUploadingPct);
        setUploadingPct(null);
        await sendMsg(url, 'audio');
      } catch {
        setUploadingPct(null);
        Alert.alert('Failed', 'Voice upload failed.');
      }
    }
  };

  const forwardToUser = async (targetUser: any) => {
    if (!forwardMsg) return;
    const cid = [myUid, targetUser.id].sort().join('_');
    const batch = writeBatch(db);
    batch.set(doc(db, 'conversations', cid), { participants: [myUid, targetUser.id], updatedAt: serverTimestamp(), lastMessage: 'Forwarded message', lastSenderUid: myUid }, { merge: true });
    batch.set(doc(collection(db, 'conversations', cid, 'messages')), {
      senderUid: myUid, senderName: me?.username || 'user',
      text: forwardMsg.text || '', mediaUrl: forwardMsg.mediaUrl || '', mediaType: forwardMsg.mediaType || 'text',
      forwarded: true, read: false, createdAt: serverTimestamp(),
    });
    await batch.commit();
    Alert.alert('Forwarded', `Sent to @${targetUser.username}`);
    setForwardMsg(null);
  };

  const visibleMsgs = (msgs || []).filter((m: any) => !(Array.isArray(m.deletedFor) && m.deletedFor.includes(myUid)) && !isMessageExpired(m));

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <View style={[s.hdr, { borderBottomColor: c.border }]}>
        <TouchableOpacity onPress={onBack} hitSlop={10}><Ionicons name="arrow-back" size={24} color={c.text} /></TouchableOpacity>
        <TouchableOpacity onPress={() => !isGroup && targetUid && router.push(`/user/${targetUid}` as any)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
          <View>{dp ? <Image source={{ uri: dp }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name={isGroup ? 'people' : 'person'} size={18} color={BRAND_TEXT} /></View>}{online && <View style={[s.dot, { borderColor: c.background }]} />}</View>
          <View style={{ flex: 1 }}><Text style={{ fontSize: 16, fontWeight: '800', color: c.text }} numberOfLines={1}>{isGroup ? convo?.groupName : (otherUser?.username || targetName)}</Text>{!!sub && <Text style={{ fontSize: 12, color: online ? '#10B981' : c.muted }}>{sub}</Text>}</View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Calling Unavailable', caps.callingProvider ? 'Connecting...' : L.callUnavailable)} style={s.hIcon}><Ionicons name="call-outline" size={21} color={c.text} /></TouchableOpacity>
        <TouchableOpacity onPress={() => Alert.alert('Calling Unavailable', caps.callingProvider ? 'Connecting...' : L.callUnavailable)} style={s.hIcon}><Ionicons name="videocam-outline" size={23} color={c.text} /></TouchableOpacity>
        <TouchableOpacity onPress={() => setInfoOpen(true)} style={s.hIcon}><Ionicons name="information-circle-outline" size={23} color={c.text} /></TouchableOpacity>
      </View>

      {uploadingPct !== null && (
        <View style={{ padding: 6, backgroundColor: c.card, alignItems: 'center' }}><Text style={{ color: BRAND, fontWeight: '700', fontSize: 12 }}>Uploading {uploadingPct}%...</Text></View>
      )}

      <FlatList
        ref={listRef}
        inverted
        data={visibleMsgs}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 14 }}
        ListFooterComponent={msgs?.length >= 30 && onLoadMore ? (
          <TouchableOpacity onPress={onLoadMore} style={{ padding: 10, alignItems: 'center' }}><Text style={{ color: BRAND, fontWeight: '700', fontSize: 12 }}>{L.loadOlder}</Text></TouchableOpacity>
        ) : null}
        ListEmptyComponent={<Text style={{ color: c.muted, textAlign: 'center', marginTop: 40 }}>Say hi to start the conversation!</Text>}
        renderItem={({ item }) => {
          const mine = item.senderUid === myUid;
          const reactList = item.reactions && Object.keys(item.reactions).length ? Object.values(item.reactions).join(' ') : '';
          return (
            <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
              {isGroup && !mine && <Text style={{ color: c.muted, fontSize: 11, marginBottom: 2 }}>@{item.senderName || 'user'}</Text>}
              <TouchableOpacity
                onPress={() => {
                  if (item.postId) router.push(`/reels?startId=${item.postId}` as any);
                  else if (item.mediaType === 'image' && item.mediaUrl) setPreviewImg(item.mediaUrl);
                  else if (item.mediaType === 'video' && item.mediaUrl) setPreviewVid(item.mediaUrl);
                }}
                onLongPress={() => setMenuMsg(item)}
                activeOpacity={0.85}
                style={[s.bubble, mine ? { backgroundColor: chatColor } : { backgroundColor: c.card, borderWidth: 1, borderColor: c.border }]}
              >
                {!!item.forwarded && <Text style={{ color: mine ? BRAND_TEXT : c.muted, fontSize: 10, fontStyle: 'italic', marginBottom: 2 }}>Forwarded</Text>}
                {!!item.replyTo && <View style={s.repBox}><Text style={{ color: mine ? '#333' : c.muted, fontSize: 11 }} numberOfLines={1}>↩ {item.replyTo.text}</Text></View>}
                {item.mediaType === 'audio' && !!item.mediaUrl ? <VoiceBubble uri={item.mediaUrl} mine={mine} textColor={c.text} /> : !!item.mediaUrl ? (
                  <View>
                    <Image source={{ uri: item.mediaType === 'video' ? item.mediaUrl.replace(/\.mp4.*$/, '.jpg') : item.mediaUrl }} style={s.media} />
                    {item.mediaType === 'video' && <Ionicons name="play-circle" size={38} color="#fff" style={{ position: 'absolute', alignSelf: 'center', top: '38%' }} />}
                  </View>
                ) : null}
                {!!item.poll && (
                  <View style={{ gap: 4, minWidth: 170 }}>
                    <Text style={{ fontWeight: '800', color: mine ? BRAND_TEXT : c.text }}>{item.poll.question}</Text>
                    {(item.poll.options || []).map((opt: string, idx: number) => {
                      const votes = Object.values(item.pollVotes || {}).filter((v) => v === idx).length;
                      return (
                        <TouchableOpacity key={idx} onPress={() => updateDoc(doc(db, 'conversations', chatId, 'messages', item.id), { [`pollVotes.${myUid}`]: idx })} style={{ backgroundColor: 'rgba(255,255,255,0.6)', padding: 6, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text style={{ color: '#111', fontWeight: '700', fontSize: 12 }}>{opt}</Text>
                          <Text style={{ color: '#111', fontWeight: '800', fontSize: 12 }}>{votes}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                {!!item.text && <Text style={{ color: mine ? BRAND_TEXT : c.text, fontSize: 14 }}>{item.text}{item.editedAt ? ' (edited)' : ''}</Text>}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2, gap: 6 }}>
                  {!!reactList && <Text style={{ fontSize: 13 }}>{reactList}</Text>}
                  <Text style={{ color: mine ? '#374151' : c.muted, fontSize: 10 }}>{formatMsgTime(item.createdAt)}</Text>
                </View>
              </TouchableOpacity>
              {mine && me?.readReceipts !== false && <Text style={{ color: c.muted, fontSize: 10, marginTop: 2 }}>{item.read ? '✓✓ Seen' : '✓ Sent'}</Text>}
            </View>
          );
        }}
      />

      {!!menuMsg && (
        <View style={[s.reactBar, { backgroundColor: c.card, borderColor: c.border }]}>
          {REACTS.map((e) => <TouchableOpacity key={e} onPress={() => { updateDoc(doc(db, 'conversations', chatId, 'messages', menuMsg.id), { [`reactions.${myUid}`]: menuMsg.reactions?.[myUid] === e ? null : e }).catch(() => {}); setMenuMsg(null); }}><Text style={{ fontSize: 20 }}>{e}</Text></TouchableOpacity>)}
          <TouchableOpacity onPress={() => { setReplyTo(menuMsg); setMenuMsg(null); }}><Ionicons name="arrow-undo" size={18} color={c.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => { setForwardMsg(menuMsg); setMenuMsg(null); }}><Ionicons name="paper-plane-outline" size={18} color={c.text} /></TouchableOpacity>
          {menuMsg.senderUid === myUid && !!menuMsg.text && <TouchableOpacity onPress={() => { setEditing(menuMsg); setText(menuMsg.text); setMenuMsg(null); }}><Ionicons name="create-outline" size={18} color={c.text} /></TouchableOpacity>}
          <TouchableOpacity onPress={() => { updateDoc(doc(db, 'conversations', chatId, 'messages', menuMsg.id), { deletedFor: arrayUnion(myUid) }).catch(() => {}); setMenuMsg(null); }}><Ionicons name="eye-off-outline" size={18} color={c.muted} /></TouchableOpacity>
          {menuMsg.senderUid === myUid && <TouchableOpacity onPress={() => { deleteDoc(doc(db, 'conversations', chatId, 'messages', menuMsg.id)).catch(() => {}); setMenuMsg(null); }}><Ionicons name="trash" size={18} color="#EF4444" /></TouchableOpacity>}
          <TouchableOpacity onPress={() => { addDoc(collection(db, 'reports'), { chatId, messageId: menuMsg.id, type: 'message', status: 'pending', reportedBy: myUid, reporterUid: myUid, createdAt: serverTimestamp() }); Alert.alert('Reported', 'Message reported.'); setMenuMsg(null); }}><Ionicons name="flag-outline" size={18} color="#EF4444" /></TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuMsg(null)}><Ionicons name="close" size={18} color={c.muted} /></TouchableOpacity>
        </View>
      )}

      {(replyTo || editing) && (
        <View style={[s.repBanner, { backgroundColor: c.card }]}>
          <Text style={{ color: c.text, fontSize: 12, flex: 1 }} numberOfLines={1}>{editing ? `Editing: ${editing.text}` : `Replying to: ${replyTo.text || 'Media'}`}</Text>
          <TouchableOpacity onPress={() => { setReplyTo(null); setEditing(null); }}><Ionicons name="close" size={18} color={c.muted} /></TouchableOpacity>
        </View>
      )}

      {recording ? (
        <View style={[s.inpBar, { borderTopColor: c.border, backgroundColor: c.card }]}>
          <Ionicons name="mic" size={22} color="#EF4444" />
          <Text style={{ color: c.text, fontWeight: '700', flex: 1 }}>{L.recording} {recSec}s</Text>
          <TouchableOpacity onPress={() => stopVoice(false)}><Text style={{ color: '#EF4444', fontWeight: '700', marginRight: 14 }}>{L.cancel}</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => stopVoice(true)} style={{ backgroundColor: BRAND, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 }}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>{L.send}</Text></TouchableOpacity>
        </View>
      ) : (
        <View style={[s.inpBar, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <TouchableOpacity onPress={() => pickMedia(true)} disabled={blocked}><Ionicons name="camera" size={24} color={BRAND} /></TouchableOpacity>
          <TextInput value={text} onChangeText={handleTyping} placeholder={blocked ? (perm.reason || L.blockedPlaceholder) : L.msgPlaceholder} editable={!blocked} multiline placeholderTextColor={c.muted} style={[s.inp, { color: c.text, backgroundColor: c.input, borderColor: c.border }]} />
          <TouchableOpacity onPress={() => setPollOpen(true)} disabled={blocked}><Ionicons name="stats-chart-outline" size={20} color={c.text} /></TouchableOpacity>
          <TouchableOpacity onPress={startVoice} disabled={blocked}><Ionicons name="mic-outline" size={23} color={c.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => pickMedia(false)} disabled={blocked}><Ionicons name="image-outline" size={23} color={c.text} /></TouchableOpacity>
          <TouchableOpacity onPress={() => sendMsg()} disabled={blocked}><Ionicons name="send" size={22} color={BRAND} /></TouchableOpacity>
        </View>
      )}

      <Modal visible={!!previewImg} animationType="fade" onRequestClose={() => setPreviewImg(null)}>
        <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center' }}>
          {!!previewImg && <Image source={{ uri: previewImg }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />}
          <TouchableOpacity onPress={() => setPreviewImg(null)} style={{ position: 'absolute', top: 48, right: 16 }}><Ionicons name="close" size={30} color="#fff" /></TouchableOpacity>
        </View>
      </Modal>
      <DmVideoViewerModal uri={previewVid} onClose={() => setPreviewVid(null)} />
      <ForwardModal visible={!!forwardMsg} users={allUsers} c={c} onClose={() => setForwardMsg(null)} onForwardTo={forwardToUser} />
      <PollModal visible={pollOpen} c={c} onClose={() => setPollOpen(false)} onCreate={(poll: any) => sendMsg('', 'poll', { poll })} />
      <ChatInfoModal visible={infoOpen} onClose={() => setInfoOpen(false)} myUid={myUid} me={me} chatId={chatId} convo={convo} otherUser={otherUser} allUsers={allUsers} msgs={visibleMsgs} c={c} chatColor={chatColor} onChangeColor={setChatColor} onLeaveOrDelete={() => { if (isGroup) updateDoc(doc(db, 'conversations', chatId), { participants: arrayRemove(myUid) }); else updateDoc(doc(db, 'users', myUid), { hiddenChats: arrayUnion(targetUid || chatId) }); onBack(); }} />
    </View>
  );
}

const s = StyleSheet.create({
  hdr: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 48, paddingBottom: 12, paddingHorizontal: 14, borderBottomWidth: 0.5 },
  av: { width: 38, height: 38, borderRadius: 19 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981', position: 'absolute', right: 0, bottom: 0, borderWidth: 2 },
  hIcon: { padding: 5 },
  bubble: { maxWidth: 250, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  repBox: { borderLeftWidth: 2, borderColor: 'rgba(0,0,0,0.25)', paddingLeft: 6, marginBottom: 4 },
  media: { width: 200, height: 210, borderRadius: 12, marginBottom: 4 },
  reactBar: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, paddingVertical: 8, borderRadius: 24, borderWidth: 1 },
  repBanner: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 7 },
  inpBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 10, borderTopWidth: 0.5 },
  inp: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, maxHeight: 90 },
});
        
