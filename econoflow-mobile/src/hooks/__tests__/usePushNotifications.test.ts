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

jest.mock('expo-device', () => ({
  isDevice: true,
}));

describe('registerPushNotificationsAsync', () => {
  const setExpoPushToken = jest.fn();
  const setNotificationsEnabled = jest.fn();

  beforeEach(() => {
    useNotificationStore.setState({ expoPushToken: null, notificationsEnabled: false });
    jest.clearAllMocks();
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

  it('silently catches API errors and disables notifications', async () => {
    const expoNotifications = jest.requireMock('expo-notifications') as {
      getPermissionsAsync: jest.Mock;
      requestPermissionsAsync: jest.Mock;
      getExpoPushTokenAsync: jest.Mock;
    };

    expoNotifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
    expoNotifications.getExpoPushTokenAsync.mockResolvedValue({ data: 'ExponentPushToken[abc]' });

    (NotificationsApi.registerExpoPushToken as jest.Mock).mockRejectedValue(new Error('API error'));

    await expect(
      registerPushNotificationsAsync(setExpoPushToken, setNotificationsEnabled),
    ).resolves.toBeUndefined();

    expect(setNotificationsEnabled).toHaveBeenCalledWith(false);
  });
});

describe('unregisterPushNotificationsAsync', () => {
  const clearNotificationState = jest.fn();

  beforeEach(() => {
    useNotificationStore.setState({ expoPushToken: null, notificationsEnabled: false });
    jest.clearAllMocks();
  });

  it('calls API and clears store when token exists', async () => {
    (NotificationsApi.unregisterExpoPushToken as jest.Mock).mockResolvedValue({ data: {} });

    await unregisterPushNotificationsAsync('ExponentPushToken[abc]', clearNotificationState);

    expect(NotificationsApi.unregisterExpoPushToken).toHaveBeenCalledWith('ExponentPushToken[abc]');
    expect(clearNotificationState).toHaveBeenCalled();
  });

  it('does nothing when no token is provided', async () => {
    await unregisterPushNotificationsAsync(null, clearNotificationState);

    expect(NotificationsApi.unregisterExpoPushToken).not.toHaveBeenCalled();
    expect(clearNotificationState).not.toHaveBeenCalled();
  });

  it('calls clearNotificationState even when API fails', async () => {
    (NotificationsApi.unregisterExpoPushToken as jest.Mock).mockRejectedValue(new Error('API error'));

    await unregisterPushNotificationsAsync('ExponentPushToken[abc]', clearNotificationState);

    expect(NotificationsApi.unregisterExpoPushToken).toHaveBeenCalled();
    expect(clearNotificationState).toHaveBeenCalled();
  });
});
