import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';

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

export interface BiometricState {
  biometricEnabled: boolean;
  skipCount: number;
  setBiometricEnabled: (enabled: boolean) => void;
  incrementSkipCount: () => void;
  resetSkipCount: () => void;
  clearBiometric: () => void;
}

export const useBiometricStore = create<BiometricState>()(
  persist(
    (set) => ({
      biometricEnabled: false,
      skipCount: 0,
      setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
      incrementSkipCount: () => set((s) => ({ skipCount: s.skipCount + 1 })),
      resetSkipCount: () => set({ skipCount: 0 }),
      clearBiometric: () => set({ biometricEnabled: false, skipCount: 0 }),
    }),
    {
      name: 'econoflow-biometric',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        biometricEnabled: state.biometricEnabled,
        skipCount: state.skipCount,
      }),
    }
  )
);
