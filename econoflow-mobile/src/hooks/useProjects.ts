import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ProjectsApi from '../api/projects.api';
import type { CreateProjectRequest, PatchOperation } from '../api/types';

export const useProjects = () =>
  useQuery({
    queryKey: ['projects'],
    queryFn: () => ProjectsApi.getProjects().then((r) => r.data),
    staleTime: 60_000,
  });

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProjectRequest) =>
      ProjectsApi.createProject(data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};

export const usePatchProject = (projectId: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ops: PatchOperation[]) =>
      ProjectsApi.patchProject(projectId, ops).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });
};
