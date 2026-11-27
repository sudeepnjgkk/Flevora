import React, { useEffect, useRef, useState } from 'react';
import { Animated, TouchableOpacity, Pressable, View, StyleSheet, AccessibilityInfo } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from './theme';

export function AnimatedLikeButton({
  liked,
  onPress,
  size = 25,
  inactiveColor,
}: {
  liked: boolean;
  onPress: () => void;
  size?: number;
  inactiveColor?: string;
}) {
  const { c } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
  }, []);

  const triggerPress = () => {
    if (!reduceMotion) {
      scale.setValue(liked ? 0.85 : 1.28);
      Animated.spring(scale, {
        toValue: 1,
        friction: 5,
        tension: 180,
        useNativeDriver: true,
      }).start();
    }
    onPress();
  };

  return (
    <TouchableOpacity onPress={triggerPress} accessibilityRole="button" accessibilityLabel={liked ? 'Unlike' : 'Like'}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={liked ? 'heart' : 'heart-outline'}
          size={size}
          color={liked ? '#EF4444' : (inactiveColor || c.text)}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}

export function DoubleTapHeartOverlay({
  onDoubleTap,
  onSingleTap,
  children,
  style,
}: {
  onDoubleTap: () => void;
  onSingleTap?: () => void;
  children: React.ReactNode;
  style?: any;
}) {
  const lastTapRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const playHeartBurst = () => {
    scale.setValue(0.4);
    opacity.setValue(1);
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.15, friction: 5, tension: 160, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 260, delay: 140, useNativeDriver: true }),
    ]).start();
  };

  const handlePress = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      lastTapRef.current = 0;
      playHeartBurst();
      onDoubleTap();
    } else {
      lastTapRef.current = now;
      if (onSingleTap) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          onSingleTap();
        }, 280);
      }
    }
  };

  return (
    <Pressable onPress={handlePress} style={[styles.wrap, style]}>
      {children}
      <Animated.View pointerEvents="none" style={[styles.centerHeart, { opacity, transform: [{ scale }] }]}>
        <Ionicons name="heart" size={92} color="rgba(239, 68, 68, 0.95)" />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  centerHeart: { position: 'absolute', alignSelf: 'center', zIndex: 30 },
});
