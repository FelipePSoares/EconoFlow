import { create } from 'zustand';

interface UIState {
  hideTabBar: boolean;
  setHideTabBar: (hide: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  hideTabBar: false,
  setHideTabBar: (hide) => set({ hideTabBar: hide }),
}));
