import { apiClient } from './client';
import type { UserProject, CreateProjectRequest, PatchOperation } from './types';

export const getProjects = () =>
  apiClient.get<UserProject[]>('/api/Projects');

export const getProject = (id: string) =>
  apiClient.get<UserProject>(`/api/Projects/${id}`);

export const createProject = (data: CreateProjectRequest) =>
  apiClient.post<UserProject>('/api/Projects', data);

export const patchProject = (id: string, ops: PatchOperation[]) =>
  apiClient.patch<UserProject>(`/api/Projects/${id}`, ops);

export const archiveProject = (id: string) =>
  apiClient.put(`/api/Projects/${id}/archive`);
