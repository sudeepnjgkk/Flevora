import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, TextInput, ScrollView, StyleSheet, Alert, Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../config';
import { useTheme, BRAND, BRAND_TEXT } from './theme';
import { isValidHttpUrl, StoriesCapabilities } from './storiesCapabilities';

export type StickerType =
  | 'mention' | 'hashtag' | 'location' | 'link' | 'poll'
  | 'question' | 'slider' | 'quiz' | 'countdown' | 'addYours' | 'datetime';

export interface StoryStickerItem {
  id: string;
  type: StickerType;
  x: number;
  y: number;
  data: Record<string, any>;
}

export function StickerPickerModal({
  visible, capabilities, allUsers, myUid, onSelect, onClose,
}: {
  visible: boolean; capabilities: StoriesCapabilities; allUsers: any[]; myUid: string;
  onSelect: (st: StoryStickerItem) => void; onClose: () => void;
}) {
  const { c } = useTheme();
  const [activeType, setActiveType] = useState<StickerType | null>(null);
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const [text3, setText3] = useState('');
  const [correctIdx, setCorrectIdx] = useState(0);

  const reset = () => { setActiveType(null); setText1(''); setText2(''); setText3(''); setCorrectIdx(0); };

  const addSticker = (type: StickerType, data: Record<string, any>) => {
    onSelect({ id: `st_${Date.now()}`, type, x: 40, y: 180, data });
    reset();
    onClose();
  };

  const renderBuilder = () => {
    if (activeType === 'mention') {
      const list = allUsers.filter((u) => u.id !== myUid && (u.username || '').toLowerCase().includes(text1.toLowerCase()));
      return (
        <View style={{ gap: 10 }}>
          <TextInput style={[s.inp, { backgroundColor: c.input, color: c.text }]} placeholder="Search @username..." placeholderTextColor={c.muted} value={text1} onChangeText={setText1} />
          <ScrollView style={{ maxHeight: 220 }}>
            {list.slice(0, 15).map((u) => (
              <TouchableOpacity key={u.id} style={s.row} onPress={() => addSticker('mention', { uid: u.id, username: u.username })}>
                <Ionicons name="at" size={18} color={BRAND} />
                <Text style={{ color: c.text, fontWeight: '700' }}>@{u.username}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }
    if (activeType === 'hashtag' || activeType === 'location' || activeType === 'addYours') {
      const ph = activeType === 'hashtag' ? '#flevora' : activeType === 'location' ? 'Enter city or place' : 'Prompt (e.g. Today’s fit)';
      return (
        <View style={{ gap: 10 }}>
          <TextInput style={[s.inp, { backgroundColor: c.input, color: c.text }]} placeholder={ph} placeholderTextColor={c.muted} value={text1} onChangeText={setText1} />
          <TouchableOpacity style={[s.btn, { backgroundColor: BRAND }]} onPress={() => {
            const v = text1.trim();
            if (!v) return;
            if (activeType === 'hashtag') addSticker('hashtag', { tag: v.startsWith('#') ? v : `#${v}` });
            else if (activeType === 'location') addSticker('location', { place: v });
            else addSticker('addYours', { prompt: v, participants: [myUid] });
          }}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Add Sticker</Text></TouchableOpacity>
        </View>
      );
    }
    if (activeType === 'link') {
      return (
        <View style={{ gap: 10 }}>
          <TextInput style={[s.inp, { backgroundColor: c.input, color: c.text }]} placeholder="https://example.com" placeholderTextColor={c.muted} value={text1} onChangeText={setText1} autoCapitalize="none" />
          <TextInput style={[s.inp, { backgroundColor: c.input, color: c.text }]} placeholder="Label (optional)" placeholderTextColor={c.muted} value={text2} onChangeText={setText2} />
          <TouchableOpacity style={[s.btn, { backgroundColor: BRAND }]} onPress={() => {
            if (!isValidHttpUrl(text1)) return Alert.alert('Invalid URL', 'Enter a valid http:// or https:// URL.');
            addSticker('link', { url: text1.trim(), label: text2.trim() || text1.trim() });
          }}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Add Link</Text></TouchableOpacity>
        </View>
      );
    }
    if (activeType === 'poll' || activeType === 'quiz') {
      return (
        <View style={{ gap: 10 }}>
          <TextInput style={[s.inp, { backgroundColor: c.input, color: c.text }]} placeholder="Ask a question..." placeholderTextColor={c.muted} value={text1} onChangeText={setText1} />
          <TextInput style={[s.inp, { backgroundColor: c.input, color: c.text }]} placeholder="Option 1" placeholderTextColor={c.muted} value={text2} onChangeText={setText2} />
          <TextInput style={[s.inp, { backgroundColor: c.input, color: c.text }]} placeholder="Option 2" placeholderTextColor={c.muted} value={text3} onChangeText={setText3} />
          {activeType === 'quiz' && (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[0, 1].map((i) => (
                <TouchableOpacity key={i} onPress={() => setCorrectIdx(i)} style={[s.chip, { backgroundColor: correctIdx === i ? BRAND : c.input }]}>
                  <Text style={{ color: correctIdx === i ? BRAND_TEXT : c.text, fontWeight: '700' }}>Correct: Option {i + 1}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TouchableOpacity style={[s.btn, { backgroundColor: BRAND }]} onPress={() => {
            if (!text1.trim()) return;
            addSticker(activeType, {
              question: text1.trim(),
              options: [text2.trim() || 'Yes', text3.trim() || 'No'],
              ...(activeType === 'quiz' ? { correctIndex: correctIdx } : {}),
            });
          }}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Add {activeType === 'poll' ? 'Poll' : 'Quiz'}</Text></TouchableOpacity>
        </View>
      );
    }
    if (activeType === 'question' || activeType === 'slider' || activeType === 'countdown') {
      const ph = activeType === 'question' ? 'Ask me anything...' : activeType === 'slider' ? 'Rate this...' : 'Event title (e.g. Live Drop)';
      return (
        <View style={{ gap: 10 }}>
          <TextInput style={[s.inp, { backgroundColor: c.input, color: c.text }]} placeholder={ph} placeholderTextColor={c.muted} value={text1} onChangeText={setText1} />
          {activeType === 'countdown' && (
            <TextInput style={[s.inp, { backgroundColor: c.input, color: c.text }]} placeholder="Hours from now (e.g. 24)" placeholderTextColor={c.muted} keyboardType="numeric" value={text2} onChangeText={setText2} />
          )}
          <TouchableOpacity style={[s.btn, { backgroundColor: BRAND }]} onPress={() => {
            if (!text1.trim()) return;
            if (activeType === 'question') addSticker('question', { prompt: text1.trim() });
            else if (activeType === 'slider') addSticker('slider', { prompt: text1.trim(), emoji: '🔥' });
            else {
              const hrs = Math.max(1, Number(text2) || 24);
              addSticker('countdown', { title: text1.trim(), targetAt: Date.now() + hrs * 3600000 });
            }
          }}><Text style={{ color: BRAND_TEXT, fontWeight: '800' }}>Add Sticker</Text></TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  const STICKERS: { k: StickerType | 'gif' | 'weather' | 'music'; label: string; icon: any; disabled?: boolean }[] = [
    { k: 'mention', label: '@Mention', icon: 'at' },
    { k: 'hashtag', label: '#Hashtag', icon: 'pricetag-outline' },
    { k: 'location', label: 'Location', icon: 'location-outline' },
    { k: 'link', label: 'Link', icon: 'link-outline' },
    { k: 'poll', label: 'Poll', icon: 'stats-chart-outline' },
    { k: 'question', label: 'Questions', icon: 'help-circle-outline' },
    { k: 'slider', label: 'Emoji Slider', icon: 'happy-outline' },
    { k: 'quiz', label: 'Quiz', icon: 'checkmark-done-circle-outline' },
    { k: 'countdown', label: 'Countdown', icon: 'time-outline' },
    { k: 'addYours', label: 'Add Yours', icon: 'copy-outline' },
    { k: 'datetime', label: 'Date & Time', icon: 'calendar-outline' },
    { k: 'gif', label: 'GIF (Unavailable)', icon: 'sparkles-outline', disabled: !capabilities.gifProvider },
    { k: 'weather', label: 'Weather (Unavailable)', icon: 'partly-sunny-outline', disabled: !capabilities.weatherProvider },
    { k: 'music', label: 'Music (Unavailable)', icon: 'musical-notes-outline', disabled: !capabilities.musicProvider },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <View style={s.bg}>
        <View style={[s.sheet, { backgroundColor: c.card }]}>
          <View style={s.head}>
            <Text style={{ color: c.text, fontWeight: '800', fontSize: 16 }}>{activeType ? activeType.toUpperCase() : 'Stickers'}</Text>
            <TouchableOpacity onPress={() => (activeType ? reset() : onClose())}><Ionicons name="close" size={22} color={c.text} /></TouchableOpacity>
          </View>
          {activeType ? renderBuilder() : (
            <ScrollView contentContainerStyle={s.grid}>
              {STICKERS.map((item) => (
                <TouchableOpacity
                  key={item.k}
                  style={[s.stCard, { backgroundColor: c.input, opacity: item.disabled ? 0.45 : 1 }]}
                  onPress={() => {
                    if (item.disabled) return Alert.alert('Unavailable', `${item.label.split(' ')[0]} provider is not configured in Flevora yet.`);
                    if (item.k === 'datetime') return addSticker('datetime', { label: new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) });
                    setActiveType(item.k as StickerType);
                  }}
                >
                  <Ionicons name={item.icon} size={22} color={BRAND} />
                  <Text style={{ color: c.text, fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

export function StoryStickerOverlay({
  story, sticker, myUid, isOwner, onAddYours,
}: {
  story: any; sticker: StoryStickerItem; myUid: string; isOwner: boolean; onAddYours?: (prompt: string) => void;
}) {
  const router = useRouter();
  const [qText, setQText] = useState('');
  const votes: Record<string, number> = story?.stickerVotes?.[sticker.id] || {};
  const myVote = myUid ? votes[myUid] : undefined;

  const castVote = async (idx: number) => {
    if (!myUid || myVote !== undefined) return;
    await updateDoc(doc(db, 'stories', story.id), { [`stickerVotes.${sticker.id}.${myUid}`]: idx }).catch(() => {});
  };

  const sendQuestion = async () => {
    if (!myUid || !qText.trim()) return;
    await updateDoc(doc(db, 'stories', story.id), {
      questionResponses: arrayUnion({ id: `qr_${Date.now()}`, uid: myUid, text: qText.trim(), createdAt: Date.now() }),
    }).catch(() => {});
    setQText('');
    Alert.alert('Sent', 'Your private response was sent to the creator.');
  };

  if (sticker.type === 'mention') {
    return (
      <TouchableOpacity style={s.pill} onPress={() => router.push(`/user/${sticker.data.uid}` as any)}>
        <Text style={s.pillTxt}>@{sticker.data.username}</Text>
      </TouchableOpacity>
    );
  }
  if (sticker.type === 'hashtag') {
    return (
      <TouchableOpacity style={s.pill} onPress={() => router.push('/explore' as any)}>
        <Text style={s.pillTxt}>{sticker.data.tag}</Text>
      </TouchableOpacity>
    );
  }
  if (sticker.type === 'location') {
    return <View style={s.pill}><Ionicons name="location" size={14} color="#111" /><Text style={s.pillTxt}>{sticker.data.place}</Text></View>;
  }
  if (sticker.type === 'datetime') {
    return <View style={s.pill}><Text style={s.pillTxt}>{sticker.data.label}</Text></View>;
  }
  if (sticker.type === 'link') {
    return (
      <TouchableOpacity style={s.pill} onPress={() => isValidHttpUrl(sticker.data.url) && Linking.openURL(sticker.data.url)}>
        <Ionicons name="link" size={14} color="#2563EB" />
        <Text style={[s.pillTxt, { color: '#2563EB' }]}>{sticker.data.label}</Text>
      </TouchableOpacity>
    );
  }
  if (sticker.type === 'poll' || sticker.type === 'quiz') {
    const total = Object.keys(votes).length;
    const opts: string[] = sticker.data.options || ['Yes', 'No'];
    return (
      <View style={s.card}>
        <Text style={s.cardQ}>{sticker.data.question}</Text>
        {opts.map((opt, idx) => {
          const cnt = Object.values(votes).filter((v) => v === idx).length;
          const pct = total ? Math.round((cnt / total) * 100) : 0;
          const isCorrect = sticker.type === 'quiz' && sticker.data.correctIndex === idx;
          return (
            <TouchableOpacity key={idx} onPress={() => castVote(idx)} style={[s.optBtn, myVote === idx && { borderColor: BRAND, borderWidth: 2 }]}>
              <Text style={{ fontWeight: '700', color: '#111', flex: 1 }}>{opt}</Text>
              {myVote !== undefined && <Text style={{ fontWeight: '800', color: isCorrect ? '#10B981' : '#111' }}>{pct}%</Text>}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }
  if (sticker.type === 'question') {
    const resps: any[] = Array.isArray(story?.questionResponses) ? story.questionResponses : [];
    return (
      <View style={s.card}>
        <Text style={s.cardQ}>{sticker.data.prompt}</Text>
        {isOwner ? (
          <Text style={{ color: '#4B5563', fontSize: 12, textAlign: 'center' }}>{resps.length} private responses (view in Activity)</Text>
        ) : (
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TextInput value={qText} onChangeText={setQText} placeholder="Type reply..." style={s.qInp} />
            <TouchableOpacity onPress={sendQuestion} style={[s.qSend, { backgroundColor: BRAND }]}><Ionicons name="send" size={14} color={BRAND_TEXT} /></TouchableOpacity>
          </View>
        )}
      </View>
    );
  }
  if (sticker.type === 'slider') {
    const vals = Object.values(votes);
    const avg = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    return (
      <View style={s.card}>
        <Text style={s.cardQ}>{sticker.data.prompt} ({vals.length ? `${avg}%` : sticker.data.emoji})</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {[25, 50, 75, 100].map((v) => (
            <TouchableOpacity key={v} onPress={() => castVote(v)} style={[s.chip, { backgroundColor: myVote === v ? BRAND : '#F3F4F6' }]}>
              <Text style={{ fontWeight: '700', color: '#111', fontSize: 12 }}>{v}% {sticker.data.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }
  if (sticker.type === 'countdown') {
    const hrs = Math.max(0, Math.floor(((sticker.data.targetAt || Date.now()) - Date.now()) / 3600000));
    return <View style={s.card}><Text style={s.cardQ}>⏳ {sticker.data.title}</Text><Text style={{ textAlign: 'center', fontWeight: '800', color: '#111' }}>{hrs}h remaining</Text></View>;
  }
  if (sticker.type === 'addYours') {
    return (
      <TouchableOpacity style={s.card} onPress={() => onAddYours?.(sticker.data.prompt)}>
        <Text style={s.cardQ}>{sticker.data.prompt}</Text>
        <Text style={{ textAlign: 'center', color: '#2563EB', fontWeight: '800', fontSize: 12 }}>+ Add Yours</Text>
      </TouchableOpacity>
    );
  }
  return null;
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '70%' },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stCard: { width: '30.5%', padding: 12, borderRadius: 12, alignItems: 'center', gap: 6 },
  inp: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  btn: { paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  pillTxt: { color: '#111', fontWeight: '800', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 12, width: 220, gap: 6 },
  cardQ: { color: '#111', fontWeight: '800', textAlign: 'center', fontSize: 14 },
  optBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8 },
  qInp: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, color: '#111' },
  qSend: { paddingHorizontal: 10, justifyContent: 'center', borderRadius: 8 },
});
