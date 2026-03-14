import type { Recipe } from '../types/models';

const shuffleIds = (ids: string[], random: () => number = Math.random): string[] => {
  const next = [...ids];

  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }

  return next;
};

export const reconcileDeckOrder = (
  currentOrder: string[],
  recipes: Recipe[],
  random: () => number = Math.random
): string[] => {
  if (!recipes.length) {
    return [];
  }

  const recipeIds = recipes.map((recipe) => recipe.id);
  if (!currentOrder.length) {
    return shuffleIds(recipeIds, random);
  }

  const availableIds = new Set(recipeIds);
  const retainedIds = currentOrder.filter((recipeId) => availableIds.has(recipeId));
  const retainedIdSet = new Set(retainedIds);
  const addedIds = recipeIds.filter((recipeId) => !retainedIdSet.has(recipeId));

  if (!addedIds.length && retainedIds.length === recipeIds.length) {
    return retainedIds;
  }

  return [...shuffleIds(addedIds, random), ...retainedIds];
};

export const orderRecipesByIds = (recipes: Recipe[], recipeIds: string[]): Recipe[] => {
  if (!recipes.length || !recipeIds.length) {
    return [];
  }

  const recipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]));

  return recipeIds.flatMap((recipeId) => {
    const recipe = recipesById.get(recipeId);
    return recipe ? [recipe] : [];
  });
};
