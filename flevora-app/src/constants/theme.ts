import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const BRAND = '#8B5CF6';

export const Spacing = {
  zero: 0,
    one: 4,
      two: 8,
        three: 16,
          four: 24,
            five: 32,
              six: 64,
              } as const;

              export const Colors = {
                light: {
                    text: '#111827',
                        background: '#FFFFFF',
                            card: '#F9FAFB',
                                input: '#F3F4F6',
                                    border: '#E5E7EB',
                                        muted: '#6B7280',
                                            tint: BRAND,
                                              },
                                                dark: {
                                                    text: '#F9FAFB',
                                                        background: '#0F0F13',
                                                            card: '#1A1A22',
                                                                input: '#23232E',
                                                                    border: '#2E2E3A',
                                                                        muted: '#9CA3AF',
                                                                            tint: BRAND,
                                                                              },
                                                                              };

                                                                              type ThemeCtx = { isDark: boolean; toggleTheme: () => void; c: typeof Colors.light };

                                                                              const ThemeContext = createContext<ThemeCtx>({
                                                                                isDark: false,
                                                                                  toggleTheme: () => {},
                                                                                    c: Colors.light,
                                                                                    });

                                                                                    export function ThemeProvider({ children }: { children: React.ReactNode }) {
                                                                                      const [isDark, setIsDark] = useState(false);

                                                                                        useEffect(() => {
                                                                                            AsyncStorage.getItem('flevora_dark').then((v) => {
                                                                                                  if (v === 'true') setIsDark(true);
                                                                                                      });
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
                                                                                                                                                      