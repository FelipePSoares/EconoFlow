import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  registerExpoPushToken,
  unregisterExpoPushToken,
} from '../notifications.api';
import { apiClient } from '../client';

jest.mock('../client', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  },
}));

describe('notifications.api', () => {
  afterEach(() => jest.clearAllMocks());

  describe('getNotifications', () => {
    it('GETs /api/account/Notifications', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });
      await getNotifications();
      expect(apiClient.get).toHaveBeenCalledWith('/api/account/Notifications');
    });
  });

  describe('markAsRead', () => {
    it('POSTs to /api/account/Notifications/{id}/read', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: undefined });
      await markAsRead('notif-id-1');
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/account/Notifications/notif-id-1/read',
      );
    });
  });

  describe('markAllAsRead', () => {
    it('POSTs to /api/account/Notifications/read-all', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: undefined });
      await markAllAsRead();
      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/account/Notifications/read-all',
      );
    });
  });

  describe('registerExpoPushToken', () => {
    it('POSTs token and deviceName to /api/push/expo/register', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: undefined });
      await registerExpoPushToken('ExponentPushToken[abc]', 'iPhone 15');
      expect(apiClient.post).toHaveBeenCalledWith('/api/push/expo/register', {
        token: 'ExponentPushToken[abc]',
        deviceName: 'iPhone 15',
      });
    });

    it('POSTs with null deviceName when not provided', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({ data: undefined });
      await registerExpoPushToken('ExponentPushToken[abc]');
      expect(apiClient.post).toHaveBeenCalledWith('/api/push/expo/register', {
        token: 'ExponentPushToken[abc]',
        deviceName: null,
      });
    });
  });

  describe('unregisterExpoPushToken', () => {
    it('DELETEs to /api/push/expo/unregister with token', async () => {
      (apiClient.delete as jest.Mock).mockResolvedValue({ data: undefined });
      await unregisterExpoPushToken('ExponentPushToken[abc]');
      expect(apiClient.delete).toHaveBeenCalledWith('/api/push/expo/unregister', {
        data: { token: 'ExponentPushToken[abc]' },
      });
    });
  });
});
