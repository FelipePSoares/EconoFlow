import { useNotificationStore } from '../notificationStore';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('notificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({
      expoPushToken: null,
      notificationsEnabled: false,
    });
  });

  describe('setExpoPushToken', () => {
    it('sets the push token', () => {
      useNotificationStore.getState().setExpoPushToken('ExponentPushToken[abc]');
      expect(useNotificationStore.getState().expoPushToken).toBe('ExponentPushToken[abc]');
    });
  });

  describe('setNotificationsEnabled', () => {
    it('sets notificationsEnabled to true', () => {
      useNotificationStore.getState().setNotificationsEnabled(true);
      expect(useNotificationStore.getState().notificationsEnabled).toBe(true);
    });

    it('sets notificationsEnabled to false', () => {
      useNotificationStore.getState().setNotificationsEnabled(true);
      useNotificationStore.getState().setNotificationsEnabled(false);
      expect(useNotificationStore.getState().notificationsEnabled).toBe(false);
    });
  });

  describe('clearNotificationState', () => {
    it('resets push token and disabled notifications', () => {
      useNotificationStore.getState().setExpoPushToken('ExponentPushToken[abc]');
      useNotificationStore.getState().setNotificationsEnabled(true);

      useNotificationStore.getState().clearNotificationState();

      expect(useNotificationStore.getState().expoPushToken).toBeNull();
      expect(useNotificationStore.getState().notificationsEnabled).toBe(false);
    });
  });
});
