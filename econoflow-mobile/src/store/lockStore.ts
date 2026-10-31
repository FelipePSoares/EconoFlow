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

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export interface LockState {
  /** When this session last left the foreground — persisted, so a relaunch can see it. */
  lastBackgroundTimestamp: number | null;
  isLocked: boolean;
  setBackgroundTimestamp: () => void;
  setUnlocked: () => void;
  checkAndLock: () => void;
  /**
   * Locks a session that expired while the app was not running at all (#1052).
   *
   * `checkAndLock` only reacts to a background → active transition, and a relaunch never
   * produces one, so the unlock gate used to be skipped and the app opened straight into
   * the data. The window is consumed once it has been judged, so the next background
   * transition starts from scratch. With no stored window there is no session to lock.
   */
  lockExpiredSession: () => void;
  reset: () => void;
}

export const useLockStore = create<LockState>()(
  persist(
    (set, get) => ({
      lastBackgroundTimestamp: null,
      isLocked: false,
      setBackgroundTimestamp: () => set({ lastBackgroundTimestamp: Date.now() }),
      setUnlocked: () => set({ isLocked: false }),
      checkAndLock: () => {
        const { lastBackgroundTimestamp, isLocked } = get();
        if (isLocked) return;
        if (lastBackgroundTimestamp === null) return;
        const elapsed = Date.now() - lastBackgroundTimestamp;
        if (elapsed >= LOCK_TIMEOUT_MS) {
          set({ isLocked: true, lastBackgroundTimestamp: null });
        }
      },
      lockExpiredSession: () => {
        const { lastBackgroundTimestamp, isLocked } = get();
        if (lastBackgroundTimestamp === null) {
          // No stored session window: either this is a first launch or the user signed
          // out. There is nothing to unlock, so a lock must not exist. Checked before
          // `isLocked`, so a stale lock cannot survive the absence of a session.
          set({ isLocked: false });
          return;
        }
        if (isLocked) return;
        const expired = Date.now() - lastBackgroundTimestamp >= LOCK_TIMEOUT_MS;
        set({ isLocked: expired, lastBackgroundTimestamp: null });
      },
      reset: () => set({ lastBackgroundTimestamp: null, isLocked: false }),
    }),
    {
      name: 'econoflow-lock',
      storage: createJSONStorage(() => secureStorage),
      // Only the session clock is persisted. `isLocked` is decided per launch by
      // `lockExpiredSession`, so a lock can never leak into the next session.
      partialize: (state) => ({
        lastBackgroundTimestamp: state.lastBackgroundTimestamp,
      }),
      onRehydrateStorage: () => () => {
        // Judged straight from the stored clock: a session that expires between the read
        // and this callback is still locked, and no session at all is not locked — the
        // lock only exists on top of an account (`overlayLocked` combines the two).
        useLockStore.getState().lockExpiredSession();
      },
    },
  ),
);
