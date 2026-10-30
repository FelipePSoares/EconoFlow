import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

interface SecureStorage {
  getItem(name: string): Promise<string | null>;
  setItem(name: string, value: string): Promise<void>;
  removeItem(name: string): Promise<void>;
}

const STORAGE_KEY = 'econoflow-biometric';

const secureStorage: SecureStorage = {
  getItem: (name) => SecureStore.getItemAsync(name),
  setItem: (name, value) => SecureStore.setItemAsync(name, value),
  removeItem: (name) => SecureStore.deleteItemAsync(name),
};

export interface BiometricState {
  biometricEnabled: boolean;
  biometricPromptSkipped: boolean;
  /**
   * Whether the persisted state has been read into the store. Anything that turns the
   * value on must wait for it — see `useBiometricToggle`.
   */
  hydrated: boolean;
  setBiometricEnabled: (enabled: boolean) => void;
  setBiometricPromptSkipped: () => void;
  resetBiometricPromptSkipped: () => void;
  clearBiometric: () => void;
}

/**
 * A change applied before the stored value was read.
 *
 * The store hydrates asynchronously from SecureStore, and zustand applies the stored state
 * as a whole when the read comes back. Hydration is therefore kept off the module-load
 * path (`skipHydration`) and started only through `hydrateBiometricStore`; until then a
 * change is recorded here, so it cannot be overwritten by a read that was already in
 * flight — which is what made the Profile switch flip back and require a second tap
 * (#1052).
 */
let pendingBiometricEnabled: boolean | null = null;

/** Set when a pending choice replaced the stored one, so it is written back after. */
let pendingChoiceApplied = false;

export const useBiometricStore = create<BiometricState>()(
  persist(
    (set, get) => ({
      biometricEnabled: false,
      biometricPromptSkipped: false,
      hydrated: false,
      setBiometricEnabled: (enabled) => {
        // Only a value the user picked before the read finished needs to be remembered:
        // once the store is hydrated the normal write path applies.
        if (!get().hydrated && !useBiometricStore.persist.hasHydrated()) {
          pendingBiometricEnabled = enabled;
        }
        set({ biometricEnabled: enabled });
      },
      setBiometricPromptSkipped: () => set({ biometricPromptSkipped: true }),
      resetBiometricPromptSkipped: () => set({ biometricPromptSkipped: false }),
      clearBiometric: () => set({ biometricEnabled: false, biometricPromptSkipped: false }),
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        biometricEnabled: state.biometricEnabled,
        biometricPromptSkipped: state.biometricPromptSkipped,
      }),
      /**
       * Runs with the stored state the replay is about to apply. A value the user picked
       * before the read finished wins over the stored one; it is written back right after,
       * so the next launch starts from the user's choice rather than from what was stored.
       */
      merge: (persistedState, currentState) => {
        const persisted = (persistedState ?? {}) as Partial<BiometricState>;
        const pending = pendingBiometricEnabled;
        pendingBiometricEnabled = null;
        if (pending === null) return { ...currentState, ...persisted };
        pendingChoiceApplied = !Object.is(persisted.biometricEnabled, pending);
        return { ...currentState, ...persisted, biometricEnabled: pending };
      },
      onRehydrateStorage: () => (state, error) => {
        useBiometricStore.setState({ hydrated: true });
        if (error || !pendingChoiceApplied || !state) return;
        pendingChoiceApplied = false;
        const options = useBiometricStore.persist.getOptions();
        // The replay applied the stored value; replace it with the choice the user made so
        // the next launch reads that one.
        void Promise.resolve()
          .then(() =>
            options.storage?.setItem(STORAGE_KEY, {
              state: options.partialize?.(state) ?? {},
              version: options.version,
            }),
          )
          .catch(() => undefined);
      },
      // Kept off the module-load path: the read starts from `hydrateBiometricStore`, so a
      // tap can never race a hydration that is already in flight.
      skipHydration: true,
    }
  )
);

let hydrationStarted: Promise<void> | null = null;

/**
 * Reads the stored value, once per app run. Every screen that acts on the setting calls
 * it, so they all wait for the same hydration instead of starting competing reads.
 */
export const hydrateBiometricStore = (): Promise<void> => {
  if (hydrationStarted) return hydrationStarted;
  hydrationStarted = new Promise<void>((resolve) => {
    // Deferred by a task: the store module is still being evaluated at import time, and
    // hydrating from the middle of it is the race this exists to remove.
    setTimeout(() => {
      const rehydration = useBiometricStore.persist.rehydrate();
      Promise.resolve(rehydration).then(
        () => resolve(),
        () => resolve(),
      );
    }, 0);
  });
  return hydrationStarted;
};
