import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as SmartSetupApi from '../api/smartSetup.api';
import type { SmartSetupRequest } from '../api/types';

export const useDefaultCategories = (projectId: string) =>
  useQuery({
    queryKey: ['defaultCategories', projectId],
    queryFn: () => SmartSetupApi.getDefaultCategories(projectId).then((r) => r.data),
    staleTime: 60_000,
  });

export const usePostSmartSetup = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: SmartSetupRequest }) =>
      SmartSetupApi.postSmartSetup(projectId, data).then((r) => r.data),
    onSuccess: (_result, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['categories', projectId] });
    },
  });
};
