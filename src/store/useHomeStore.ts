import { create } from 'zustand';
import { loadThemeMode, saveThemeMode } from '../db/forkyeahDb';
import type { ThemeMode } from '../types/models';

interface HomeState {
  themeMode: ThemeMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => void;
}

export const useHomeStore = create<HomeState>((set) => ({
  themeMode: 'light',
  hydrated: false,

  hydrate: async () => {
    const themeMode = await loadThemeMode();
    set((state) => ({
      themeMode: themeMode ?? state.themeMode,
      hydrated: true
    }));
  },

  setThemeMode: (mode: ThemeMode) => {
    set({ themeMode: mode });
    void saveThemeMode(mode);
  }
}));
