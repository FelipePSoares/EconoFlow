import { useState, useCallback } from 'react';
import { Linking, Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import * as Device from 'expo-device';
import type * as ExpoNotifications from 'expo-notifications';
import { registerExpoPushToken as apiRegister, unregisterExpoPushToken as apiUnregister } from '../api/notifications.api';
import { useNotificationStore } from '../store/notificationStore';
import type { PushPermissionStatus } from '../store/notificationStore';
import { captureError } from '../monitoring/sentry';

/** Android notification channel created before the permission is requested. */
export const NOTIFICATION_CHANNEL_ID = 'default';

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

interface PermissionSnapshot {
  status: string;
  canAskAgain: boolean;
}

const toPermissionStatus = (status: string): PushPermissionStatus =>
  status === 'granted' || status === 'denied' ? status : 'undetermined';

/**
 * Reads the OS permission into the store. Returns `null` when the permission cannot be
 * queried at all (no native module, simulator, Expo Go), so callers can leave the
 * previous state untouched instead of guessing.
 */
async function refreshPermissionState(): Promise<PermissionSnapshot | null> {
  if (!Device.isDevice || isPushUnavailable()) {
    return null;
  }

  const Notifications = loadNotifications();
  if (!Notifications?.getPermissionsAsync) {
    return null;
  }

  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  useNotificationStore.getState().setPermissionState(toPermissionStatus(status), canAskAgain !== false);
  return { status, canAskAgain: canAskAgain !== false };
}

/** The `default` channel must exist before the Android 13+ permission dialog is shown. */
async function ensureNotificationChannel(
  Notifications: typeof ExpoNotifications,
): Promise<void> {
  if (Platform.OS !== 'android' || !Notifications?.setNotificationChannelAsync) {
    return;
  }

  try {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
      name: 'Default',
      importance: Notifications.AndroidImportance?.MAX ?? 5,
    });
  } catch (err) {
    // A missing channel degrades delivery; it must not block the permission flow.
    // eslint-disable-next-line no-console
    console.warn('[PushNotifications] Could not create the notification channel', err);
  }
}

/**
 * Asks for the push token and registers it with the backend, without ever showing the OS
 * permission dialog. Used once the permission is known to be granted, and by the Profile
 * toggle, whose user already expressed intent.
 */
