import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { User } from '../api/types';
import { setUserContext, clearUserContext } from '../monitoring/sentry';
import { useNotificationStore } from './notificationStore';
import { hydrateBiometricStore } from './biometricStore';
import { hydratePinStore } from './pinStore';
import { trace } from '../diagnostics/trace';

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
        // The notification prompt is answered once per user (#1053). Every authenticated
        // path — password login, registration auto-login, 2FA — lands here, so binding
        // the answer to this id is what lets a second account on the same device get its
        // own rationale and prompt instead of inheriting the previous user's silence.
        // It also tells the prompt that this run's answer is the one it has to wait for.
        useNotificationStore.getState().bindSignedInUser(user.id ?? null);
        // The unlock gate reads the PIN and the biometric flag from stores that are only
        // hydrated by the relaunch path above; a fresh sign-in never rehydrates anything,
        // so without this the gate saw the defaults ("no PIN") and sent the user to create
        // one — or to the enrollment screen — right after logging in (#1052).
        void hydratePinStore({ force: true });
        void hydrateBiometricStore({ force: true });
        set({ user, needsOnboarding: !!user && !user.firstName });
      },
      clearAuth: () => {
        // The trail's one line about a session disappearing. It is written before the state
        // changes because the screen that caused it is gone by the time anyone looks (#1116).
        trace('auth.clear');
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
          // A returning user relaunches the app every day and `setUser` is not replayed by
          // the rehydration, so this is the only place that binds the session to its
          // account and starts the two lock stores' reads. Without it the notification
          // store never learns which account it answered for (#1053), and the unlock gate
          // — the first screen of a session — ran on defaults and re-offered enrollment
          // (#1052). Forced, so a second session in the same app run re-reads both.
          useNotificationStore.getState().bindSignedInUser(state.user?.id ?? null);
          if (state.isAuthenticated && state.user) {
            void hydrateBiometricStore({ force: true });
            void hydratePinStore({ force: true });
          }
        }
      },
    }
  )
);
