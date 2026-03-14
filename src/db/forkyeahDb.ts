import Dexie, { type Table } from 'dexie';
import type { DeckRendererMode, Recipe, ThemeMode, TimeReminder, TimelessChimeMode } from '../types/models';
import { normalizeRecipe } from '../utils/recipes';

interface SettingRecord {
  key: string;
  value: string;
}

class ForkyeahDB extends Dexie {
  recipes!: Table<Recipe, string>;
  timeReminders!: Table<TimeReminder, string>;
  settings!: Table<SettingRecord, string>;

  constructor() {
    super('forkyeah-db');

    this.version(1).stores({
      recipes: 'id, createdAt',
      timeReminders: 'id, fireAt, createdAt, updatedAt, canceled, completed',
      settings: 'key'
    });

    this.version(2).stores({
      recipes: 'id, createdAt',
      timeReminders: 'id, fireAt, createdAt, updatedAt, canceled, completed',
      settings: 'key'
    }).upgrade((tx) => {
      return tx.table('recipes').toCollection().modify((recipe: Recipe) => {
        recipe.description = recipe.description ?? '';
        recipe.categories = recipe.categories ?? [];
        recipe.cuisines = recipe.cuisines ?? [];
        recipe.nutrients = recipe.nutrients ?? [];
      });
    });
  }
}

export const db = new ForkyeahDB();

export const loadRecipes = async (): Promise<Recipe[]> => {
  const recipes = await db.recipes.toArray();

  return recipes
    .map(normalizeRecipe)
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
};

export const saveRecipe = async (recipe: Recipe): Promise<void> => {
  await db.recipes.put(normalizeRecipe(recipe));
};

export const saveRecipes = async (recipes: Recipe[]): Promise<void> => {
  await db.transaction('rw', db.recipes, async () => {
    await db.recipes.clear();
    await db.recipes.bulkPut(recipes.map(normalizeRecipe));
  });
};

export const removeRecipeFromDB = async (recipeId: string): Promise<void> => {
  await db.recipes.delete(recipeId);
};

export const loadTimeReminders = async (): Promise<TimeReminder[]> => {
  const reminders = await db.timeReminders.toArray();

  return reminders.sort(
    (a, b) => a.fireAt - b.fireAt || a.createdAt - b.createdAt || a.id.localeCompare(b.id)
  );
};

export const saveTimeReminder = async (reminder: TimeReminder): Promise<void> => {
  await db.timeReminders.put(reminder);
};

export const saveTimeReminders = async (reminders: TimeReminder[]): Promise<void> => {
  await db.transaction('rw', db.timeReminders, async () => {
    await db.timeReminders.clear();
    await db.timeReminders.bulkPut(reminders);
  });
};

export const removeTimeReminderFromDB = async (reminderId: string): Promise<void> => {
  await db.timeReminders.delete(reminderId);
};

const THEME_MODE_KEY = 'themeMode';
const DECK_RENDERER_MODE_KEY = 'deckRendererMode';
const TIMELESS_CHIME_MODE_KEY = 'timelessChimeMode';
const TIMELESS_CHIME_FROM_HOUR_KEY = 'timelessChimeFromHour';
const TIMELESS_CHIME_TILL_HOUR_KEY = 'timelessChimeTillHour';
const TIMELESS_CHIME_ENABLED_KEY = 'timelessChimeEnabled';
const TIMELESS_CHIME_RANDOM_MINUTE_1_KEY = 'timelessChimeRandomMinute1';
const TIMELESS_CHIME_RANDOM_MINUTE_2_KEY = 'timelessChimeRandomMinute2';

const parseThemeMode = (value: string): ThemeMode | null => {
  if (value === 'light' || value === 'dark') {
    return value;
  }

  return null;
};

const parseDeckRendererMode = (value: string): DeckRendererMode | null => {
  if (value === 'list' || value === 'grid' || value === 'stack') {
    return value;
  }

  return null;
};

const parseTimelessChimeMode = (value: string): TimelessChimeMode | null => {
  if (value === 'hourly' || value === 'halfHourly' || value === 'random') {
    return value;
  }

  return null;
};

