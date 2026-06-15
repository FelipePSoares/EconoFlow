import { create } from 'zustand';

const LOCK_TIMEOUT_MS = 5 * 60 * 1000;

export interface LockState {
  lastBackgroundTimestamp: number | null;
  isLocked: boolean;
  setBackgroundTimestamp: () => void;
  setUnlocked: () => void;
  checkAndLock: () => void;
  reset: () => void;
}

export const useLockStore = create<LockState>()((set, get) => ({
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
  reset: () => set({ lastBackgroundTimestamp: null, isLocked: false }),
}));
