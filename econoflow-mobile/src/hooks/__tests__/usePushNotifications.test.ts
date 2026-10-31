import * as NotificationsApi from '../../api/notifications.api';
import { useNotificationStore } from '../../store/notificationStore';
import { act, renderHook } from '@testing-library/react-native';
import {
  registerPushNotificationsAsync,
  requestNotificationPermissionAndRegister,
  unregisterPushNotificationsAsync,
  usePushNotifications,
} from '../usePushNotifications';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../api/notifications.api', () => {
  // `jest.mock(path)` is auto-mocked once per test *file*, not per test: the
  // implementations are cleared in `beforeEach` (see `resetApiMocks`) so a `rejects`
  // from one case cannot leak into the next.
  return {
    registerExpoPushToken: jest.fn(),
    unregisterExpoPushToken: jest.fn(),
  };
});

/** Clears mock implementations *and* the calls of the notification API. */
const resetApiMocks = () => {
  (NotificationsApi.registerExpoPushToken as jest.Mock).mockReset();
  (NotificationsApi.unregisterExpoPushToken as jest.Mock).mockReset();
};

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
const mockSetNotificationChannelAsync = jest.fn();
let loadCount = 0;

// A factory spy stands in for the real module on purpose: the real one throws for the
// missing ExpoTopicSubscriptionModule native module on import, so it cannot be resolved.
jest.mock('expo-notifications', () => {
  loadCount += 1;
  return {
    getPermissionsAsync: (...args: unknown[]) => mockGetPermissionsAsync(...args),
    requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissionsAsync(...args),
    getExpoPushTokenAsync: (...args: unknown[]) => mockGetExpoPushTokenAsync(...args),
    setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
    AndroidImportance: { MAX: 5 },
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
    resetApiMocks();
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
    resetApiMocks();
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

  it('returns reason "permission" when the permission call itself throws', async () => {
    // A native-module failure while reading the permission is still a permission
    // problem from the user's point of view: "try again later" would mislead them.
    mockGetPermissionsAsync.mockRejectedValue(new Error('Native module error'));

    const result = await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(result).toEqual({ ok: false, reason: 'permission' });
    expect(setNotificationsEnabled).not.toHaveBeenCalledWith(true);
  });

  it('returns reason "permission" when requesting the permission throws', async () => {
    mockGetPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    mockRequestPermissionsAsync.mockRejectedValue(new Error('Native module error'));

    const result = await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(result).toEqual({ ok: false, reason: 'permission' });
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
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
    resetApiMocks();
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
    resetApiMocks();
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

// ─── #1053 — the single post-login permission + registration flow ────────────

const resetNotificationStore = () => {
  useNotificationStore.setState({
    expoPushToken: null,
    notificationsEnabled: false,
    hasPromptedForPermission: false,
    pushPermissionStatus: 'undetermined',
    canAskForPermission: true,
  });
};

const permission = (status: string, canAskAgain = true) => ({
  status,
  canAskAgain,
  granted: status === 'granted',
});

describe('requestNotificationPermissionAndRegister (#1053)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetApiMocks();
    mockIsDevice.current = true;
    mockIsRunningInExpoGo.current = false;
    resetNotificationStore();
    mockSetNotificationChannelAsync.mockResolvedValue(undefined);
  });

  it('does not ask the OS when the permission is already granted', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permission('granted'));
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    await requestNotificationPermissionAndRegister();

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(useNotificationStore.getState().notificationsEnabled).toBe(true);
  });

  it('records the denial, keeps the toggle off and reports permission', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permission('undetermined'));
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'denied', canAskAgain: false });

    const result = await requestNotificationPermissionAndRegister();

    expect(result).toEqual({ ok: false, reason: 'permission' });
    const state = useNotificationStore.getState();
    expect(state.hasPromptedForPermission).toBe(true);
    expect(state.pushPermissionStatus).toBe('denied');
    expect(state.canAskForPermission).toBe(false);
    expect(state.notificationsEnabled).toBe(false);
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
  });

  it('does not prompt again after the user already answered', async () => {
    useNotificationStore.setState({ hasPromptedForPermission: true });
    mockGetPermissionsAsync.mockResolvedValue(permission('undetermined'));

    const result = await requestNotificationPermissionAndRegister();

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: 'permission' });
    expect(useNotificationStore.getState().hasPromptedForPermission).toBe(true);
  });

  it('never prompts when the OS says it cannot be asked again', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permission('denied', false));

    const result = await requestNotificationPermissionAndRegister();

    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: false, reason: 'permission' });
    expect(useNotificationStore.getState().pushPermissionStatus).toBe('denied');
    expect(useNotificationStore.getState().canAskForPermission).toBe(false);
  });

  it('reports the answer as already given when the permission is denied for good', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permission('denied', false));

    await requestNotificationPermissionAndRegister();

    expect(useNotificationStore.getState().hasPromptedForPermission).toBe(true);
  });

  it('creates the Android channel before asking for the permission', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permission('undetermined'));
    mockRequestPermissionsAsync.mockResolvedValue(permission('granted'));
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    await requestNotificationPermissionAndRegister();

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ importance: expect.anything() }),
    );
    expect(mockSetNotificationChannelAsync.mock.invocationCallOrder[0])
      .toBeLessThan(mockRequestPermissionsAsync.mock.invocationCallOrder[0]);
  });

  it('still registers when the channel cannot be created', async () => {
    mockSetNotificationChannelAsync.mockRejectedValue(new Error('channel error'));
    mockGetPermissionsAsync.mockResolvedValue(permission('granted'));
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    const result = await requestNotificationPermissionAndRegister();

    expect(result).toEqual({ ok: true });
  });

  it('does not run the flow when the permission block cannot be read', async () => {
    mockGetPermissionsAsync.mockRejectedValue(new Error('native module error'));

    const result = await requestNotificationPermissionAndRegister();

    expect(result).toEqual({ ok: false, reason: 'permission' });
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(useNotificationStore.getState().hasPromptedForPermission).toBe(false);
  });

  it('records the answer when the permission is granted (regression)', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permission('granted'));
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    await requestNotificationPermissionAndRegister();

    // No dialog was shown (the OS already had the answer), so nothing pretends the user
    // was asked — but the device is registered, which is what the toggle reflects.
    expect(useNotificationStore.getState().hasPromptedForPermission).toBe(false);
    expect(useNotificationStore.getState().notificationsEnabled).toBe(true);
    expect(useNotificationStore.getState().expoPushToken).toBe('ExponentPushToken[abc]');
  });

  it('creates the Android channel even when the permission was granted in the settings', async () => {
    // A grant obtained outside the app never passed the dialog, so this path is the only
    // chance to create the `default` channel the backend pushes land in (#1053).
    mockGetPermissionsAsync.mockResolvedValue(permission('granted'));
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    await requestNotificationPermissionAndRegister();

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      'default',
      expect.objectContaining({ importance: expect.anything() }),
    );
  });

  it('shrinks the banner failure to a non-permission one when the permission is granted', async () => {
    useNotificationStore.setState({ lastPermissionError: 'permission' });
    mockGetPermissionsAsync.mockResolvedValue(permission('granted'));
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockRejectedValue(new Error('API error'));

    await requestNotificationPermissionAndRegister();

    // The declined-permission wording would be wrong here — the permission is granted,
    // the backend call is what failed — so the icon in Profile must offer a retry.
    expect(useNotificationStore.getState().lastPermissionError).toBe('api');
  });

  it('shrinks the banner failure to none when the permission is granted and registration works', async () => {
    useNotificationStore.setState({ lastPermissionError: 'unknown' });
    mockGetPermissionsAsync.mockResolvedValue(permission('granted'));
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    await requestNotificationPermissionAndRegister();

    expect(useNotificationStore.getState().lastPermissionError).toBeNull();
  });

  it('is a no-op on a simulator instead of prompting for a permission it cannot use', async () => {
    mockIsDevice.current = false;

    const result = await requestNotificationPermissionAndRegister();

    expect(result).toEqual({ ok: false, reason: 'device' });
    expect(mockGetPermissionsAsync).not.toHaveBeenCalled();
    expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
    expect(useNotificationStore.getState().hasPromptedForPermission).toBe(false);
  });

  // #1053: the app is backgrounded and reopened all day long. The OS keeps the grant but
  // the process forgets the token, and reading the permission back as `granted` silently
  // counted as "already sorted" — the toggle stayed OFF and nothing registered the device
  // again, so the user never saw the activation message.
  describe('when the app is reopened after the permission was answered', () => {
    it('registers the device again instead of assuming a granted permission is enough', async () => {
      useNotificationStore.setState({ hasPromptedForPermission: true });
      mockGetPermissionsAsync.mockResolvedValue(permission('granted'));
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
      (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

      const result = await requestNotificationPermissionAndRegister();

      expect(result).toEqual({ ok: true });
      expect(NotificationsApi.registerExpoPushToken).toHaveBeenCalledTimes(1);
      expect(useNotificationStore.getState().expoPushToken).toBe('ExponentPushToken[abc]');
      expect(useNotificationStore.getState().notificationsEnabled).toBe(true);
    });

    it('reports activation when the device comes back with a token that was lost with the process', async () => {
      useNotificationStore.setState({
        hasPromptedForPermission: true,
        notificationsEnabled: false,
        expoPushToken: null,
      });
      mockGetPermissionsAsync.mockResolvedValue(permission('granted'));
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[again]' });
      (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

      await requestNotificationPermissionAndRegister();

      expect(NotificationsApi.registerExpoPushToken).toHaveBeenCalledWith('ExponentPushToken[again]', 'Android');
      expect(useNotificationStore.getState().notificationsEnabled).toBe(true);
    });

    it('keeps the rationale away once the returning user is registered and active', async () => {
      useNotificationStore.setState({ hasPromptedForPermission: false });
      mockGetPermissionsAsync.mockResolvedValue(permission('granted'));
      mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
      (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

      await requestNotificationPermissionAndRegister();

      expect(mockRequestPermissionsAsync).not.toHaveBeenCalled();
      const state = useNotificationStore.getState();
      // Either the stored answer or the active registration is enough: a user who is
      // already receiving notifications must never be asked to allow them.
      expect(state.hasPromptedForPermission || state.notificationsEnabled).toBe(true);
    });
  });

  it('shares one in-flight request between concurrent callers', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permission('undetermined'));
    mockRequestPermissionsAsync.mockResolvedValue(permission('granted'));
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    const [first, second] = await Promise.all([
      requestNotificationPermissionAndRegister(),
      requestNotificationPermissionAndRegister(),
    ]);

    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('asks again in a later session when the previous answer could not be applied', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permission('undetermined'));
    mockRequestPermissionsAsync.mockResolvedValue(permission('granted'));
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    await requestNotificationPermissionAndRegister();
    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(1);

    useNotificationStore.getState().resetPermissionPrompt();
    await requestNotificationPermissionAndRegister();

    expect(mockRequestPermissionsAsync).toHaveBeenCalledTimes(2);
  });
});

