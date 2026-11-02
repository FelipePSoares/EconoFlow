import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { trace } from '../diagnostics/trace';
import { digestStringAsync, CryptoDigestAlgorithm } from 'expo-crypto';

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

/** The PIN is 4 to 6 digits; the user picks the length on the setup screen. */
export const PIN_LENGTH_MIN = 4;
export const PIN_LENGTH_MAX = 6;

export interface PinState {
  pinHash: string | null;
  hasPin: boolean;
  /**
   * How many digits the PIN has, so entry knows when to verify (#1052). `null` for a PIN
   * saved before the length was recorded — entry then falls back to the hash comparison.
   */
  pinLength: number | null;
  /** `true` once the stored PIN has been read; `hasPin` is only meaningful after it. */
  hydrated: boolean;
  /** Stores the PIN. A PIN outside 4–6 digits is refused, not silently hashed. */
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  clearPin: () => void;
}

const isValidPin = (pin: string): boolean =>
  new RegExp(`^\\d{${PIN_LENGTH_MIN},${PIN_LENGTH_MAX}}$`).test(pin);

const hashPin = (pin: string): Promise<string> =>
  digestStringAsync(CryptoDigestAlgorithm.SHA256, pin);

export const usePinStore = create<PinState>()(
  persist(
    (set, get) => ({
      pinHash: null,
      hasPin: false,
      pinLength: null,
      hydrated: false,
      setPin: async (pin: string) => {
        if (!isValidPin(pin)) return;
        const hash = await hashPin(pin);
        set({ pinHash: hash, hasPin: true, pinLength: pin.length });
      },
      verifyPin: async (pin: string) => {
        const { pinHash } = get();
        if (!pinHash) return false;
        const hash = await hashPin(pin);
        return hash === pinHash;
      },
      clearPin: () => set({ pinHash: null, hasPin: false, pinLength: null }),
    }),
    {
      name: 'econoflow-pin',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        pinHash: state.pinHash,
        hasPin: state.hasPin,
        pinLength: state.pinLength,
      }),
      onRehydrateStorage: () => (state, error) => {
        trace('pin.read.done', { hasPin: state?.hasPin, failed: Boolean(error) });
        // A failed read still ends the wait: the gate must not hang on a broken keychain,
        // and "no PIN" is the safe answer for a keychain it cannot read.
        usePinStore.setState({ hydrated: true });
      },
    }
  )
);

let hydrationStarted: Promise<void> | null = null;

// ── Whether the stored PIN is known ───────────────────────────────────────────
//
// `hasPin` is only an answer once the read has landed. The gate asks it the moment a
// session appears, which on a login is also the moment the read starts; reading the
// default `false` then sent a returning customer to "Create App PIN" over the PIN they
// already had (#1116).

const answeringListeners = new Set<() => void>();

/** `true` while nothing would change the answer any more: the read landed or failed. */
const isAnswering = (): boolean =>
  usePinStore.persist.hasHydrated() || usePinStore.getState().hydrated;

const notifyAnswering = () => {
  for (const listener of Array.from(answeringListeners)) listener();
};

// Subscribed once: a store never announces a read that has *started*, and a forced re-read
// starts knowing nothing (`hasHydrated()` is false again), so the screen has to be told.
// Both `subscribe` and `onFinishHydration` are idempotent for these listeners.
usePinStore.subscribe(() => notifyAnswering());
usePinStore.persist.onFinishHydration(() => notifyAnswering());

/**
 * Whether the stored PIN has been read (#1116). A screen subscribes to this instead of
 * reading `hasHydrated()` once, so it re-renders when the read lands — and loses the
 * answer again when the next one starts.
 */
export const subscribePinAnswering = (listener: () => void): (() => void) => {
  answeringListeners.add(listener);
  return () => {
    answeringListeners.delete(listener);
  };
};

/** Current value of `subscribePinAnswering`, for `useSyncExternalStore`. */
export const isPinAnswerKnown = (): boolean => isAnswering();

/**
 * Reads the stored PIN. The unlock gate decides between "enter your PIN" and "create one"
 * from `hasPin`, and it is the first screen of a session — it cannot rely on a screen
 * having started the read already.
 *
 * `force` re-reads it when a new session begins in the same app run (a sign-out and a
 * second account); a forced read starts life "unknown", because until it answers the
 * value in the store belongs to the previous session. The returned promise resolves when
 * this read lands, never rejects.
 */
export const hydratePinStore = (options: { force?: boolean } = {}): Promise<void> => {
  // A read already on its way answers every caller, forced or not: there is nothing a
  // second read could know that the one in flight will not.
  if (hydrationStarted && !isAnswering()) return hydrationStarted;
  // Nothing left to learn: the stored PIN is already in the store.
  if (!options.force && isAnswering()) return Promise.resolve();

  const started = new Promise<void>((resolve) => {
    // Deferred by a task so the store module is never hydrated from the middle of its own
    // evaluation, the same reason `hydrateBiometricStore` waits.
    setTimeout(() => {
      let rehydration: Promise<void> | void;
      try {
        trace('pin.read.start');
        rehydration = usePinStore.persist.rehydrate();
      } catch (error) {
        trace('pin.read.throw', { error: String(error) });
        // A store that cannot start the read must still let its callers decide, with the
        // defaults, rather than leave them waiting.
        resolve();
        return;
      }
      Promise.resolve(rehydration).then(
        () => resolve(),
        (error) => { trace('pin.read.failed', { error: String(error) }); resolve(); },
      );
    }, 0);
  });
  hydrationStarted = started;
  // The answer is unknown from now until this read lands: everything that decides on the
  // stored PIN must render as pending, not on the previous session's.
  notifyAnswering();
  return started;
};





