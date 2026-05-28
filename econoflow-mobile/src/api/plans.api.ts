import { apiClient } from './client';
import type { Plan, PlanEntry } from './types';

export const getPlans = (projectId: string) =>
  apiClient.get<Plan[]>(`/api/Projects/${projectId}/Plans`);

export const getPlanEntries = (projectId: string, planId: string) =>
  apiClient.get<PlanEntry[]>(`/api/Projects/${projectId}/Plans/${planId}/entries`);
