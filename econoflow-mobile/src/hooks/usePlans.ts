import { useQueries, useQuery } from '@tanstack/react-query';
import * as PlansApi from '../api/plans.api';

const usePlans = (projectId: string) =>
  useQuery({
    queryKey: ['plans', projectId],
    queryFn: () => PlansApi.getPlans(projectId).then((r) => r.data),
    enabled: !!projectId,
    staleTime: 60_000,
  });

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
