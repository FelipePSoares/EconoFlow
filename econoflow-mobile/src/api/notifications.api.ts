import { apiClient } from './client';
import type { AppNotification } from './types';

export const getNotifications = () =>
  apiClient.get<AppNotification[]>('/api/account/Notifications');

export const markAsRead = (notificationId: string) =>
  apiClient.post(`/api/account/Notifications/${notificationId}/read`);

export const markAllAsRead = () =>
  apiClient.post('/api/account/Notifications/read-all');

export const registerExpoPushToken = (token: string, deviceName?: string) =>
  apiClient.post('/api/push/expo/register', { token, deviceName: deviceName ?? null });

export const unregisterExpoPushToken = (token: string) =>
  apiClient.delete('/api/push/expo/unregister', { data: { token } });
