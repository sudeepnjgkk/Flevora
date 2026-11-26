import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NEON, useTheme } from './theme';

export function GlossyIcon({
  name,
  size = 23,
  active = false,
  accent = NEON.purple,
}: {
  name: keyof typeof Ionicons.glyphMap;
  size?: number;
  boxSize?: number;
  active?: boolean;
  accent?: string;
  glossy?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={{ justifyContent: 'center', alignItems: 'center', padding: 2 }}>
      <Ionicons name={name} size={size} color={active ? accent : c.text} />
    </View>
  );
}
