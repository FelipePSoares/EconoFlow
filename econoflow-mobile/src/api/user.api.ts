import { apiClient } from './client';
import type {
  User,
  PatchOperation,
  ManageInfoRequest,
  TwoFactorSetupInfo,
  EnableTwoFactorRequest,
  EnableTwoFactorResponse,
  DisableTwoFactorRequest,
} from './types';

export const getUser = () =>
  apiClient.get<User>('/api/AccessControl');

export const patchUser = (ops: PatchOperation[]) =>
  apiClient.patch<User>('/api/AccessControl', ops);

export const manageInfo = (req: ManageInfoRequest) =>
  apiClient.post('/api/AccessControl/manage/info', req);

export const getTwoFactorSetup = () =>
  apiClient.get<TwoFactorSetupInfo>('/api/AccessControl/2fa/setup');

export const enableTwoFactor = (req: EnableTwoFactorRequest) =>
  apiClient.post<EnableTwoFactorResponse>('/api/AccessControl/2fa/enable', req);

export const disableTwoFactor = (req: DisableTwoFactorRequest) =>
  apiClient.post('/api/AccessControl/2fa/disable', req);
