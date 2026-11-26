import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NEON, useTheme } from './theme';

export function GlossyIcon({
  name,
  size = 22,
  boxSize = 40,
  active = false,
  accent = NEON.purple,
  glossy = true,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  boxSize?: number;
  active?: boolean;
  accent?: string;
  glossy?: boolean;
}) {
  const { isDark, c } = useTheme();
  const radius = Math.round(boxSize * 0.34);

  if (!glossy && !active) {
    return <Ionicons name={name} size={size} color={c.text} />;
  }

  const bg = active ? accent : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(139,92,246,0.10)';
  const iconColor = active ? '#FFFFFF' : isDark ? '#F8FAFC' : accent;

  return (
    <View
      style={[
        s.box,
        {
          width: boxSize,
          height: boxSize,
          borderRadius: radius,
          backgroundColor: bg,
          borderColor: active ? 'rgba(255,255,255,0.45)' : c.border,
          shadowColor: active ? accent : '#000',
          shadowOpacity: active ? 0.5 : 0.12,
          elevation: active ? 8 : 2,
        },
      ]}
    >
      <View style={[s.shine, { width: boxSize * 0.72, height: boxSize * 0.34, borderRadius: radius }]} />
      <Ionicons name={name} size={size} color={iconColor} />
    </View>
  );
}

const s = StyleSheet.create({
  box: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
  },
  shine: {
    position: 'absolute',
    top: 2,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
});
