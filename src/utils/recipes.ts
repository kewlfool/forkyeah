import type { Recipe } from '../types/models';

const ensureStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item)).map((item) => item.trim()).filter(Boolean);
};

const normalizeTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  return value;
};

export const normalizeRecipe = (recipe: Recipe): Recipe => {
  return {
    ...recipe,
    title: recipe.title?.trim() ?? '',
    imageUrl: recipe.imageUrl?.trim() ?? '',
    ingredients: ensureStringArray(recipe.ingredients),
    steps: ensureStringArray(recipe.steps),
    tags: ensureStringArray(recipe.tags),
    prepTime: recipe.prepTime?.trim() ?? '',
    cookTime: recipe.cookTime?.trim() ?? '',
    notes: recipe.notes?.trim() ?? '',
    lastCooked: normalizeTimestamp(recipe.lastCooked),
    createdAt:
      typeof recipe.createdAt === 'number' && Number.isFinite(recipe.createdAt) ? recipe.createdAt : Date.now()
  };
};

export const listFromMultiline = (value: string): string[] => {
  return value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
};

export const multilineFromList = (list: string[]): string => {
  return list.join('\n');
};

export const formatCookedDate = (value: number | null): string => {
  if (!value || !Number.isFinite(value)) {
    return 'Never';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
};

export const toDateInputValue = (value: number | null): string => {
  if (!value || !Number.isFinite(value)) {
    return '';
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const fromDateInputValue = (value: string): number | null => {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split('-').map((item) => Number.parseInt(item, 10));
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  const timestamp = date.getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};
