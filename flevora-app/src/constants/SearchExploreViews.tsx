import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, BRAND } from './theme';
import { getThumbUrl } from './searchHelpers';

const SCREEN_W = Dimensions.get('window').width;
export const TILE_W = (SCREEN_W - 4) / 3;

export function ExploreSkeleton() {
  const { c } = useTheme();
  return (
    <View style={styles.skelGrid}>
      {Array.from({ length: 12 }).map((_, i) => (
        <View key={i} style={[styles.skelTile, { backgroundColor: c.input }]} />
      ))}
    </View>
  );
}

export function HighlightedText({ text, query, style }: { text: string; query: string; style?: any }) {
  const q = query.trim();
  if (!q) return <Text style={style} numberOfLines={1}>{text}</Text>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <Text style={style} numberOfLines={1}>{text}</Text>;
  return (
    <Text style={style} numberOfLines={1}>
      {text.slice(0, idx)}
      <Text style={{ fontWeight: '800', color: BRAND }}>{text.slice(idx, idx + q.length)}</Text>
      {text.slice(idx + q.length)}
    </Text>
  );
}

export function AccountRow({
  user, me, myUid, onPressProfile, onToggleFollow,
}: {
  user: any; me: any; myUid: string; onPressProfile: () => void; onToggleFollow: () => void;
}) {
  const { c } = useTheme();
  const isFollowing = Array.isArray(me?.following) && me.following.includes(user.id);
  const isRequested = Array.isArray(user.followRequests) && user.followRequests.includes(myUid);
  const label = isFollowing ? 'Following' : isRequested ? 'Requested' : user.isPrivate ? 'Request' : 'Follow';

  return (
    <TouchableOpacity style={[styles.accRow, { borderBottomColor: c.border }]} onPress={onPressProfile}>
      {user.avatar ? (
        <Image source={{ uri: user.avatar }} style={styles.accAv} />
      ) : (
        <View style={[styles.accAv, { backgroundColor: BRAND, justifyContent: 'center', alignItems: 'center' }]}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>
            {(user.username || 'U')[0].toUpperCase()}
          </Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: 14 }} numberOfLines={1}>@{user.username}</Text>
          {(user.isVerified || user.verified) && <Ionicons name="checkmark-circle" size={14} color="#3B82F6" />}
          {user.isPrivate && <Ionicons name="lock-closed" size={12} color={c.muted} />}
        </View>
        {!!user.fullName && <Text style={{ color: c.muted, fontSize: 13 }} numberOfLines={1}>{user.fullName}</Text>}
        {!!user.bio && !user.isPrivate && (
          <Text style={{ color: c.muted, fontSize: 12, marginTop: 1 }} numberOfLines={1}>{user.bio}</Text>
        )}
      </View>
      {user.id !== myUid && (
        <TouchableOpacity
          onPress={onToggleFollow}
          style={[styles.fBtn, { backgroundColor: isFollowing || isRequested ? c.input : BRAND }]}
        >
          <Text style={{ color: isFollowing || isRequested ? c.text : '#fff', fontWeight: '700', fontSize: 12 }}>
            {label}
          </Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export function ExploreTile({
  item, tall, onPress,
}: {
  item: any; tall?: boolean; onPress: () => void;
}) {
  const { c } = useTheme();
  const [failed, setFailed] = useState(false);
  const uri = getThumbUrl(item);
  const isVideo = item.mediaType === 'video';
  const isMulti = Array.isArray(item.media) && item.media.length > 1;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.tile, { height: tall ? TILE_W * 1.4 : TILE_W, backgroundColor: c.input }]}
    >
      {uri && !failed ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} />
      ) : (
        <View style={styles.fallback}>
          <Ionicons name={isVideo ? 'videocam-outline' : 'image-outline'} size={24} color={c.muted} />
        </View>
      )}
      {isVideo && (
        <View style={styles.badge}>
          <Ionicons name="play" size={14} color="#fff" />
        </View>
      )}
      {!isVideo && isMulti && (
        <View style={styles.badge}>
          <Ionicons name="copy-outline" size={14} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  skelGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingTop: 4 },
  skelTile: { width: TILE_W, height: TILE_W },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 0.5 },
  accAv: { width: 46, height: 46, borderRadius: 23 },
  fBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  tile: { width: TILE_W, margin: 0.6, overflow: 'hidden', position: 'relative' },
  fallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  badge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, padding: 4 },
});
