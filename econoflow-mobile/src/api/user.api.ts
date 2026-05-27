import { apiClient } from './client';
import type { User, PatchOperation } from './types';

export const getUser = () =>
  apiClient.get<User>('/api/AccessControl');

export const patchUser = (ops: PatchOperation[]) =>
  apiClient.patch<User>('/api/AccessControl', ops);
