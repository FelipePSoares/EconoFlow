import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import * as IncomesApi from '../api/incomes.api';
import type { CreateIncomeRequest, PatchOperation } from '../api/types';
import { monthStart, monthEnd } from '../utils/date';

export const useIncomesForMonth = (projectId: string, month: string) => {
  const from = monthStart(month);
  const to = monthEnd(month);

  return useQuery({
    queryKey: ['incomes', projectId, month],
    queryFn: () => IncomesApi.getIncomes(projectId, from, to).then((r) => r.data),
    enabled: !!projectId,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
};

export const useCreateIncome = (projectId: string, month: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateIncomeRequest) =>
      IncomesApi.createIncome(projectId, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes', projectId, month] });
    },
  });
};

export const usePatchIncome = (projectId: string, incomeId: string, month: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ops: PatchOperation[]) =>
      IncomesApi.patchIncome(projectId, incomeId, ops).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes', projectId, month] });
    },
  });
};

export const useDeleteIncome = (projectId: string, month: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (incomeId: string) => IncomesApi.deleteIncome(projectId, incomeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes', projectId, month] });
    },
  });
};
