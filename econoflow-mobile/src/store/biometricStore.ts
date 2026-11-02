import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { trace } from '../diagnostics/trace';

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
        trace('bio.read.done', { biometricEnabled: state?.biometricEnabled, failed: Boolean(error) });
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

// ── Whether the stored answer is known ────────────────────────────────────────
//
// The screens that open a session (the unlock gate, the PIN setup's offer) decide from
// `biometricEnabled` / `biometricPromptSkipped`, and those only mean something once the
// read has landed. Reading `false` while it is still on its way is what sent a returning
// customer to "create your PIN" — or re-offered biometrics they had declined — right
// after logging in (#1116).

const answeringListeners = new Set<() => void>();

/** `true` while nothing would change the answer any more: the read landed or failed. */
const isAnswering = (): boolean =>
  useBiometricStore.persist.hasHydrated() || useBiometricStore.getState().hydrated;

const notifyAnswering = () => {
  for (const listener of Array.from(answeringListeners)) listener();
};

// Subscribed once: the store never announces a read that has *started*, and a forced
// re-read starts knowing nothing (`hasHydrated()` is false again), so the screen has to
// be told. Both `subscribe` and `onFinishHydration` are idempotent for these listeners.
useBiometricStore.subscribe(() => notifyAnswering());
useBiometricStore.persist.onFinishHydration(() => notifyAnswering());

/**
 * Whether the stored biometric answer has been read (#1116).
 *
 * A screen subscribes to this instead of reading `hasHydrated()` once: a session that
 * starts with a read still in flight must re-render when it lands, and lose the answer
 * again when the next one starts.
 */
export const subscribeBiometricAnswering = (listener: () => void): (() => void) => {
  answeringListeners.add(listener);
  return () => {
    answeringListeners.delete(listener);
  };
};

/** Current value of `subscribeBiometricAnswering`, for `useSyncExternalStore`. */
export const isBiometricAnswerKnown = (): boolean => isAnswering();

/**
 * Reads the stored value, once per app run. Every screen that acts on the setting calls
 * it, so they all wait for the same hydration instead of starting competing reads.
 *
 * `force` re-reads it for a new session in the same app run: the read is started by the
 * auth rehydration, and a second sign-in must not be left on the previous session's value
 * (`merge` keeps a value the user picked before the read landed, so a tap still wins).
 * A forced read starts life "unknown": until it answers, the value on screen belongs to
 * the previous session, so nothing may decide on it.
 *
 * The returned promise resolves when this read lands, never rejects.
 */
export const hydrateBiometricStore = (options: { force?: boolean } = {}): Promise<void> => {
  // A read already on its way answers every caller, forced or not: there is nothing a
  // second read could know that the one in flight will not.
  if (hydrationStarted && !isAnswering()) return hydrationStarted;
  // Nothing left to learn: the stored value is already in the store.
  if (!options.force && isAnswering()) return Promise.resolve();

  const started = new Promise<void>((resolve) => {
    // Deferred by a task: the store module is still being evaluated at import time, and
    // hydrating from the middle of it is the race this exists to remove.
    setTimeout(() => {
      let rehydration: Promise<void> | void;
      try {
        trace('bio.read.start');
        rehydration = useBiometricStore.persist.rehydrate();
      } catch {
        // A store that cannot start the read must still let its callers decide, with the
        // defaults, rather than leave them waiting.
        resolve();
        return;
      }
      Promise.resolve(rehydration).then(
        () => resolve(),
        (error) => { trace('bio.read.failed', { error: String(error) }); resolve(); },
      );
    }, 0);
  });
  hydrationStarted = started;
  // The answer is unknown from now until this read lands: everything that decides on the
  // stored values must render as pending, not on the previous session's.
  notifyAnswering();
  return started;
};





