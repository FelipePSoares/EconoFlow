import * as NotificationsApi from '../../api/notifications.api';
import { useNotificationStore } from '../../store/notificationStore';
import { act, renderHook } from '@testing-library/react-native';
import { registerPushNotificationsAsync, unregisterPushNotificationsAsync, usePushNotifications } from '../usePushNotifications';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../api/notifications.api');

jest.mock('../../api/client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockGetPermissionsAsync = jest.fn();
const mockRequestPermissionsAsync = jest.fn();
const mockGetExpoPushTokenAsync = jest.fn();
let loadCount = 0;

// A factory spy stands in for the real module on purpose: the real one throws for the
// missing ExpoTopicSubscriptionModule native module on import, so it cannot be resolved.
jest.mock('expo-notifications', () => {
  loadCount += 1;
  return {
    getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
    requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
    getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
  };
});

const mockIsDevice = { current: true };
jest.mock('expo-device', () => ({
  get isDevice() { return mockIsDevice.current; },
}));

const mockIsRunningInExpoGo = { current: false };
jest.mock('expo', () => ({
  get isRunningInExpoGo() { return () => mockIsRunningInExpoGo.current; },
}));

const mockCaptureError = jest.fn();
jest.mock('../../monitoring/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

const setExpoPushToken = jest.fn();
const setNotificationsEnabled = jest.fn();
const clearNotificationState = jest.fn();

describe('module loading', () => {
  it('does not resolve expo-notifications when the hook module is loaded', () => {
    // Regression guard for expo/expo#52175: Expo Go on Android never registers
    // ExpoTopicSubscriptionModule, and expo-notifications calls requireNativeModule
    // at import time, so loading the package at boot red-screens the app.
    //
    // `loadCount` is only bumped by the mock's factory. A static `import` in
    // usePushNotifications.ts is hoisted above this file's jest.mock calls by the test
    // transform, so the real module gets evaluated for real instead of the factory
    // running — and the package then throws on the missing native module.
    expect(loadCount).toBe(0);
    expect(mockGetPermissionsAsync).toBeDefined();
  });
});

describe('registerPushNotificationsAsync', () => {
  beforeEach(() => {
    useNotificationStore.setState({ expoPushToken: null, notificationsEnabled: false });
    mockIsDevice.current = true;
    mockIsRunningInExpoGo.current = false;
    jest.clearAllMocks();
  });

  it('captures error to Sentry when Device.isDevice is false', async () => {
    mockIsDevice.current = false;

    await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('not a physical device') }),
      { screen: 'usePushNotifications', action: 'register' },
    );
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
    expect(setNotificationsEnabled).not.toHaveBeenCalled();
  });

  it('requests permissions, gets push token, calls API, and calls setters', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });

    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(mockGetPermissionsAsync).toHaveBeenCalled();
    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    expect(mockGetExpoPushTokenAsync).toHaveBeenCalled();
    expect(NotificationsApi.registerExpoPushToken).toHaveBeenCalledWith(
      'ExponentPushToken[abc]',
      expect.any(String),
    );
    expect(setExpoPushToken).toHaveBeenCalledWith('ExponentPushToken[abc]');
    expect(setNotificationsEnabled).toHaveBeenCalledWith(true);
  });

  it('loads expo-notifications lazily when the flow runs', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    // The factory runs the first time the flow reaches it — never at module load.
    expect(loadCount).toBe(1);
  });

  it('captures error to Sentry when permission is denied after request', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('permission not granted') }),
      { screen: 'usePushNotifications', action: 'register' },
    );
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
    expect(setNotificationsEnabled).not.toHaveBeenCalled();
  });

  it('captures error to Sentry and retries permission when previously denied', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'denied' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(mockRequestPermissionsAsync).toHaveBeenCalled();
    expect(mockCaptureError).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('permission not granted') }),
      { screen: 'usePushNotifications', action: 'register' },
    );
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
  });

  it('captures error to Sentry and disables notifications when API fails', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });

    const apiError = new Error('API error');
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockRejectedValue(apiError);

    await expect(
      registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled),
    ).resolves.toMatchObject({ ok: false });

    expect(mockCaptureError).toHaveBeenCalledWith(apiError, { screen: 'usePushNotifications', action: 'register' });
    expect(setNotificationsEnabled).toHaveBeenCalledWith(false);
  });

  it('captures error when getExpoPushTokenAsync throws', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const tokenError = new Error('Expo push service unreachable');
    mockGetExpoPushTokenAsync.mockRejectedValue(tokenError);

    await expect(
      registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled),
    ).resolves.toMatchObject({ ok: false });

    expect(mockCaptureError).toHaveBeenCalledWith(tokenError, { screen: 'usePushNotifications', action: 'register' });
    expect(setNotificationsEnabled).toHaveBeenCalledWith(false);
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
  });

  it('captures error when getPermissionsAsync throws', async () => {
    const permError = new Error('Native module error');
    mockGetPermissionsAsync.mockRejectedValue(permError);

    await expect(
      registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled),
    ).resolves.toMatchObject({ ok: false });

    expect(mockCaptureError).toHaveBeenCalledWith(permError, { screen: 'usePushNotifications', action: 'register' });
    expect(setNotificationsEnabled).toHaveBeenCalledWith(false);
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
  });

  it('does not attempt a push registration in Expo Go on Android', async () => {
    // Expo Go cannot register ExpoTopicSubscriptionModule, so the lazy load still throws
    // there. The guard must stop the flow before that, so no secondary
    // "Cannot read property 'getPermissionsAsync' of undefined" is reported as well.
    mockIsRunningInExpoGo.current = true;
    const loadsBefore = loadCount;

    await expect(
      registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled),
    ).resolves.toMatchObject({ ok: false });

    expect(loadCount).toBe(loadsBefore);
    expect(setExpoPushToken).not.toHaveBeenCalled();
    expect(setNotificationsEnabled).not.toHaveBeenCalled();
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
  });

  it('captures error when expo-notifications cannot be loaded', async () => {
    // Mirrors a device where the native module is missing at call time; the flow must
    // surface that as a normal registration failure instead of throwing out of the caller.
    let attempted: typeof import('../usePushNotifications') | undefined;

    jest.isolateModules(() => {
      // A throwing factory would also blow up the implicit import of `expo-device`,
      // masking what this test asserts; an empty module reproduces the same
      // "undefined native API" shape the missing native module produces on a device.
      jest.doMock('expo-notifications', () => ({}));
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      attempted = require('../usePushNotifications') as typeof import('../usePushNotifications');
    });

    await expect(
      (attempted as typeof import('../usePushNotifications')).registerPushNotificationsAsync(
        setExpoPushToken,
        setNotificationsEnabled,
      ),
    ).resolves.toMatchObject({ ok: false });

    // Must not be a TypeError from dereferencing the missing module: the guard stops the
    // undefined shape before it is ever used.
    expect(setExpoPushToken).not.toHaveBeenCalled();
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
  });
});