const parseIntegerInRange = (value: string, min: number, max: number): number | null => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return null;
  }

  if (parsed < min || parsed > max) {
    return null;
  }

  return parsed;
};

const parseHour = (value: string): number | null => parseIntegerInRange(value, 0, 23);
const parseRandomMinute1 = (value: string): number | null => parseIntegerInRange(value, 1, 29);
const parseRandomMinute2 = (value: string): number | null => parseIntegerInRange(value, 30, 59);

const parseBooleanString = (value: string): boolean | null => {
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return null;
};

export const loadThemeMode = async (): Promise<ThemeMode | null> => {
  const row = await db.settings.get(THEME_MODE_KEY);
  if (!row) {
    return null;
  }

  return parseThemeMode(row.value);
};

export const saveThemeMode = async (mode: ThemeMode): Promise<void> => {
  await db.settings.put({ key: THEME_MODE_KEY, value: mode });
};

export const loadDeckRendererMode = async (): Promise<DeckRendererMode | null> => {
  const row = await db.settings.get(DECK_RENDERER_MODE_KEY);
  if (!row) {
    return null;
  }

  return parseDeckRendererMode(row.value);
};

export const saveDeckRendererMode = async (mode: DeckRendererMode): Promise<void> => {
  await db.settings.put({ key: DECK_RENDERER_MODE_KEY, value: mode });
};

export const loadTimelessChimeMode = async (): Promise<TimelessChimeMode | null> => {
  const row = await db.settings.get(TIMELESS_CHIME_MODE_KEY);
  if (!row) {
    return null;
  }

  return parseTimelessChimeMode(row.value);
};

export const saveTimelessChimeMode = async (mode: TimelessChimeMode): Promise<void> => {
  await db.settings.put({ key: TIMELESS_CHIME_MODE_KEY, value: mode });
};

export const loadTimelessChimeFromHour = async (): Promise<number | null> => {
  const row = await db.settings.get(TIMELESS_CHIME_FROM_HOUR_KEY);
  if (!row) {
    return null;
  }

  return parseHour(row.value);
};

export const saveTimelessChimeFromHour = async (hour: number): Promise<void> => {
  await db.settings.put({ key: TIMELESS_CHIME_FROM_HOUR_KEY, value: String(hour) });
};

export const loadTimelessChimeTillHour = async (): Promise<number | null> => {
  const row = await db.settings.get(TIMELESS_CHIME_TILL_HOUR_KEY);
  if (!row) {
    return null;
  }

  return parseHour(row.value);
};

export const saveTimelessChimeTillHour = async (hour: number): Promise<void> => {
  await db.settings.put({ key: TIMELESS_CHIME_TILL_HOUR_KEY, value: String(hour) });
};

export const loadTimelessChimeEnabled = async (): Promise<boolean | null> => {
  const row = await db.settings.get(TIMELESS_CHIME_ENABLED_KEY);
  if (!row) {
    return null;
  }

  return parseBooleanString(row.value);
};

export const saveTimelessChimeEnabled = async (enabled: boolean): Promise<void> => {
  await db.settings.put({ key: TIMELESS_CHIME_ENABLED_KEY, value: enabled ? 'true' : 'false' });
};

export const loadTimelessChimeRandomMinute1 = async (): Promise<number | null> => {
  const row = await db.settings.get(TIMELESS_CHIME_RANDOM_MINUTE_1_KEY);
  if (!row) {
    return null;
  }

  return parseRandomMinute1(row.value);
};

export const saveTimelessChimeRandomMinute1 = async (minute: number): Promise<void> => {
  await db.settings.put({ key: TIMELESS_CHIME_RANDOM_MINUTE_1_KEY, value: String(minute) });
};

export const loadTimelessChimeRandomMinute2 = async (): Promise<number | null> => {
  const row = await db.settings.get(TIMELESS_CHIME_RANDOM_MINUTE_2_KEY);
  if (!row) {
    return null;
  }

  return parseRandomMinute2(row.value);
};

export const saveTimelessChimeRandomMinute2 = async (minute: number): Promise<void> => {
  await db.settings.put({ key: TIMELESS_CHIME_RANDOM_MINUTE_2_KEY, value: String(minute) });
};
