import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { registerExpoPushToken as apiRegister, unregisterExpoPushToken as apiUnregister } from '../api/notifications.api';
import { useNotificationStore } from '../store/notificationStore';
import { captureError } from '../monitoring/sentry';

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

  try {
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
