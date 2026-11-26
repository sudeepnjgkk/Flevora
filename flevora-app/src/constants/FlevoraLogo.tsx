import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { NEON, useTheme } from './theme';

export function FlevoraLogo({ size = 36, showText = false }: { size?: number; showText?: boolean }) {
  const { c } = useTheme();
  const radius = Math.round(size * 0.26);

  return (
    <View style={s.row}>
      <View style={[s.glowWrap, { width: size, height: size, borderRadius: radius, shadowColor: NEON.magenta }]}>
        <Image source={require('../../assets/images/icon.png')} style={{ width: size, height: size, borderRadius: radius }} resizeMode="cover" />
      </View>
      {showText && <Text style={[s.word, { color: c.text, fontSize: Math.max(19, size * 0.56) }]}>Flevora</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  glowWrap: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 10, elevation: 8 },
  word: { fontWeight: '900', letterSpacing: -0.5 },
});
