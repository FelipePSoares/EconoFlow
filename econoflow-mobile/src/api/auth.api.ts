import { apiClient } from './client';
import type { LoginRequest, MobileLoginResponse, User } from './types';

export const mobileLogin = (data: LoginRequest) =>
  apiClient.post<MobileLoginResponse>('/api/AccessControl/mobile/login', data);

export const mobileRefreshToken = (accessToken: string, refreshToken: string) =>
  apiClient.post<MobileLoginResponse>('/api/AccessControl/mobile/refresh-token', {
    accessToken,
    refreshToken,
  });

export const register = (email: string, password: string) =>
  apiClient.post('/api/AccessControl/register', { email, password });

export const forgotPassword = (email: string) =>
  apiClient.post('/api/AccessControl/forgotPassword', { email });

export const getCurrentUser = () =>
  apiClient.get<User>('/api/AccessControl');
