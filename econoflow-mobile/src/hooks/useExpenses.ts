import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ExpensesApi from '../api/expenses.api';
import type { CreateExpenseRequest, PatchOperation } from '../api/types';
import { monthStart, monthEnd } from '../utils/date';

export const useExpensesForMonth = (
  projectId: string,
  categoryId: string,
  month: string
) => {
  const from = monthStart(month);
  const to = monthEnd(month);

  return useQuery({
    queryKey: ['expenses', projectId, categoryId, month],
    queryFn: () =>
      ExpensesApi.getExpenses(projectId, categoryId, from, to).then((r) => r.data),
    enabled: !!projectId && !!categoryId,
    staleTime: 30_000,
  });
};

export const useCreateExpense = (projectId: string, categoryId: string, month: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpenseRequest) =>
      ExpensesApi.createExpense(projectId, categoryId, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', projectId, categoryId, month] });
      queryClient.invalidateQueries({ queryKey: ['categories', projectId, month] });
    },
  });
};

export const usePatchExpense = (
  projectId: string,
  categoryId: string,
  expenseId: string,
  month: string
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ops: PatchOperation[]) =>
      ExpensesApi.patchExpense(projectId, categoryId, expenseId, ops).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', projectId, categoryId, month] });
      queryClient.invalidateQueries({ queryKey: ['categories', projectId, month] });
    },
  });
};

export const useDeleteExpense = (projectId: string, categoryId: string, month: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (expenseId: string) =>
      ExpensesApi.deleteExpense(projectId, categoryId, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', projectId, categoryId, month] });
      queryClient.invalidateQueries({ queryKey: ['categories', projectId, month] });
    },
  });
};
