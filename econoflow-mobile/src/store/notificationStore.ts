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

export interface NotificationState {
  expoPushToken: string | null;
  notificationsEnabled: boolean;
  setExpoPushToken: (token: string) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  clearNotificationState: () => void;
}

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      expoPushToken: null,
      notificationsEnabled: false,
      setExpoPushToken: (token) => set({ expoPushToken: token }),
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      clearNotificationState: () => set({ expoPushToken: null, notificationsEnabled: false }),
    }),
    {
      name: 'econoflow-notifications',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        expoPushToken: state.expoPushToken,
        notificationsEnabled: state.notificationsEnabled,
      }),
    },
  ),
);
