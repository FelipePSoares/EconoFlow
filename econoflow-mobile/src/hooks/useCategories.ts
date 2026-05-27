import { useQuery } from '@tanstack/react-query';
import * as CategoriesApi from '../api/categories.api';
import { monthStart, monthEnd } from '../utils/date';

export const useCategoriesForMonth = (projectId: string, month: string) => {
  const from = monthStart(month);
  const to = monthEnd(month);

  return useQuery({
    queryKey: ['categories', projectId, month],
    queryFn: () => CategoriesApi.getCategories(projectId, from, to).then((r) => r.data),
    enabled: !!projectId,
    staleTime: 30_000,
  });
};
