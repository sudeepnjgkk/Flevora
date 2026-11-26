import React, { useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND, useTheme } from './theme';
import UploadScreen from '../app/upload';

const TABS: Record<string, { icon: any; activeIcon: any }> = {
  index: { icon: 'home-outline', activeIcon: 'home' },
  explore: { icon: 'search-outline', activeIcon: 'search' },
  upload: { icon: 'add-circle-outline', activeIcon: 'add-circle' },
  reels: { icon: 'play-circle-outline', activeIcon: 'play-circle' },
  profile: { icon: 'person-circle-outline', activeIcon: 'person-circle' },
};

export function CustomTabBar({ state, navigation }: any) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <>
      <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 6), backgroundColor: c.tabBg, borderTopColor: c.border }]}>
        {state.routes.map((route: any, index: number) => {
          const cfg = TABS[route.name];
          if (!cfg) return null;
          const focused = state.index === index;
          const isCreate = route.name === 'upload';

          return (
            <TouchableOpacity
              key={route.key}
              activeOpacity={0.7}
              style={s.btn}
              onPress={() => (isCreate ? setUploadOpen(true) : navigation.navigate(route.name))}
            >
              <Ionicons
                name={focused ? cfg.activeIcon : cfg.icon}
                size={isCreate ? 29 : 26}
                color={focused ? BRAND : c.text}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      <Modal visible={uploadOpen} animationType="slide" onRequestClose={() => setUploadOpen(false)}>
        <UploadScreen initialMode="POST" onClose={() => setUploadOpen(false)} />
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', minHeight: 54, borderTopWidth: 0.5 },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
});
