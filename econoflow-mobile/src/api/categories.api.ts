import { apiClient } from './client';
import type { Category, CreateCategoryRequest, PatchOperation } from './types';

export const getCategories = (projectId: string, from: string, to: string) =>
  apiClient.get<Category[]>(`/api/Projects/${projectId}/Categories`, {
    params: { from, to },
  });

export const createCategory = (projectId: string, data: CreateCategoryRequest) =>
  apiClient.post<Category>(`/api/Projects/${projectId}/Categories`, data);

export const patchCategory = (projectId: string, id: string, ops: PatchOperation[]) =>
  apiClient.patch<Category>(`/api/Projects/${projectId}/Categories/${id}`, ops);

export const archiveCategory = (projectId: string, id: string) =>
  apiClient.put(`/api/Projects/${projectId}/Categories/${id}/Archive`);
