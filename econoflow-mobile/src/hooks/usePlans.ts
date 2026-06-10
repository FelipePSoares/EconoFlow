import { useQueries, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as PlansApi from '../api/plans.api';
import type { CreatePlanRequest, CreatePlanEntryRequest, PatchOperation } from '../api/types';

export const usePlans = (projectId: string) =>
  useQuery({
    queryKey: ['plans', projectId],
    queryFn: () => PlansApi.getPlans(projectId).then((r) => r.data),
    enabled: !!projectId,
    staleTime: 60_000,
  });

export const usePlanEntries = (projectId: string, planId: string) =>
  useQuery({
    queryKey: ['planEntries', projectId, planId],
    queryFn: () => PlansApi.getPlanEntries(projectId, planId).then((r) => r.data),
    enabled: !!projectId && !!planId,
    staleTime: 30_000,
  });

export const useCreatePlan = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlanRequest) => PlansApi.createPlan(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans', projectId] });
    },
  });
};

export const useArchivePlan = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => PlansApi.archivePlan(projectId, planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans', projectId] });
    },
  });
};

export const usePatchPlan = (projectId: string, planId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ops: PatchOperation[]) => PlansApi.patchPlan(projectId, planId, ops),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans', projectId] });
    },
  });
};

export const useAddPlanEntry = (projectId: string, planId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlanEntryRequest) => PlansApi.addPlanEntry(projectId, planId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['planEntries', projectId, planId] });
      queryClient.invalidateQueries({ queryKey: ['plans', projectId] });
    },
  });
};

export const useTotalSavedForMonth = (projectId: string, month: string) => {
  const { data: plans = [], isLoading: plansLoading } = usePlans(projectId);

  const entriesResults = useQueries({
    queries: plans.map((plan) => ({
      queryKey: ['planEntries', projectId, plan.id],
      queryFn: () => PlansApi.getPlanEntries(projectId, plan.id).then((r) => r.data),
      enabled: !!projectId,
      staleTime: 60_000,
    })),
  });

  const isLoading = plansLoading || entriesResults.some((q) => q.isLoading);

  const totalSaved = entriesResults.reduce((total, query) => {
    const monthTotal = (query.data ?? [])
      .filter((entry) => entry.date.startsWith(month))
      .reduce((sum, entry) => sum + entry.amountSigned, 0);
    return total + monthTotal;
  }, 0);

  return { totalSaved, isLoading };
};
