export type ThemeMode = 'light' | 'dark';
export type TimelessChimeMode = 'hourly' | 'halfHourly' | 'random';
export type RecipeViewMode = 'scroll' | 'card' | 'list';

export interface Recipe {
  id: string;
  title: string;
  imageUrl?: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
  prepTime: string;
  cookTime: string;
  notes: string;
  lastCooked: number | null;
  createdAt: number;
}

export interface TimeReminder {
  id: string;
  name: string;
  fireAt: number;
  canceled: boolean;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
}

export const createId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};
