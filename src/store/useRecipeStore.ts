import { create } from 'zustand';
import { loadRecipes, removeRecipeFromDB, saveRecipe } from '../db/forkyeahDb';
import type { Recipe } from '../types/models';
import { createId } from '../types/models';
import { normalizeRecipe } from '../utils/recipes';

export interface RecipeInput {
  title: string;
  description: string;
  author: string;
  source: string;
  imageUrl?: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
  categories: string[];
  cuisines: string[];
  nutrients: string[];
  prepTime: string;
  cookTime: string;
  notes: string;
  lastCooked: number | null;
}

interface RecipeState {
  recipes: Recipe[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  createRecipe: (input: RecipeInput) => string;
  updateRecipe: (recipeId: string, input: RecipeInput) => void;
  deleteRecipe: (recipeId: string) => void;
}

const sortRecipes = (recipes: Recipe[]): Recipe[] => {
  return [...recipes].sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
};

const buildRecipe = (input: RecipeInput, overrides?: Partial<Recipe>): Recipe => {
  return normalizeRecipe({
    id: overrides?.id ?? createId(),
    title: input.title.trim() || 'Untitled recipe',
    description: input.description?.trim() ?? '',
    author: input.author?.trim() ?? '',
    source: input.source?.trim() ?? '',
    imageUrl: input.imageUrl?.trim() || '',
    ingredients: input.ingredients,
    steps: input.steps,
    tags: input.tags,
    categories: input.categories,
    cuisines: input.cuisines,
    nutrients: input.nutrients,
    prepTime: input.prepTime,
    cookTime: input.cookTime,
    notes: input.notes,
    lastCooked: input.lastCooked,
    createdAt: overrides?.createdAt ?? Date.now()
  });
};

export const useRecipeStore = create<RecipeState>((set) => ({
  recipes: [],
  hydrated: false,

  hydrate: async () => {
    const recipes = sortRecipes(await loadRecipes());
    set({
      recipes,
      hydrated: true
    });
  },

  createRecipe: (input) => {
    const recipe = buildRecipe(input);

    set((state) => ({
      recipes: sortRecipes([...state.recipes, recipe])
    }));

    void saveRecipe(recipe);

    return recipe.id;
  },

  updateRecipe: (recipeId, input) => {
    let updatedRecipe: Recipe | null = null;

    set((state) => ({
      recipes: sortRecipes(
        state.recipes.map((recipe) => {
          if (recipe.id !== recipeId) {
            return recipe;
          }

          updatedRecipe = buildRecipe(input, { id: recipe.id, createdAt: recipe.createdAt });
          return updatedRecipe;
        })
      )
    }));

    if (updatedRecipe) {
      void saveRecipe(updatedRecipe);
    }
  },

  deleteRecipe: (recipeId) => {
    set((state) => ({
      recipes: state.recipes.filter((recipe) => recipe.id !== recipeId)
    }));

    void removeRecipeFromDB(recipeId);
  }
}));
