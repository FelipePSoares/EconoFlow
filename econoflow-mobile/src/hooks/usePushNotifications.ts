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

/**
 * Why activation failed, so the UI can show an actionable message instead of a
 * generic one. Every failure also reaches Sentry; the reason only drives copy.
 */
export type PushRegistrationFailure =
  | 'device'
  | 'unavailable'
  | 'permission'
  | 'api'
  | 'unknown';

export type PushRegistrationResult =
  | { ok: true }
  | { ok: false; reason: PushRegistrationFailure };

export type PushUnregistrationResult = { ok: true } | { ok: false };

/**
 * What the Profile banner reports. Registration failures are re-used verbatim
 * and disabling gets its own reason, because "try again" is not a sensible
 * action there.
 */
export type PushNotificationsError = PushRegistrationFailure | 'unregister';

export async function registerPushNotificationsAsync(
  setExpoPushToken: (t: string) => void,
  setNotificationsEnabled: (v: boolean) => void,
): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    // eslint-disable-next-line no-console
    console.warn('[PushNotifications] Registration skipped — not a physical device');
    captureError(new Error('Push registration skipped — not a physical device'), { screen: 'usePushNotifications', action: 'register' });
    return { ok: false, reason: 'device' };
  }

  if (isPushUnavailable()) {
    // eslint-disable-next-line no-console
    console.warn('[PushNotifications] Registration skipped — push notifications are unavailable in Expo Go on Android');
    captureError(
      new Error('Push registration skipped — unavailable in Expo Go on Android'),
      { screen: 'usePushNotifications', action: 'register' },
    );
    return { ok: false, reason: 'unavailable' };
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
      return { ok: false, reason: 'permission' };
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;
    const deviceName = Platform.OS === 'ios' ? 'iOS' : 'Android';

    try {
      await apiRegister(token, deviceName);
    } catch (err) {
      // Only the backend call is marked 'api': everything thrown before it is a
      // local/native failure, which the UI words differently.
      // eslint-disable-next-line no-console
      console.error('[PushNotifications] Registration failed', err);
      captureError(err, { screen: 'usePushNotifications', action: 'register' });
      setNotificationsEnabled(false);
      return { ok: false, reason: 'api' };
    }

    setExpoPushToken(token);
    setNotificationsEnabled(true);
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PushNotifications] Registration failed', err);
    captureError(err, { screen: 'usePushNotifications', action: 'register' });
    setNotificationsEnabled(false);
    return { ok: false, reason: 'unknown' };
  }
}

export async function unregisterPushNotificationsAsync(
  expoPushToken: string | null,
  clearNotificationState: () => void,
): Promise<PushUnregistrationResult> {
  if (!expoPushToken) {
    return { ok: true };
  }

  try {
    await apiUnregister(expoPushToken);
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[PushNotifications] Unregistration failed', err);
    captureError(err, { screen: 'usePushNotifications', action: 'unregister' });
    return { ok: false };
  } finally {
    // The local token is gone either way: retrying a removal the server already
    // performed would fail forever, so the device stops believing it is subscribed.
    clearNotificationState();
  }
}

export const usePushNotifications = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isUnregistering, setIsUnregistering] = useState(false);
  const [pushNotificationsError, setPushNotificationsError] =
    useState<PushNotificationsError | null>(null);

  const expoPushToken = useNotificationStore((s) => s.expoPushToken);
  const notificationsEnabled = useNotificationStore((s) => s.notificationsEnabled);
  const setExpoPushToken = useNotificationStore((s) => s.setExpoPushToken);
  const setNotificationsEnabled = useNotificationStore((s) => s.setNotificationsEnabled);
  const clearNotificationState = useNotificationStore((s) => s.clearNotificationState);

  const registerPushNotifications = useCallback(async () => {
    setIsRegistering(true);
    setPushNotificationsError(null);
    try {
      const result = await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);
      if (!result.ok) setPushNotificationsError(result.reason);
      return result;
    } finally {
      setIsRegistering(false);
    }
  }, [setExpoPushToken, setNotificationsEnabled]);

  const unregisterPushNotifications = useCallback(async () => {
    setIsUnregistering(true);
    setPushNotificationsError(null);
    try {
      const result = await unregisterPushNotificationsAsync(expoPushToken, clearNotificationState);
      if (!result.ok) {
        // The local state was cleared anyway, so the toggle would read OFF while
        // the server still has the token; say so instead of failing silently.
        setPushNotificationsError('unregister');
        setNotificationsEnabled(true);
        setExpoPushToken(expoPushToken ?? '');
      }
      return result;
    } finally {
      setIsUnregistering(false);
    }
  }, [expoPushToken, clearNotificationState, setNotificationsEnabled, setExpoPushToken]);

  const clearPushNotificationsError = useCallback(() => {
    setPushNotificationsError(null);
  }, []);

  return {
    notificationsEnabled,
    isRegistering,
    isUnregistering,
    pushNotificationsError,
    registerPushNotifications,
    unregisterPushNotifications,
    retryPushNotificationsRegistration: registerPushNotifications,
    clearPushNotificationsError,
  };
};
