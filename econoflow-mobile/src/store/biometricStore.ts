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
  biometricPromptSkipped: boolean;
  setBiometricEnabled: (enabled: boolean) => void;
  setBiometricPromptSkipped: () => void;
  resetBiometricPromptSkipped: () => void;
  clearBiometric: () => void;
}

export const useBiometricStore = create<BiometricState>()(
  persist(
    (set) => ({
      biometricEnabled: false,
      biometricPromptSkipped: false,
      setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
      setBiometricPromptSkipped: () => set({ biometricPromptSkipped: true }),
      resetBiometricPromptSkipped: () => set({ biometricPromptSkipped: false }),
      clearBiometric: () => set({ biometricEnabled: false, biometricPromptSkipped: false }),
    }),
    {
      name: 'econoflow-biometric',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        biometricEnabled: state.biometricEnabled,
        biometricPromptSkipped: state.biometricPromptSkipped,
      }),
    }
  )
);
