import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
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
      onRehydrateStorage: () => () => {
        // A failed read still ends the wait: the gate must not hang on a broken keychain,
        // and "no PIN" is the safe answer for a keychain it cannot read.
        usePinStore.setState({ hydrated: true });
      },
    }
  )
);

let hydrationStarted: Promise<void> | null = null;

/**
 * Reads the stored PIN, once per app run unless `force` is passed.
 *
 * The unlock gate decides between "enter your PIN" and "create one" from `hasPin`, and it
 * is the first screen of a session — it cannot rely on a screen having started the read
 * already. `force` lets the session bind refresh the value when a new session begins in
 * the same app run (a sign-out and a second account).
 */
export const hydratePinStore = (options: { force?: boolean } = {}): Promise<void> => {
  if (hydrationStarted && !options.force) return hydrationStarted;
  hydrationStarted = new Promise<void>((resolve) => {
    // Deferred by a task so the store module is never hydrated from the middle of its own
    // evaluation, the same reason `hydrateBiometricStore` waits.
    setTimeout(() => {
      const rehydration = usePinStore.persist.rehydrate();
      Promise.resolve(rehydration).then(
        () => resolve(),
        () => resolve(),
      );
    }, 0);
  });
  return hydrationStarted;
};
