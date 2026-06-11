import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  manageInfo,
  getTwoFactorSetup,
  enableTwoFactor,
  disableTwoFactor,
} from '../api/user.api';
import { useAuthStore } from '../store/authStore';
import type {
  ManageInfoRequest,
  EnableTwoFactorRequest,
  EnableTwoFactorResponse,
  DisableTwoFactorRequest,
} from '../api/types';

export const useChangePassword = () =>
  useMutation({
    mutationFn: (req: ManageInfoRequest) => manageInfo(req),
  });

export const useChangeEmail = () =>
  useMutation({
    mutationFn: (req: ManageInfoRequest) => manageInfo(req),
  });

export const useTwoFactorSetup = () =>
  useQuery({
    queryKey: ['twoFactorSetup'],
    queryFn: () => getTwoFactorSetup().then((r) => r.data),
    staleTime: 60_000,
  });

export const useEnableTwoFactor = () => {
  const queryClient = useQueryClient();
  const { setUser, user } = useAuthStore();

  return useMutation<EnableTwoFactorResponse, Error, EnableTwoFactorRequest>({
    mutationFn: (req) => enableTwoFactor(req).then((r) => r.data),
    onSuccess: (data) => {
      if (user) {
        setUser({ ...user, twoFactorEnabled: data.twoFactorEnabled });
      }
      queryClient.invalidateQueries({ queryKey: ['twoFactorSetup'] });
    },
  });
};

export const useDisableTwoFactor = () => {
  const queryClient = useQueryClient();
  const { setUser, user } = useAuthStore();

  return useMutation<unknown, Error, DisableTwoFactorRequest>({
    mutationFn: (req) => disableTwoFactor(req).then((r) => r.data),
    onSuccess: () => {
      if (user) {
        setUser({ ...user, twoFactorEnabled: false });
      }
      queryClient.invalidateQueries({ queryKey: ['twoFactorSetup'] });
    },
  });
};