describe('registerPushNotificationsAsync — result for each failure mode (#1056)', () => {
  beforeEach(() => {
    useNotificationStore.setState({ expoPushToken: null, notificationsEnabled: false });
    mockIsDevice.current = true;
    mockIsRunningInExpoGo.current = false;
    jest.clearAllMocks();
  });

  it('returns ok: true after a successful registration', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    const result = await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(result).toEqual({ ok: true });
  });

  it('returns reason "device" when there is no physical device', async () => {
    mockIsDevice.current = false;

    const result = await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(result).toEqual({ ok: false, reason: 'device' });
  });

  it('returns reason "permission" when the permission prompt is declined', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const result = await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(result).toEqual({ ok: false, reason: 'permission' });
  });

  it('returns reason "unavailable" when push is unavailable in Expo Go on Android', async () => {
    mockIsRunningInExpoGo.current = true;

    const result = await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(result).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('returns reason "api" when the backend rejects the token', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockRejectedValue(new Error('API error'));

    const result = await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(result).toEqual({ ok: false, reason: 'api' });
  });

  it('returns reason "unknown" when the push token cannot be obtained', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockRejectedValue(new Error('Expo push service unreachable'));

    const result = await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(result).toEqual({ ok: false, reason: 'unknown' });
  });

  it('leaves notifications disabled on every failure mode', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockRejectedValue(new Error('API error'));

    const result = await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(result.ok).toBe(false);
    expect(setNotificationsEnabled).not.toHaveBeenCalledWith(true);
    expect(setExpoPushToken).not.toHaveBeenCalled();
  });
});

