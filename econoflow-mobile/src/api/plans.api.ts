import { apiClient } from './client';
import type { Plan, PlanEntry, CreatePlanRequest, CreatePlanEntryRequest, PatchOperation } from './types';

export const getPlans = (projectId: string) =>
  apiClient.get<Plan[]>(`/api/Projects/${projectId}/Plans`);

export const getPlanEntries = (projectId: string, planId: string) =>
  apiClient.get<PlanEntry[]>(`/api/Projects/${projectId}/Plans/${planId}/entries`);

export const createPlan = (projectId: string, data: CreatePlanRequest) =>
  apiClient.post<Plan>(`/api/Projects/${projectId}/Plans`, data);

export const patchPlan = (projectId: string, planId: string, ops: PatchOperation[]) =>
  apiClient.patch<Plan>(`/api/Projects/${projectId}/Plans/${planId}`, ops);

export const archivePlan = (projectId: string, planId: string) =>
  apiClient.put(`/api/Projects/${projectId}/Plans/${planId}/archive`);

export const addPlanEntry = (projectId: string, planId: string, data: CreatePlanEntryRequest) =>
  apiClient.post<PlanEntry>(`/api/Projects/${projectId}/Plans/${planId}/entries`, data);