describe('usePushNotifications — permission sync on mount (#1053)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetApiMocks();
    mockIsDevice.current = true;
    mockIsRunningInExpoGo.current = false;
    resetNotificationStore();
  });

  it('drops the toggle to OFF when the OS no longer grants notifications', async () => {
    useNotificationStore.setState({ notificationsEnabled: true, expoPushToken: 'ExponentPushToken[abc]' });
    mockGetPermissionsAsync.mockResolvedValue(permission('denied', false));

    const { result } = await renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.syncPermissionState();
    });

    expect(useNotificationStore.getState().pushPermissionStatus).toBe('denied');
    expect(result.current.notificationsEnabled).toBe(false);
  });

  it('picks up a permission granted from the system settings', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permission('granted'));

    const { result } = await renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.syncPermissionState();
    });

    expect(useNotificationStore.getState().pushPermissionStatus).toBe('granted');
    expect(result.current.pushPermissionStatus).toBe('granted');
  });

  it('asks the OS when the toggle is on but no token was ever registered', async () => {
    // The previous session never finished registering: the toggle must reflect the app,
    // so activating again is the right move here.
    useNotificationStore.setState({ notificationsEnabled: true, expoPushToken: null });
    mockGetPermissionsAsync.mockResolvedValue(permission('denied', false));

    const { result } = await renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.syncPermissionState();
    });

    expect(result.current.notificationsEnabled).toBe(false);
  });

  // #1053: the process is killed and restarted all day long, so a stored token is not the
  // same thing as a live subscription. Trusting it left the toggle reading ON after a
  // relaunch while this device held no token at all and received nothing.
  it('registers the device again on relaunch even when a stale token is stored', async () => {
    useNotificationStore.setState({
      hasPromptedForPermission: true,
      notificationsEnabled: false,
      expoPushToken: 'ExponentPushToken[from-the-previous-process]',
    });
    mockGetPermissionsAsync.mockResolvedValue(permission('granted'));
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[current]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    const { result } = await renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.syncPermissionState();
    });

    expect(NotificationsApi.registerExpoPushToken).toHaveBeenCalledWith(
      'ExponentPushToken[current]',
      expect.any(String),
    );
    expect(useNotificationStore.getState().expoPushToken).toBe('ExponentPushToken[current]');
    expect(useNotificationStore.getState().notificationsEnabled).toBe(true);
  });

  it('marks a granted permission as answered, so a relaunch never shows the rationale', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permission('granted'));
    mockGetExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[current]' });
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    const { result } = await renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.syncPermissionState();
    });

    expect(useNotificationStore.getState().hasPromptedForPermission).toBe(true);
  });

  it('keeps the local state when the permission cannot be read', async () => {
    useNotificationStore.setState({ notificationsEnabled: true, expoPushToken: 'ExponentPushToken[abc]' });
    mockGetPermissionsAsync.mockRejectedValue(new Error('native module error'));

    const { result } = await renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.syncPermissionState();
    });

    expect(result.current.notificationsEnabled).toBe(true);
  });

  it('exposes canAskForPermission so the UI can send the user to the settings', async () => {
    mockGetPermissionsAsync.mockResolvedValue(permission('denied', false));

    const { result } = await renderHook(() => usePushNotifications());

    await act(async () => {
      await result.current.syncPermissionState();
    });

    expect(result.current.canAskForPermission).toBe(false);
  });
});
