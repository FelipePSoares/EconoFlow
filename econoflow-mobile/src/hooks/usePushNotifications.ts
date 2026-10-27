import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import type * as ExpoNotifications from 'expo-notifications';
import { registerExpoPushToken as apiRegister, unregisterExpoPushToken as apiUnregister } from '../api/notifications.api';
import { useNotificationStore } from '../store/notificationStore';
import { captureError } from '../monitoring/sentry';

/**
 * Expo Go on Android stopped shipping remote notifications in SDK 53: the native module
 * `ExpoTopicSubscriptionModule` is never registered there, so the package throws as soon
 * as it is loaded. Short-circuit before touching it — the lazy load below still throws in
 * Expo Go, and dereferencing the missing module would add a misleading
 * "Cannot read property 'getPermissionsAsync' of undefined" on top of the real error.
 */
function isPushUnavailable(): boolean {
  return Platform.OS === 'android' && isRunningInExpoGo();
}

/**
 * Loads expo-notifications on demand instead of at module scope.
 *
 * Expo Go on Android never registers `ExpoTopicSubscriptionModule`, and
 * expo-notifications resolves it with `requireNativeModule` the moment the package is
 * imported (expo/expo#52175). A top-level `import` is therefore hoisted into the app's
 * startup graph — through `AppGate` → this module — and red-screens every screen
 * with "Cannot find native module 'ExpoTopicSubscriptionModule'" before anything renders.
 *
 * A plain `require` (not `import()`) is deliberate: Metro turns `import()` into an async
 * chunk, which does not resolve reliably inside Expo Go, while `require` loads the module
 * synchronously only when a push flow actually runs.
 */
function loadNotifications(): typeof ExpoNotifications {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof ExpoNotifications;
}

export async function registerPushNotificationsAsync(
  setExpoPushToken: (t: string) => void,
  setNotificationsEnabled: (v: boolean) => void,
): Promise<void> {
  if (!Device.isDevice) {
    // eslint-disable-next-line no-console
    console.warn('[PushNotifications] Registration skipped — not a physical device');
    captureError(new Error('Push registration skipped — not a physical device'), { screen: 'usePushNotifications', action: 'register' });
    return;
  }

  if (isPushUnavailable()) {
    // eslint-disable-next-line no-console
    console.warn('[PushNotifications] Registration skipped — push notifications are unavailable in Expo Go on Android');
    captureError(
      new Error('Push registration skipped — unavailable in Expo Go on Android'),
      { screen: 'usePushNotifications', action: 'register' },
    );
    return;
  }

  try {
    const Notifications = loadNotifications();
    if (!Notifications?.getPermissionsAsync) {
      throw new Error(
        "expo-notifications has no native module — cannot find 'ExpoTopicSubscriptionModule'",
      );
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      // eslint-disable-next-line no-console
      console.warn('[PushNotifications] Registration skipped — permission not granted', finalStatus);
      captureError(new Error('Push registration skipped — permission not granted'), { screen: 'usePushNotifications', action: 'register' });
      return;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    const deviceName = Platform.OS === 'ios' ? 'iOS' : 'Android';

    await apiRegister(token, deviceName);
    setExpoPushToken(token);
    setNotificationsEnabled(true);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PushNotifications] Registration failed', err);
    captureError(err, { screen: 'usePushNotifications', action: 'register' });
    setNotificationsEnabled(false);
  }
}

export async function unregisterPushNotificationsAsync(
  expoPushToken: string | null,
  clearNotificationState: () => void,
): Promise<void> {
  if (!expoPushToken) {
    return;
  }

  try {
    await apiUnregister(expoPushToken);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PushNotifications] Unregistration failed', err);
    captureError(err, { screen: 'usePushNotifications', action: 'unregister' });
  } finally {
    clearNotificationState();
  }
}

export const usePushNotifications = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);

  const expoPushToken = useNotificationStore((s) => s.expoPushToken);
  const notificationsEnabled = useNotificationStore((s) => s.notificationsEnabled);
  const setExpoPushToken = useNotificationStore((s) => s.setExpoPushToken);
  const setNotificationsEnabled = useNotificationStore((s) => s.setNotificationsEnabled);
  const clearNotificationState = useNotificationStore((s) => s.clearNotificationState);

  const registerPushNotifications = useCallback(async () => {
    setIsRegistering(true);
    try {
      await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);
    } finally {
      setIsRegistering(false);
    }
  }, [setExpoPushToken, setNotificationsEnabled]);

  const unregisterPushNotifications = useCallback(async () => {
    setIsUnregistering(true);
    try {
      await unregisterPushNotificationsAsync(expoPushToken, clearNotificationState);
    } finally {
      setIsUnregistering(false);
    }
  }, [expoPushToken, clearNotificationState]);

  return {
    notificationsEnabled,
    isRegistering,
    isUnregistering,
    registerPushNotifications,
    unregisterPushNotifications,
  };
};
