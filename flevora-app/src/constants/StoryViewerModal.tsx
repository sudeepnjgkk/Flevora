import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, Image, TextInput, FlatList, Animated, StyleSheet, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { VideoView, useVideoPlayer } from 'expo-video';
import { doc, updateDoc, deleteDoc, addDoc, setDoc, collection, onSnapshot, arrayUnion, arrayRemove, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config';
import { BRAND } from './theme';
import { ShareModal } from './ShareModal';
import { StoryCreatorModal } from './StoryCreatorModal';
import { HighlightPickerModal, MentionModal, StoryMoreModal, StorySettingsModal } from './MyStoryModals';
import { StoryActivityModal } from './StoryActivityModal';

const EMOJIS = ['😂', '😮', '😍', '😢', '👏', '🔥'];

export function StoryViewerModal({ visible, onClose, stories, initialIndex = 0, myUid, me }: any) {
  const uid = myUid || auth.currentUser?.uid || '';
  const [idx, setIdx] = useState(initialIndex);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [reply, setReply] = useState('');
  const [cmtTxt, setCmtTxt] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showHL, setShowHL] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showActivity, setShowActivity] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [hlAdded, setHlAdded] = useState(false);
  const [flyEmoji, setFlyEmoji] = useState('');
  const flyY = useRef(new Animated.Value(0)).current;

  const story = stories?.[idx] || stories?.[0];
  const meData = me || allUsers.find((u) => u.id === uid);
  const isOwn = story?.uid === uid;
  const player = useVideoPlayer(story?.mediaType === 'video' ? story.mediaUrl : '', (p) => { p.loop = true; if (story?.mediaType === 'video') p.play(); });

  useEffect(() => {
    setIdx(initialIndex);
    return onSnapshot(collection(db, 'users'), (sn) => setAllUsers(sn.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, [initialIndex, visible]);

  useEffect(() => {
    if (!visible || !story?.id || !uid || isOwn) return;
    updateDoc(doc(db, 'stories', story.id), { viewers: arrayUnion(uid) }).catch(() => {});
  }, [visible, story?.id, uid]);

  if (!story) return null;
  const liked = (story.likes || []).includes(uid);

  const sendDmReply = async (txt: string, isEmoji = false) => {
    if (!txt.trim() || !uid) return;
    if (isEmoji) {
      setFlyEmoji(txt); flyY.setValue(0);
      Animated.timing(flyY, { toValue: -360, duration: 700, useNativeDriver: true }).start(() => setFlyEmoji(''));
      updateDoc(doc(db, 'stories', story.id), { reactions: arrayUnion({ uid, emoji: txt }) }).catch(() => {});
    }
    const cid = [uid, story.uid].sort().join('_');
    await setDoc(doc(db, 'conversations', cid), { participants: [uid, story.uid], updatedAt: serverTimestamp(), lastMessage: `Replied to story: ${txt}` }, { merge: true });
    await addDoc(collection(db, 'conversations', cid, 'messages'), { senderUid: uid, text: `Replied to story: ${txt}`, mediaUrl: story.mediaUrl, mediaType: 'image', read: false, createdAt: serverTimestamp() });
    setReply('');
  };

  const addComment = async (t: string) => {
    if (!t.trim() || story.commentsDisabled) return;
    await updateDoc(doc(db, 'stories', story.id), { comments: arrayUnion({ uid, username: meData?.username || 'user', text: t.trim() }) });
    setCmtTxt(''); setReply('');
  };

  const handleMore = async (k: string) => {
    if (k === 'delete') { await deleteDoc(doc(db, 'stories', story.id)); onClose(); }
    if (k === 'archive') { await updateDoc(doc(db, 'stories', story.id), { archived: true }); Alert.alert('Archived', 'Story archived.'); }
    if (k === 'save' || k === 'share') Share.share({ url: story.mediaUrl, message: story.mediaUrl });
    if (k === 'send') setShowShare(true);
    if (k === 'ai') await updateDoc(doc(db, 'stories', story.id), { aiLabel: !story.aiLabel });
    if (k === 'settings') setShowSettings(true);
    if (k === 'comments') await updateDoc(doc(db, 'stories', story.id), { commentsDisabled: !story.commentsDisabled });
  };

  const vPics = allUsers.filter((u) => (story.viewers || []).includes(u.id)).slice(0, 3);
  const owner = allUsers.find((u) => u.id === story.uid);
  const ownerDp = owner?.photoUrl || owner?.avatar || story.userPhoto || '';

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={s.wrap}>
        {story.mediaType === 'video' ? <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} surfaceType="textureView" /> : <Image source={{ uri: story.mediaUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />}
        <View style={s.hdr}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {ownerDp ? <Image source={{ uri: ownerDp }} style={s.av} /> : <View style={[s.av, s.ph]}><Ionicons name="person" size={16} color="#fff" /></View>}
            <Text style={s.hdrName}>{owner?.username || story.username}</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="close" size={28} color="#fff" /></TouchableOpacity>
        </View>

        <View style={{ flex: 1, flexDirection: 'row' }}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => idx > 0 && setIdx(idx - 1)} />
          <TouchableOpacity style={{ flex: 1 }} onPress={() => (idx < stories.length - 1 ? setIdx(idx + 1) : onClose())} />
        </View>

        {!!flyEmoji && <Animated.Text style={[s.fly, { transform: [{ translateY: flyY }] }]}>{flyEmoji}</Animated.Text>}

        {isOwn ? (
          <View style={s.botScrim}>
            <TextInput value={reply} onChangeText={setReply} onSubmitEditing={() => addComment(reply)} placeholder="Say something..." placeholderTextColor="#E5E7EB" style={s.sayInp} />
            <View style={s.ownBar}>
              <TouchableOpacity style={s.ownBtn} onPress={() => setShowActivity(true)}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {vPics.length ? vPics.map((u, i) => <Image key={u.id} source={{ uri: u.photoUrl || story.mediaUrl }} style={[s.miniV, { marginLeft: i ? -8 : 0 }]} />) : <Ionicons name="eye-outline" size={20} color="#fff" />}
                </View>
                <Text style={s.oLbl}>{vPics.length ? 'Activity' : 'No views'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.ownBtn} onPress={() => Share.share({ message: story.mediaUrl })}><Ionicons name="share-social-outline" size={22} color="#fff" /><Text style={s.oLbl}>Share to</Text></TouchableOpacity>
              <TouchableOpacity style={s.ownBtn} onPress={() => setShowHL(true)}><Ionicons name={hlAdded ? 'heart-circle' : 'heart-circle-outline'} size={23} color={hlAdded ? BRAND : '#fff'} /><Text style={s.oLbl}>Highlight</Text></TouchableOpacity>
              <TouchableOpacity style={s.ownBtn} onPress={() => setShowMention(true)}><Ionicons name="at" size={22} color="#fff" /><Text style={s.oLbl}>Mention</Text></TouchableOpacity>
              <TouchableOpacity style={s.ownBtn} onPress={() => setShowMore(true)}><Ionicons name="ellipsis-vertical" size={22} color="#fff" /><Text style={s.oLbl}>More</Text></TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.botScrim}>
            <View style={s.emoRow}>{EMOJIS.map((e) => <TouchableOpacity key={e} onPress={() => sendDmReply(e, true)}><Text style={{ fontSize: 24 }}>{e}</Text></TouchableOpacity>)}</View>
            <View style={s.othBar}>
              <TextInput value={reply} onChangeText={setReply} onSubmitEditing={() => sendDmReply(reply)} placeholder="Send message" placeholderTextColor="#E5E7EB" style={s.msgInp} />
              <TouchableOpacity onPress={() => updateDoc(doc(db, 'stories', story.id), { likes: liked ? arrayRemove(uid) : arrayUnion(uid) })}><Ionicons name={liked ? 'heart' : 'heart-outline'} size={26} color={liked ? '#EF4444' : '#fff'} /></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowComments(true)}><Ionicons name="chatbubble-outline" size={24} color="#fff" /></TouchableOpacity>
              <TouchableOpacity onPress={() => setShowShare(true)}><Ionicons name="paper-plane-outline" size={24} color="#fff" /></TouchableOpacity>
            </View>
          </View>
        )}

        <Modal visible={showComments} transparent animationType="slide" onRequestClose={() => setShowComments(false)}>
          <View style={s.cBg}><View style={s.cSheet}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}><Text style={{ fontWeight: '700', fontSize: 16 }}>Comments</Text><TouchableOpacity onPress={() => setShowComments(false)}><Ionicons name="close" size={22} /></TouchableOpacity></View>
            <FlatList data={story.comments || []} keyExtractor={(_, i) => String(i)} renderItem={({ item }) => <Text style={{ paddingVertical: 6 }}><Text style={{ fontWeight: '700' }}>@{item.username} </Text>{item.text}</Text>} />
            <View style={{ flexDirection: 'row', gap: 8 }}><TextInput value={cmtTxt} onChangeText={setCmtTxt} placeholder="Add comment..." style={s.cInp} /><TouchableOpacity onPress={() => addComment(cmtTxt)} style={{ backgroundColor: BRAND, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '700' }}>Post</Text></TouchableOpacity></View>
          </View></View>
        </Modal>

        <ShareModal visible={showShare} post={story} onClose={() => setShowShare(false)} />
        <HighlightPickerModal visible={showHL} onClose={(ok: boolean) => { setShowHL(false); if (ok) setHlAdded(true); }} uid={uid} me={meData} story={story} />
        <MentionModal visible={showMention} onClose={() => setShowMention(false)} allUsers={allUsers} uid={uid} me={meData} story={story} />
        <StoryMoreModal visible={showMore} onClose={() => setShowMore(false)} story={story} onAction={handleMore} />
        <StorySettingsModal visible={showSettings} onClose={() => setShowSettings(false)} uid={uid} me={meData} />
        <StoryActivityModal visible={showActivity} onClose={() => setShowActivity(false)} story={story} allUsers={allUsers} allStories={stories} onOpenSettings={() => { setShowActivity(false); setShowSettings(true); }} onDelete={() => handleMore('delete')} onNewStory={() => setShowNew(true)} onDmUser={() => setShowShare(true)} />
        <StoryCreatorModal visible={showNew} onClose={() => setShowNew(false)} uid={uid} user={meData} me={meData} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#000' },
  hdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 48, paddingBottom: 12, paddingHorizontal: 16, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 10 },
  hdrName: { color: '#fff', fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
  av: { width: 34, height: 34, borderRadius: 17 }, ph: { backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  fly: { position: 'absolute', bottom: 110, alignSelf: 'center', fontSize: 44, zIndex: 30 },
  botScrim: { backgroundColor: 'rgba(0,0,0,0.52)', paddingTop: 12, paddingBottom: 22, paddingHorizontal: 14 },
  sayInp: { color: '#fff', fontSize: 15, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  ownBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  ownBtn: { alignItems: 'center', gap: 4 }, oLbl: { color: '#fff', fontSize: 11, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 3 },
  miniV: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#fff' },
  emoRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  othBar: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  msgInp: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 9, color: '#fff' },
  cBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  cSheet: { backgroundColor: '#fff', height: '55%', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16 },
  cInp: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
});
