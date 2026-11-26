import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BRAND = '#8B5CF6';
export const NEON = {
  purple: '#8B5CF6',
  violet: '#7C3AED',
  magenta: '#D946EF',
  pink: '#EC4899',
  orange: '#F97316',
};

export const Spacing = { zero: 0, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

export const Colors = {
  light: {
    text: '#111111',
    background: '#FFFFFF',
    card: '#FFFFFF',
    surface: '#F3F4F6',
    input: '#F3F4F6',
    border: '#E5E7EB',
    muted: '#6B7280',
    tint: BRAND,
    pink: NEON.pink,
    orange: NEON.orange,
    tabBg: '#FFFFFF',
    glow: 'rgba(139,92,246,0.12)',
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    card: '#121212',
    surface: '#1E1E1E',
    input: '#1E1E1E',
    border: '#262626',
    muted: '#9CA3AF',
    tint: BRAND,
    pink: NEON.pink,
    orange: NEON.orange,
    tabBg: '#000000',
    glow: 'rgba(139,92,246,0.18)',
  },
};

type ThemeCtx = { isDark: boolean; toggleTheme: () => void; c: typeof Colors.light };
const ThemeContext = createContext<ThemeCtx>({ isDark: false, toggleTheme: () => {}, c: Colors.light });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('flevora_dark').then((v) => { if (v === 'true') setIsDark(true); });
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      AsyncStorage.setItem('flevora_dark', String(next));
      return next;
    });
  };

  return React.createElement(
    ThemeContext.Provider,
    { value: { isDark, toggleTheme, c: isDark ? Colors.dark : Colors.light } },
    children
  );
}

export const useTheme = () => useContext(ThemeContext);
