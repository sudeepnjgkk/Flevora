import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../config';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const FALLBACK_PROJECT_ID = '7119d874-b3a1-4df4-bb62-c8c3829c9615';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function registerPushToken(uid: string): Promise<string | null> {
  try {
    if (!uid || !Device.isDevice) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#D9FF36',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return null;

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      FALLBACK_PROJECT_ID;

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenRes.data;
    if (token) {
      await updateDoc(doc(db, 'users', uid), { pushToken: token });
    }
    return token ?? null;
  } catch {
    return null;
  }
}

export async function sendPush(
  toToken: string | undefined | null,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<boolean> {
  if (!toToken || (!toToken.startsWith('ExponentPushToken[') && !toToken.startsWith('ExpoPushToken['))) {
    return false;
  }

  const payload = JSON.stringify({
    to: toToken,
    sound: 'default',
    title,
    body,
    data: data ?? {},
    channelId: 'default',
  });

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: payload,
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (res.ok) return true;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return false;
      }
    } catch {
      clearTimeout(timer);
    }

    if (attempt < maxAttempts) {
      await wait(attempt * 800);
    }
  }
  return false;
}