export async function registerPushNotificationsAsync(
  setExpoPushToken: (t: string) => void,
  setNotificationsEnabled: (v: boolean) => void,
  options: { requestPermission?: boolean } = {},
): Promise<PushRegistrationResult> {
  const requestPermission = options.requestPermission ?? true;

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

    // The permission calls get their own guard: when either one throws (a native
    // module failure, a device that cannot answer the query) the user's fix is still
    // to allow notifications in the system settings, so it must not be reported as a
    // generic "try again later" failure.
    let finalStatus: string;
    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      finalStatus = existingStatus;
      useNotificationStore.getState().setPermissionState(toPermissionStatus(existingStatus));

      // The explicit toggle path passes `requestPermission: false`: the user's intent is
      // already known and asking here would re-open a dialog the OS may refuse to show.
      if (existingStatus !== 'granted' && requestPermission) {
        await ensureNotificationChannel(Notifications);
        const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        useNotificationStore
          .getState()
          .setPermissionState(toPermissionStatus(status), canAskAgain !== false);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PushNotifications] Permission query failed', err);
      captureError(err, { screen: 'usePushNotifications', action: 'register' });
      setNotificationsEnabled(false);
      return { ok: false, reason: 'permission' };
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

let permissionFlowInFlight: Promise<PushRegistrationResult> | null = null;

/**
 * The single entry point for "may we notify this user?" — used by the post-login prompt
 * and the Profile toggle, never by an individual auth screen.
 *
 * Rules, in order:
 * 1. only a physical device on a platform with push support is asked anything;
 * 2. the OS status is read first — `granted` registers without a dialog,
 *    `undetermined` asks, `denied` never asks again;
 * 3. the dialog is shown at most once per user, tracked by `hasPromptedForPermission`
 *    (persisted), so the common "re-open the app" case stays silent;
 * 4. the Android channel exists before the dialog, because Android 13+ renders the
 *    notification permission prompt as part of it.
 *
 * Concurrent callers share the in-flight promise: the login hook and a tapping user must
 * not open the dialog twice.
 */
export function requestNotificationPermissionAndRegister(): Promise<PushRegistrationResult> {
  if (permissionFlowInFlight) {
    return permissionFlowInFlight;
  }

  permissionFlowInFlight = (async (): Promise<PushRegistrationResult> => {
    const store = useNotificationStore.getState();
    const { setExpoPushToken, setNotificationsEnabled, setLastPermissionError } = store;
    // A fresh attempt: the banner from a previous attempt must not linger.
    setLastPermissionError(null);

    let snapshot: PermissionSnapshot | null;
    try {
      snapshot = await refreshPermissionState();
    } catch (err) {
      // A permission query that throws is still a permission problem for the user.
      // eslint-disable-next-line no-console
      console.error('[PushNotifications] Permission query failed', err);
      captureError(err, { screen: 'usePushNotifications', action: 'requestPermission' });
      setNotificationsEnabled(false);
      setLastPermissionError('permission');
      return { ok: false, reason: 'permission' };
    }

    if (snapshot === null) {
      // Not a physical device / Expo Go on Android: report it exactly like the
      // registration does, and leave the prompt answer alone so a dev build still asks.
      const unavailable = await registerPushNotificationsAsync(
        setExpoPushToken,
        setNotificationsEnabled,
        { requestPermission: false },
      );
      if (!unavailable.ok) setLastPermissionError(unavailable.reason);
      return unavailable;
    }

    if (snapshot.status === 'granted') {
      // Nothing to ask: register straight away. The channel is created here too — a user
      // who allowed notifications in the system settings never passed the dialog and
      // would otherwise have no `default` channel for the backend pushes (#1053).
      try {
        await ensureNotificationChannel(loadNotifications());
      } catch (err) {
        // A missing channel degrades delivery; it must not block the registration.
        captureError(err, { screen: 'usePushNotifications', action: 'ensureChannel' });
      }
      const registered = await registerPushNotificationsAsync(
        setExpoPushToken,
        setNotificationsEnabled,
        { requestPermission: false },
      );
      if (!registered.ok) setLastPermissionError(registered.reason);
      return registered;
    }

    const { hasPromptedForPermission, canAskForPermission } = useNotificationStore.getState();

    if (snapshot.status === 'denied') {
      // The dialog is answerable exactly once on iOS and after two dismissals on
      // Android; a second request is a silent no-op that would look like a bug.
      if (!hasPromptedForPermission) {
        useNotificationStore.getState().setHasPromptedForPermission(true);
      }
      setNotificationsEnabled(false);
      return { ok: false, reason: 'permission' };
    }

    if (hasPromptedForPermission || !canAskForPermission) {
      setNotificationsEnabled(false);
      return { ok: false, reason: 'permission' };
    }

    try {
      const Notifications = loadNotifications();
      await ensureNotificationChannel(Notifications);
      const { status, canAskAgain } = await Notifications.requestPermissionsAsync();
      useNotificationStore
        .getState()
        .setPermissionState(toPermissionStatus(status), canAskAgain !== false);
      // Answering the dialog (either way) is the "asked once" event.
      useNotificationStore.getState().setHasPromptedForPermission(true);

      if (status !== 'granted') {
        // eslint-disable-next-line no-console
        console.warn('[PushNotifications] Permission not granted', status);
        captureError(new Error('Push registration skipped — permission not granted'), { screen: 'usePushNotifications', action: 'requestPermission' });
        setNotificationsEnabled(false);
        return { ok: false, reason: 'permission' };
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[PushNotifications] Permission request failed', err);
      captureError(err, { screen: 'usePushNotifications', action: 'requestPermission' });
      setNotificationsEnabled(false);
      setLastPermissionError('permission');
      return { ok: false, reason: 'permission' };
    }

    // The permission is granted now, so the token can be registered without re-asking.
    // `hasPromptedForPermission` was recorded from what the user saw, not from `status`
    // alone — and the backend call has to run either way so the device is subscribed.
    const registered = await registerPushNotificationsAsync(
      setExpoPushToken,
      setNotificationsEnabled,
      { requestPermission: false },
    );

    if (!registered.ok && registered.reason === 'permission') {
      // Permission was granted a moment ago, so a "permission" failure here can only be
      // the native query failing mid-flight: say so rather than blaming the user.
      setLastPermissionError('unknown');
      return { ok: false, reason: 'unknown' };
    }

    if (!registered.ok) {
      setLastPermissionError(registered.reason);
    }

    return registered;
  })();

  return permissionFlowInFlight.finally(() => {
    permissionFlowInFlight = null;
  });
}

/** Opens the OS notification settings for this app (the only fix once "don't ask again"). */
export function openNotificationSettings(): void {
  Linking.openSettings().catch((err) => {
    captureError(err, { screen: 'usePushNotifications', action: 'openSettings' });
  });
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
  const pushPermissionStatus = useNotificationStore((s) => s.pushPermissionStatus);
  const canAskForPermission = useNotificationStore((s) => s.canAskForPermission);
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

  /**
   * Re-reads the OS permission so the Profile toggle cannot claim ON while the system
   * blocks notifications. `ProfileScreen` runs it on mount, since the user may have
   * changed the permission in the system settings while the app was backgrounded.
   *
   * When the permission is granted but no token was ever registered, nothing on this
   * device is subscribed yet, so the registration runs once to make the state truthful.
   */
  const syncPermissionState = useCallback(async () => {
    let snapshot: PermissionSnapshot | null = null;
    try {
      snapshot = await refreshPermissionState();
    } catch (err) {
      // Keep whatever the store already believes: a failed query is not a revocation.
      captureError(err, { screen: 'usePushNotifications', action: 'syncPermission' });
      return;
    }

    if (snapshot === null) return;

    if (snapshot.status !== 'granted') {
      // Without the OS permission no token can work, so the toggle must read OFF even
      // while the backend still holds a registration for this device.
      const store = useNotificationStore.getState();
      if (store.notificationsEnabled || store.expoPushToken) {
        store.setNotificationsEnabled(false);
      }
      return;
    }

    const { expoPushToken: token } = useNotificationStore.getState();
    if (!token) {
      await registerPushNotifications();
    }
  }, [registerPushNotifications]);

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
    pushPermissionStatus,
    canAskForPermission,
    isRegistering,
    isUnregistering,
    pushNotificationsError,
    registerPushNotifications,
    unregisterPushNotifications,
    retryPushNotificationsRegistration: registerPushNotifications,
    syncPermissionState,
    clearPushNotificationsError,
  };
};
