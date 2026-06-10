import { apiClient } from './client';
import type { DefaultCategory, SmartSetupRequest } from './types';

export const getDefaultCategories = (projectId: string) =>
  apiClient.get<DefaultCategory[]>(
    `/api/Projects/${projectId}/categories/DefaultCategories`,
  );

export const postSmartSetup = (projectId: string, data: SmartSetupRequest) =>
  apiClient.post<void>(`/api/Projects/${projectId}/smart-setup/`, data);
