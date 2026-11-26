import React, { useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NEON } from './theme';

export function GradientButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  accent = NEON.purple,
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  accent?: string;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={onPress}
        disabled={disabled || loading}
        style={[s.btn, { backgroundColor: accent, shadowColor: NEON.magenta, opacity: disabled ? 0.5 : 1 }]}
      >
        <View style={s.highlight} />
        <View style={s.pinkTint} />
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.txt}>{title}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  btn: {
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  highlight: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.18)' },
  pinkTint: { position: 'absolute', right: -20, top: -10, width: 120, height: 80, borderRadius: 40, backgroundColor: 'rgba(236,72,153,0.42)' },
  txt: { color: '#FFFFFF', fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },
});
