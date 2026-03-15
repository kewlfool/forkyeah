import { describe, expect, it } from 'vitest';
import type { Recipe } from '../types/models';
import { orderRecipesByIds, reconcileDeckOrder } from './deckOrdering';

const buildRecipe = (id: string): Recipe => ({
  id,
  title: id,
  description: '',
  author: '',
  source: '',
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
  createdAt: 1
});

describe('deckOrdering', () => {
  it('shuffles the initial recipe order on first load', () => {
    const recipes = [buildRecipe('a'), buildRecipe('b'), buildRecipe('c')];
    const randomValues = [0.1, 0.6];
    const next = reconcileDeckOrder([], recipes, () => randomValues.shift() ?? 0);

    expect(next).toEqual(['c', 'b', 'a']);
  });

  it('preserves the current order for retained recipes and prepends new ids', () => {
    const recipes = [buildRecipe('a'), buildRecipe('b'), buildRecipe('c'), buildRecipe('d')];
    const randomValues = [0.4];
    const next = reconcileDeckOrder(['c', 'a'], recipes, () => randomValues.shift() ?? 0);

    expect(next).toEqual(['d', 'b', 'c', 'a']);
  });

  it('orders recipe objects by the reconciled ids', () => {
    const recipes = [buildRecipe('a'), buildRecipe('b'), buildRecipe('c')];

    expect(orderRecipesByIds(recipes, ['c', 'a'])).toEqual([recipes[2], recipes[0]]);
  });
});
