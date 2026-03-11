import { create } from 'zustand';
import { loadRecipes, loadRecipeViewMode, removeRecipeFromDB, saveRecipe, saveRecipeViewMode } from '../db/forkyeahDb';
import type { Recipe, RecipeViewMode } from '../types/models';
import { createId } from '../types/models';
import { normalizeRecipe } from '../utils/recipes';

export interface RecipeInput {
  title: string;
  imageUrl?: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
  prepTime: string;
  cookTime: string;
  notes: string;
  lastCooked: number | null;
}

interface RecipeState {
  recipes: Recipe[];
  activeRecipeId: string | null;
  viewMode: RecipeViewMode;
  showDeck: boolean;
  hydrated: boolean;
  deckOrder: string[];
  hydrate: () => Promise<void>;
  createRecipe: (input: RecipeInput) => string;
  updateRecipe: (recipeId: string, input: RecipeInput) => void;
  deleteRecipe: (recipeId: string) => void;
  setActiveRecipe: (recipeId: string) => void;
  moveActiveRecipeBy: (offset: 1 | -1) => void;
  openDeck: () => void;
  closeDeck: () => void;
  setViewMode: (mode: RecipeViewMode) => void;
}

const shuffleIds = (ids: string[]): string[] => {
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const buildRecipe = (input: RecipeInput, overrides?: Partial<Recipe>): Recipe => {
  return normalizeRecipe({
    id: overrides?.id ?? createId(),
    title: input.title.trim() || 'Untitled recipe',
    imageUrl: input.imageUrl?.trim() || '',
    ingredients: input.ingredients,
    steps: input.steps,
    tags: input.tags,
    prepTime: input.prepTime,
    cookTime: input.cookTime,
    notes: input.notes,
    lastCooked: input.lastCooked,
    createdAt: overrides?.createdAt ?? Date.now()
  });
};

export const useRecipeStore = create<RecipeState>((set) => ({
  recipes: [],
  activeRecipeId: null,
  viewMode: 'scroll',
  showDeck: true,
  hydrated: false,
  deckOrder: [],

  hydrate: async () => {
    const [recipes, viewMode] = await Promise.all([loadRecipes(), loadRecipeViewMode()]);
    const shuffledOrder = shuffleIds(recipes.map((recipe) => recipe.id));
    set((state) => ({
      recipes,
      deckOrder: shuffledOrder,
      activeRecipeId: state.activeRecipeId ?? shuffledOrder[0] ?? null,
      viewMode: viewMode ?? state.viewMode,
      showDeck: recipes.length > 0,
      hydrated: true
    }));
  },

  createRecipe: (input) => {
    const recipe = buildRecipe(input);

    set((state) => ({
      recipes: [...state.recipes, recipe].sort(
        (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)
      ),
      deckOrder: [recipe.id, ...state.deckOrder.filter((id) => id !== recipe.id)],
      activeRecipeId: recipe.id,
      showDeck: true
    }));

    void saveRecipe(recipe);

    return recipe.id;
  },

  updateRecipe: (recipeId, input) => {
    let updatedRecipe: Recipe | null = null;

    set((state) => ({
      recipes: state.recipes.map((recipe) => {
        if (recipe.id !== recipeId) {
          return recipe;
        }

        updatedRecipe = buildRecipe(input, { id: recipe.id, createdAt: recipe.createdAt });
        return updatedRecipe;
      })
    }));

    if (updatedRecipe) {
      void saveRecipe(updatedRecipe);
    }
  },

  deleteRecipe: (recipeId) => {
    set((state) => {
      const recipes = state.recipes.filter((recipe) => recipe.id !== recipeId);
      const deckOrder = state.deckOrder.filter((id) => id !== recipeId);
      const activeRecipeId =
        state.activeRecipeId === recipeId ? (deckOrder[0] ?? null) : state.activeRecipeId;

      return {
        recipes,
        activeRecipeId,
        deckOrder,
        showDeck: recipes.length > 0
      };
    });

    void removeRecipeFromDB(recipeId);
  },

  setActiveRecipe: (recipeId) => {
    set({ activeRecipeId: recipeId });
  },

  moveActiveRecipeBy: (offset) => {
    set((state) => {
      if (state.deckOrder.length < 2) {
        return state;
      }

      const currentIndex = state.deckOrder.findIndex((id) => id === state.activeRecipeId);
      const sourceIndex = currentIndex >= 0 ? currentIndex : 0;
      const nextIndex = (sourceIndex + offset + state.deckOrder.length) % state.deckOrder.length;

      return {
        ...state,
        activeRecipeId: state.deckOrder[nextIndex]
      };
    });
  },

  openDeck: () => {
    set({ showDeck: true });
  },

  closeDeck: () => {
    set({ showDeck: false });
  },

  setViewMode: (mode) => {
    set({ viewMode: mode });
    void saveRecipeViewMode(mode);
  }
}));

export const selectActiveRecipe = (state: RecipeState): Recipe | null => {
  return state.recipes.find((recipe) => recipe.id === state.activeRecipeId) ?? null;
};
