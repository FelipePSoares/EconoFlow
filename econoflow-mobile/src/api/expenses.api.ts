import { apiClient } from './client';
import type { Expense, CreateExpenseRequest, PatchOperation } from './types';

export const getExpenses = (projectId: string, categoryId: string, from: string, to: string) =>
  apiClient.get<Expense[]>(`/api/Projects/${projectId}/Categories/${categoryId}/Expenses`, {
    params: { from, to },
  });

export const createExpense = (
  projectId: string,
  categoryId: string,
  data: CreateExpenseRequest
) =>
  apiClient.post<Expense>(
    `/api/Projects/${projectId}/Categories/${categoryId}/Expenses`,
    data
  );

export const patchExpense = (
  projectId: string,
  categoryId: string,
  id: string,
  ops: PatchOperation[]
) =>
  apiClient.patch<Expense>(
    `/api/Projects/${projectId}/Categories/${categoryId}/Expenses/${id}`,
    ops
  );

export const deleteExpense = (projectId: string, categoryId: string, id: string) =>
  apiClient.delete(`/api/Projects/${projectId}/Categories/${categoryId}/Expenses/${id}`);

export const deleteExpenseItem = (
  projectId: string,
  categoryId: string,
  expenseId: string,
  expenseItemId: string
) =>
  apiClient.delete(
    `/api/Projects/${projectId}/Categories/${categoryId}/Expenses/${expenseId}/ExpenseItems/${expenseItemId}`
  );
