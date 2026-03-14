import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '../../types/models';
import { RecipeStackScene } from './RecipeStackScene';

const buildRecipe = (overrides?: Partial<Recipe>): Recipe => ({
  id: 'recipe-1',
  title: 'Test recipe',
  description: 'A recipe description',
  imageUrl: '',
  ingredients: ['Salt'],
  steps: ['Cook'],
  tags: [],
  categories: [],
  cuisines: [],
  nutrients: [],
  prepTime: '5m',
  cookTime: '20m',
  notes: '',
  lastCooked: null,
  createdAt: Date.now(),
  ...overrides
});

afterEach(() => {
  cleanup();
});

describe('RecipeStackScene', () => {
  it('opens the active recipe from the sticky Let’s cook button', () => {
    const recipe = buildRecipe();
    const onOpenRecipe = vi.fn();

    render(
      <RecipeStackScene
        recipes={[recipe]}
        selectedRecipeId={recipe.id}
        onSelectRecipe={vi.fn()}
        onOpenRecipe={onOpenRecipe}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: "Let's cook" }));

    expect(onOpenRecipe).toHaveBeenCalledWith(recipe);
  });

  it('opens the active recipe from the hero/title open zone tap', () => {
    const recipe = buildRecipe();
    const onOpenRecipe = vi.fn();

    render(
      <RecipeStackScene
        recipes={[recipe]}
        selectedRecipeId={recipe.id}
        onSelectRecipe={vi.fn()}
        onOpenRecipe={onOpenRecipe}
      />
    );

    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Test recipe' }), {
      pointerId: 1,
      clientX: 40,
      clientY: 40
    });
    fireEvent.pointerUp(screen.getByRole('heading', { name: 'Test recipe' }), {
      pointerId: 1,
      clientX: 40,
      clientY: 40
    });
    fireEvent.click(screen.getByRole('heading', { name: 'Test recipe' }));

    expect(onOpenRecipe).toHaveBeenCalledWith(recipe);
  });

  it('does not open the recipe when tapping inside the ingredient body', () => {
    const recipe = buildRecipe();
    const onOpenRecipe = vi.fn();

    render(
      <RecipeStackScene
        recipes={[recipe]}
        selectedRecipeId={recipe.id}
        onSelectRecipe={vi.fn()}
        onOpenRecipe={onOpenRecipe}
      />
    );

    fireEvent.click(screen.getByText('Salt'));

    expect(onOpenRecipe).not.toHaveBeenCalled();
  });
});
