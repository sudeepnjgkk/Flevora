import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BRAND = '#8B5CF6';
export const NEON = {
  purple: '#8B5CF6',
  violet: '#6D28D9',
  magenta: '#D946EF',
  pink: '#EC4899',
  orange: '#F97316',
};

export const Spacing = { zero: 0, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#FFFFFF',
    card: '#F8FAFC',
    surface: '#F1F5F9',
    input: '#F1F5F9',
    border: '#E2E8F0',
    muted: '#64748B',
    tint: BRAND,
    pink: NEON.pink,
    orange: NEON.orange,
    tabBg: 'rgba(255,255,255,0.96)',
    glow: 'rgba(139,92,246,0.22)',
  },
  dark: {
    text: '#F8FAFC',
    background: '#07070B',
    card: '#12121A',
    surface: '#1A1A26',
    input: '#1E1E2B',
    border: '#272736',
    muted: '#94A3B8',
    tint: BRAND,
    pink: NEON.pink,
    orange: NEON.orange,
    tabBg: 'rgba(15,15,22,0.96)',
    glow: 'rgba(217,70,239,0.32)',
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

  return (
    <ThemeContext.Provider value={{ isDark, toggleTheme, c: isDark ? Colors.dark : Colors.light }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
