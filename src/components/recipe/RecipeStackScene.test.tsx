import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '../../types/models';
import { RecipeStackScene } from './RecipeStackScene';

const buildRecipe = (overrides?: Partial<Recipe>): Recipe => ({
  id: 'recipe-1',
  title: 'Test recipe',
  description: 'A recipe description',
  author: '',
  source: '',
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

  it('does not open the active recipe from the stack header', () => {
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

    fireEvent.click(screen.getByRole('heading', { name: 'Test recipe' }));

    expect(onOpenRecipe).not.toHaveBeenCalled();
  });

  it('shows prep and cook on the left of the stack metadata row', () => {
    const recipe = buildRecipe({ lastCooked: Date.now() });

    render(
      <RecipeStackScene
        recipes={[recipe]}
        selectedRecipeId={recipe.id}
        onSelectRecipe={vi.fn()}
        onOpenRecipe={vi.fn()}
      />
    );

    expect(screen.getByText('Prep 5m')).toBeInTheDocument();
    expect(screen.getByText('Cook 20m')).toBeInTheDocument();
    expect(screen.getAllByText(/Last cooked:/i).length).toBeGreaterThan(0);
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

  it('wraps around to the first recipe when swiping left from the last one', () => {
    vi.useFakeTimers();

    const firstRecipe = buildRecipe({ id: 'recipe-1', title: 'First recipe' });
    const secondRecipe = buildRecipe({ id: 'recipe-2', title: 'Second recipe' });
    const onSelectRecipe = vi.fn();
    const { container } = render(
      <RecipeStackScene
        recipes={[firstRecipe, secondRecipe]}
        selectedRecipeId={secondRecipe.id}
        onSelectRecipe={onSelectRecipe}
        onOpenRecipe={vi.fn()}
      />
    );

    const swipeZone = container.querySelector('.recipe-stack-gutter-right');
    expect(swipeZone).not.toBeNull();

    fireEvent.pointerDown(swipeZone!, { pointerId: 1, clientX: 260, clientY: 120 });
    fireEvent.pointerMove(swipeZone!, { pointerId: 1, clientX: 24, clientY: 120 });
    fireEvent.pointerUp(swipeZone!, { pointerId: 1, clientX: 24, clientY: 120 });
    vi.advanceTimersByTime(220);

    expect(onSelectRecipe).toHaveBeenCalledWith(firstRecipe.id);

    vi.useRealTimers();
  });
});
