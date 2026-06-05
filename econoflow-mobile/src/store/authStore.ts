import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../api/types';
import { setUserContext, clearUserContext } from '../monitoring/sentry';

interface SecureStorage {
  getItem(name: string): Promise<string | null>;
  setItem(name: string, value: string): Promise<void>;
  removeItem(name: string): Promise<void>;
}

const secureStorage: SecureStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};

export interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: true }),
      setUser: (user) => {
        setUserContext(user.id);
        set({ user });
      },
      clearAuth: () => {
        clearUserContext();
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'econoflow-auth',
      storage: createJSONStorage(() => secureStorage),
      // Restore the Sentry user context after the store is rehydrated from
      // SecureStore on app launch (the setUser action is not replayed on
      // rehydration, so we need to sync Sentry here explicitly).
      onRehydrateStorage: () => (state) => {
        if (state?.user?.id) {
          setUserContext(state.user.id);
        }
      },
    }
  )
);
