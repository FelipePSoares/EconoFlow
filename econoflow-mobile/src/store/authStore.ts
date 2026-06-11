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
  needsOnboarding: boolean;
  /** Volatile flag (not persisted): navigate to CreateProject when MainNavigator first mounts after onboarding */
  openCreateProjectOnStart: boolean;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  clearAuth: () => void;
  setOpenCreateProjectOnStart: (v: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      needsOnboarding: false,
      openCreateProjectOnStart: false,
      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken, isAuthenticated: true }),
      setUser: (user) => {
        setUserContext(user.id);
        set({ user, needsOnboarding: !!user && !user.firstName });
      },
      clearAuth: () => {
        clearUserContext();
        set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false, needsOnboarding: false, openCreateProjectOnStart: false });
      },
      setOpenCreateProjectOnStart: (v) => set({ openCreateProjectOnStart: v }),
    }),
    {
      name: 'econoflow-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // needsOnboarding and openCreateProjectOnStart are intentionally excluded:
        // needsOnboarding is recomputed from user.firstName in onRehydrateStorage;
        // openCreateProjectOnStart resets to false on app restart.
      }),
      // Restore the Sentry user context after the store is rehydrated from
      // SecureStore on app launch (the setUser action is not replayed on
      // rehydration, so we need to sync Sentry here explicitly).
      onRehydrateStorage: () => (state) => {
        if (state?.user?.id) {
          setUserContext(state.user.id);
        }
        if (state) {
          state.needsOnboarding = !!state.user && !state.user.firstName;
        }
      },
    }
  )
);
