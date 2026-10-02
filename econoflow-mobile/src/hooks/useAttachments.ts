import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as AttachmentsApi from '../api/attachments.api';
import type { UploadFile } from '../api/attachments.api';
import * as ExpensesApi from '../api/expenses.api';
import * as IncomesApi from '../api/incomes.api';

export const useIncome = (projectId: string, incomeId: string) =>
  useQuery({
    queryKey: ['income', projectId, incomeId],
    queryFn: () => IncomesApi.getIncome(projectId, incomeId).then((r) => r.data),
    enabled: !!projectId && !!incomeId,
    staleTime: 30_000,
  });

export const useExpense = (projectId: string, categoryId: string, expenseId: string) =>
  useQuery({
    queryKey: ['expense', projectId, categoryId, expenseId],
    queryFn: () => ExpensesApi.getExpense(projectId, categoryId, expenseId).then((r) => r.data),
    enabled: !!projectId && !!categoryId && !!expenseId,
    staleTime: 30_000,
  });

export const useAddIncomeAttachment = (projectId: string, incomeId: string, month: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: UploadFile) =>
      AttachmentsApi.uploadIncomeAttachment(projectId, incomeId, file).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income', projectId, incomeId] });
      queryClient.invalidateQueries({ queryKey: ['incomes', projectId, month] });
    },
  });
};

export const useDeleteIncomeAttachment = (projectId: string, incomeId: string, month: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) =>
      AttachmentsApi.deleteIncomeAttachment(projectId, incomeId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['income', projectId, incomeId] });
      queryClient.invalidateQueries({ queryKey: ['incomes', projectId, month] });
    },
  });
};

export const useAddExpenseAttachment = (
  projectId: string,
  categoryId: string,
  expenseId: string,
  month: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: UploadFile) =>
      AttachmentsApi.uploadExpenseAttachment(projectId, categoryId, expenseId, file).then(
        (r) => r.data
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', projectId, categoryId, expenseId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', projectId, categoryId, month] });
      queryClient.invalidateQueries({ queryKey: ['categories', projectId, month] });
    },
  });
};

export const useDeleteExpenseAttachment = (
  projectId: string,
  categoryId: string,
  expenseId: string,
  month: string
) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (attachmentId: string) =>
      AttachmentsApi.deleteExpenseAttachment(projectId, categoryId, expenseId, attachmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense', projectId, categoryId, expenseId] });
      queryClient.invalidateQueries({ queryKey: ['expenses', projectId, categoryId, month] });
      queryClient.invalidateQueries({ queryKey: ['categories', projectId, month] });
    },
  });
};
