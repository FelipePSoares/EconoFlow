import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProject } from '../api/types';

interface ProjectState {
  selectedProject: UserProject | null;
  currency: string;
  setSelectedProject: (project: UserProject) => void;
  clearProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      selectedProject: null,
      currency: 'EUR',
      setSelectedProject: (project) =>
        set({ selectedProject: project, currency: project.project.preferredCurrency }),
      clearProject: () => set({ selectedProject: null, currency: 'EUR' }),
    }),
    {
      name: 'econoflow-project',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
