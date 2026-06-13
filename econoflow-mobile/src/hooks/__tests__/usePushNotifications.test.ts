import * as NotificationsApi from '../../api/notifications.api';
import { useNotificationStore } from '../../store/notificationStore';
import { registerPushNotificationsAsync, unregisterPushNotificationsAsync } from '../usePushNotifications';

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

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getExpoPushTokenAsync: jest.fn(),
}));

const mockIsDevice = { current: true };
jest.mock('expo-device', () => ({
  get isDevice() { return mockIsDevice.current; },
}));

const mockCaptureError = jest.fn();
const mockAddBreadcrumb = jest.fn();
jest.mock('../../monitoring/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
}));

describe('registerPushNotificationsAsync', () => {
  const setExpoPushToken = jest.fn();
  const setNotificationsEnabled = jest.fn();

  beforeEach(() => {
    useNotificationStore.setState({ expoPushToken: null, notificationsEnabled: false });
    mockIsDevice.current = true;
    jest.clearAllMocks();
  });

  it('silently returns and adds breadcrumb when Device.isDevice is false', async () => {
    mockIsDevice.current = false;

    await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(mockAddBreadcrumb).toHaveBeenCalled();
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
    expect(setNotificationsEnabled).not.toHaveBeenCalled();
  });

  it('requests permissions, gets push token, calls API, and calls setters', async () => {
    const expoNotifications = jest.requireMock('expo-notifications') as {
      getPermissionsAsync: jest.Mock;
      requestPermissionsAsync: jest.Mock;
      getExpoPushTokenAsync: jest.Mock;
    };

    expoNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    expoNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
    expoNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });

    (NotificationsApi.registerExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(expoNotifications.getPermissionsAsync).toHaveBeenCalled();
    expect(expoNotifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(expoNotifications.getExpoPushTokenAsync).toHaveBeenCalled();
    expect(NotificationsApi.registerExpoPushToken).toHaveBeenCalledWith(
      'ExponentPushToken[abc]',
      expect.any(String),
    );
    expect(setExpoPushToken).toHaveBeenCalledWith('ExponentPushToken[abc]');
    expect(setNotificationsEnabled).toHaveBeenCalledWith(true);
  });

  it('skips registration when permission is denied', async () => {
    const expoNotifications = jest.requireMock('expo-notifications') as {
      getPermissionsAsync: jest.Mock;
      requestPermissionsAsync: jest.Mock;
    };

    expoNotifications.getPermissionsAsync.mockResolvedValue({ status: 'undetermined' });
    expoNotifications.requestPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
    expect(setNotificationsEnabled).not.toHaveBeenCalled();
  });

  it('skips registration when permission was previously denied', async () => {
    const expoNotifications = jest.requireMock('expo-notifications') as {
      getPermissionsAsync: jest.Mock;
      requestPermissionsAsync: jest.Mock;
    };

    expoNotifications.getPermissionsAsync.mockResolvedValue({ status: 'denied' });

    await registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled);

    expect(expoNotifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
  });

  it('captures error to Sentry and disables notifications when API fails', async () => {
    const expoNotifications = jest.requireMock('expo-notifications') as {
      getPermissionsAsync: jest.Mock;
      requestPermissionsAsync: jest.Mock;
      getExpoPushTokenAsync: jest.Mock;
    };

    expoNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    expoNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });

    const apiError = new Error('API error');
    (NotificationsApi.registerExpoPushToken as jest.Mock).mockRejectedValue(apiError);

    await expect(
      registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled),
    ).resolves.toBeUndefined();

    expect(mockCaptureError).toHaveBeenCalledWith(apiError, { screen: 'usePushNotifications', action: 'register' });
    expect(setNotificationsEnabled).toHaveBeenCalledWith(false);
  });

  it('captures error when getExpoPushTokenAsync throws', async () => {
    const expoNotifications = jest.requireMock('expo-notifications') as {
      getPermissionsAsync: jest.Mock;
      getExpoPushTokenAsync: jest.Mock;
    };

    expoNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });

    const tokenError = new Error('Expo push service unreachable');
    expoNotifications.getExpoPushTokenAsync.mockRejectedValue(tokenError);

    await expect(
      registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled),
    ).resolves.toBeUndefined();

    expect(mockCaptureError).toHaveBeenCalledWith(tokenError, { screen: 'usePushNotifications', action: 'register' });
    expect(setNotificationsEnabled).toHaveBeenCalledWith(false);
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
  });

  it('captures error when getPermissionsAsync throws', async () => {
    const expoNotifications = jest.requireMock('expo-notifications') as {
      getPermissionsAsync: jest.Mock;
    };

    const permError = new Error('Native module error');
    expoNotifications.getPermissionsAsync.mockRejectedValue(permError);

    await expect(
      registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled),
    ).resolves.toBeUndefined();

    expect(mockCaptureError).toHaveBeenCalledWith(permError, { screen: 'usePushNotifications', action: 'register' });
    expect(setNotificationsEnabled).toHaveBeenCalledWith(false);
    expect(NotificationsApi.registerExpoPushToken).not.toHaveBeenCalled();
  });
});

describe('unregisterPushNotificationsAsync', () => {
  const clearNotificationState = jest.fn();

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
});
