import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchUser } from '../api/user.api';
import { useAuthStore } from '../store/authStore';
import type { PatchOperation, User } from '../api/types';

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  const { setUser } = useAuthStore();

  return useMutation<User, Error, PatchOperation[]>({
    mutationFn: (patches) => patchUser(patches).then((r) => r.data),
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.invalidateQueries({ queryKey: ['currentUser'] });
    },
  });
};
