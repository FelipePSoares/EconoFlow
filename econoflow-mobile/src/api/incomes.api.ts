import { apiClient } from './client';
import type { Income, CreateIncomeRequest, PatchOperation } from './types';

export const getIncomes = (projectId: string, from: string, to: string) =>
  apiClient.get<Income[]>(`/api/Projects/${projectId}/Incomes`, {
    params: { from, to },
  });

export const createIncome = (projectId: string, data: CreateIncomeRequest) =>
  apiClient.post<Income>(`/api/Projects/${projectId}/Incomes`, data);

export const patchIncome = (projectId: string, id: string, ops: PatchOperation[]) =>
  apiClient.patch<Income>(`/api/Projects/${projectId}/Incomes/${id}`, ops);

export const deleteIncome = (projectId: string, id: string) =>
  apiClient.delete(`/api/Projects/${projectId}/Incomes/${id}`);