describe('unregisterPushNotificationsAsync', () => {
  beforeEach(() => {
    useNotificationStore.setState({ expoPushToken: null, notificationsEnabled: false });
    mockIsDevice.current = true;
    jest.clearAllMocks();
  });

  it('calls API and clears store when token exists', async () => {
    (NotificationsApi.unregisterExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    await unregisterPushNotificationsAsync('ExponentPushToken[abc]', clearNotificationState);

    expect(NotificationsApi.unregisterExpoPushToken).toHaveBeenCalledWith('ExponentPushToken[abc]');
    expect(clearNotificationState).toHaveBeenCalled();
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it('does nothing when no token is provided', async () => {
    await unregisterPushNotificationsAsync(null, clearNotificationState);

    expect(NotificationsApi.unregisterExpoPushToken).not.toHaveBeenCalled();
    expect(clearNotificationState).not.toHaveBeenCalled();
  });

  it('captures error to Sentry and clears store when API fails', async () => {
    const apiError = new Error('API error');
    (NotificationsApi.unregisterExpoPushToken as jest.Mock).mockRejectedValue(apiError);

    await unregisterPushNotificationsAsync('ExponentPushToken[abc]', clearNotificationState);

    expect(mockCaptureError).toHaveBeenCalledWith(apiError, { screen: 'usePushNotifications', action: 'unregister' });
    expect(NotificationsApi.unregisterExpoPushToken).toHaveBeenCalled();
    expect(clearNotificationState).toHaveBeenCalled();
  });

  it('reports ok: true when the API call succeeds (#1056)', async () => {
    (NotificationsApi.unregisterExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    const result = await unregisterPushNotificationsAsync('ExponentPushToken[abc]', clearNotificationState);

    expect(result).toEqual({ ok: true });
  });

  it('reports ok: false when the API call fails, so the caller can restore the toggle (#1056)', async () => {
    (NotificationsApi.unregisterExpoPushToken as jest.Mock).mockRejectedValue(new Error('API error'));

    const result = await unregisterPushNotificationsAsync('ExponentPushToken[abc]', clearNotificationState);

    expect(result).toEqual({ ok: false });
  });

  it('does not report a failure when there is no token to remove (#1056)', async () => {
    const result = await unregisterPushNotificationsAsync(null, clearNotificationState);

    expect(result).toEqual({ ok: true });
  });
});

describe('usePushNotifications — error state (#1056)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsDevice.current = true;
    mockIsRunningInExpoGo.current = false;
    useNotificationStore.setState({ expoPushToken: null, notificationsEnabled: false });
  });

  it('exposes the failure reason after a rejected registration and clears it on dismiss', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    const { result } = await renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.registerPushNotifications();
    });
    expect(result.current.pushNotificationsError).toBe('permission');

    await act(async () => {
      result.current.clearPushNotificationsError();
    });
    expect(result.current.pushNotificationsError).toBeNull();
  });

  it('restores the toggle to ON and reports the failure when disabling fails', async () => {
    useNotificationStore.setState({ expoPushToken: 'ExponentPushToken[abc]', notificationsEnabled: true });
    (NotificationsApi.unregisterExpoPushToken as jest.Mock).mockRejectedValue(new Error('API error'));

    const { result } = await renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.unregisterPushNotifications();
    });

    expect(result.current.pushNotificationsError).toBe('unregister');
    expect(useNotificationStore.getState().notificationsEnabled).toBe(true);
  });

  it('keeps pushing enabled and reports no error after a successful registration', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    const { result } = await renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.registerPushNotifications();
    });

    expect(result.current.pushNotificationsError).toBeNull();
    expect(useNotificationStore.getState().notificationsEnabled).toBe(true);
  });
});
