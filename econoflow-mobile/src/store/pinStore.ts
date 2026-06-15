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

export interface PinState {
  pinHash: string | null;
  hasPin: boolean;
  setPin: (pin: string) => Promise<void>;
  verifyPin: (pin: string) => Promise<boolean>;
  clearPin: () => void;
}

const hashPin = (pin: string): Promise<string> =>
  digestStringAsync(CryptoDigestAlgorithm.SHA256, pin);

export const usePinStore = create<PinState>()(
  persist(
    (set, get) => ({
      pinHash: null,
      hasPin: false,
      setPin: async (pin: string) => {
        const hash = await hashPin(pin);
        set({ pinHash: hash, hasPin: true });
      },
      verifyPin: async (pin: string) => {
        const { pinHash } = get();
        if (!pinHash) return false;
        const hash = await hashPin(pin);
        return hash === pinHash;
      },
      clearPin: () => set({ pinHash: null, hasPin: false }),
    }),
    {
      name: 'econoflow-pin',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        pinHash: state.pinHash,
        hasPin: state.hasPin,
      }),
    }
  )
);
