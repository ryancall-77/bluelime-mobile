// Push notifications (expo-notifications). Registers the device's Expo push
// token with the backend so the buyer gets deal alerts (the 60-min early-access
// head start is applied server-side). A push carries { deal_id } and taps
// deep-link into the deal detail.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { registerPushToken } from './api';

let currentToken: string | null = null;

// Show alerts as a banner even when the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Ask permission, mint an Expo push token, register it with the backend.
 * Best-effort: returns silently on simulators, denied permission, or if the
 * project id / backend endpoint isn't live yet.
 */
export async function registerForPush(): Promise<void> {
  try {
    if (!Device.isDevice) return; // no push on simulators/emulators

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('deals', {
        name: 'Deal alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== 'granted') {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== 'granted') return;

    const pid = projectId();
    const { data: token } = await Notifications.getExpoPushTokenAsync(pid ? { projectId: pid } : undefined);
    if (!token) return;
    currentToken = token;
    await registerPushToken(token);
  } catch {
    /* best-effort — push simply won't fire until this succeeds */
  }
}

export type PushData = {
  deal_id?: string;
  kind?: string;
} & Record<string, unknown>;

function dataFrom(resp: Notifications.NotificationResponse | null): PushData | null {
  return (resp?.notification?.request?.content?.data as PushData | undefined) ?? null;
}

/**
 * Fire `onTap(data)` when a notification is tapped (foreground/background) and
 * on cold start (app launched from a push). Returns an unsubscribe fn.
 */
export function onNotificationTap(onTap: (data: PushData) => void): () => void {
  Notifications.getLastNotificationResponseAsync().then((resp) => {
    const d = dataFrom(resp);
    if (d) onTap(d);
  });
  const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
    const d = dataFrom(resp);
    if (d) onTap(d);
  });
  return () => sub.remove();
}
