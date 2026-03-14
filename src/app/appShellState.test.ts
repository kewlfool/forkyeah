import { describe, expect, it } from 'vitest';
import {
  appShellReducer,
  buildInitialAppShellState,
  type AppShellState
} from './appShellState';
import type { Recipe } from '../types/models';
import type { RecipeStagingDraft } from '../components/recipe/RecipeStagingScreen';

const buildRecipe = (): Recipe => ({
  id: 'recipe-1',
  title: 'Test recipe',
  description: '',
  imageUrl: '',
  ingredients: ['Salt'],
  steps: ['Cook'],
  tags: [],
  categories: [],
  cuisines: [],
  nutrients: [],
  prepTime: '',
  cookTime: '',
  notes: '',
  lastCooked: null,
  createdAt: Date.now()
});

const buildDraft = (): RecipeStagingDraft => ({
  title: 'Draft',
  description: '',
  imageUrl: '',
  ingredients: [],
  steps: [],
  tags: [],
  categories: [],
  cuisines: [],
  nutrients: [],
  prepTime: '',
  cookTime: '',
  notes: '',
  lastCooked: null,
  sourceLabel: 'Manual',
  rawContent: ''
});

describe('appShellReducer', () => {
  it('clears the startup overlay after hydration', () => {
    const state = buildInitialAppShellState();

    const next = appShellReducer(state, { type: 'clear-startup-overlay' });

    expect(next.overlay).toEqual({ type: 'none' });
  });

  it('opens search from the current root and closes the active overlay', () => {
    const state: AppShellState = {
      route: { type: 'root', root: 'deck' },
      overlay: { type: 'import-sheet' }
    };

    const next = appShellReducer(state, { type: 'open-search' });

    expect(next.route).toEqual({ type: 'search', root: 'deck', query: '' });
    expect(next.overlay).toEqual({ type: 'none' });
  });

  it('returns staging flows back to search when the return target is search', () => {
    const state: AppShellState = {
      route: {
        type: 'staging',
        root: 'deck',
        draft: buildDraft(),
        mode: 'create',
        editingRecipeId: null,
        returnTo: { type: 'search', query: 'curry' }
      },
      overlay: { type: 'none' }
    };

    const next = appShellReducer(state, { type: 'close-route' });

    expect(next.route).toEqual({ type: 'search', root: 'deck', query: 'curry' });
  });

  it('shows a parsing overlay and only hides that specific status overlay', () => {
    const state: AppShellState = {
      route: { type: 'root', root: 'deck' },
      overlay: { type: 'none' }
    };

    const parsing = appShellReducer(state, { type: 'show-parsing-overlay' });
    const cleared = appShellReducer(parsing, { type: 'hide-parsing-overlay' });

    expect(parsing.overlay).toEqual({
      type: 'status',
      kind: 'recipe-parsing',
      title: 'Parsing recipe...'
    });
    expect(cleared.overlay).toEqual({ type: 'none' });
  });

  it('opens a recipe route with a stable fallback recipe snapshot', () => {
    const recipe = buildRecipe();
    const state: AppShellState = {
      route: { type: 'root', root: 'deck' },
      overlay: { type: 'import-sheet' }
    };

    const next = appShellReducer(state, { type: 'open-recipe', recipe });

    expect(next.route).toEqual({
      type: 'recipe',
      root: 'deck',
      recipeId: recipe.id,
      fallbackRecipe: recipe
    });
    expect(next.overlay).toEqual({ type: 'none' });
  });

  it('stores actionable error overlay metadata', () => {
    const state: AppShellState = {
      route: { type: 'root', root: 'deck' },
      overlay: { type: 'none' }
    };

    const next = appShellReducer(state, {
      type: 'show-error-overlay',
      title: 'Import failed',
      message: 'Timed out',
      actions: [
        { id: 'retry-import', label: 'Retry' },
        { id: 'close', label: 'Close', appearance: 'ghost' }
      ]
    });

    expect(next.overlay).toEqual({
      type: 'status',
      kind: 'error',
      title: 'Import failed',
      message: 'Timed out',
      actions: [
        { id: 'retry-import', label: 'Retry' },
        { id: 'close', label: 'Close', appearance: 'ghost' }
      ]
    });
  });
});
