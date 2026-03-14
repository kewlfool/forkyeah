import { create } from 'zustand';
import {
  loadDeckRendererMode,
  loadThemeMode,
  saveDeckRendererMode,
  saveThemeMode
} from '../db/forkyeahDb';
import type { DeckRendererMode, ThemeMode } from '../types/models';

interface HomeState {
  themeMode: ThemeMode;
  deckMode: DeckRendererMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => void;
  setDeckMode: (mode: DeckRendererMode) => void;
}

export const useHomeStore = create<HomeState>((set) => ({
  themeMode: 'light',
  deckMode: 'list',
  hydrated: false,

  hydrate: async () => {
    const [themeMode, deckMode] = await Promise.all([loadThemeMode(), loadDeckRendererMode()]);
    set((state) => ({
      themeMode: themeMode ?? state.themeMode,
      deckMode: deckMode ?? state.deckMode,
      hydrated: true
    }));
  },

  setThemeMode: (mode: ThemeMode) => {
    set({ themeMode: mode });
    void saveThemeMode(mode);
  },

  setDeckMode: (mode: DeckRendererMode) => {
    set({ deckMode: mode });
    void saveDeckRendererMode(mode);
  }
}));
