import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ExpensesApi from '../api/expenses.api';
import type { CreateExpenseItemRequest, CreateExpenseRequest, PatchOperation } from '../api/types';
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

export const useAddExpenseItem = (projectId: string, categoryId: string, month: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, item }: { expenseId: string; item: CreateExpenseItemRequest }) => {
      const op: PatchOperation = {
        op: 'add',
        path: '/items/-',
        value: {
          name: item.name,
          date: item.date,
          amount: item.amount,
          isDeductible: false,
          temporaryAttachmentIds: [],
          items: [],
        },
      };
      return ExpensesApi.patchExpense(projectId, categoryId, expenseId, [op]).then((r) => r.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', projectId, categoryId, month] });
      queryClient.invalidateQueries({ queryKey: ['categories', projectId, month] });
    },
  });
};

export const useDeleteExpenseItem = (projectId: string, categoryId: string, month: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ expenseId, expenseItemId }: { expenseId: string; expenseItemId: string }) =>
      ExpensesApi.deleteExpenseItem(projectId, categoryId, expenseId, expenseItemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', projectId, categoryId, month] });
      queryClient.invalidateQueries({ queryKey: ['categories', projectId, month] });
    },
  });
};
