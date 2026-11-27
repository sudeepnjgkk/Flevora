import React from 'react';
import { useRouter } from 'expo-router';
import { ProfileSettingsModal } from '../constants/ProfileSettingsModal';

export default function SettingsScreen({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  return <ProfileSettingsModal visible={true} onClose={() => (onClose ? onClose() : router.back())} />;
}
