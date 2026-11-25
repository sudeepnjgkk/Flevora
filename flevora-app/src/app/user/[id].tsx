import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import { UserProfileView } from '../../constants/UserProfileView';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <UserProfileView id={id || ''} />;
}
