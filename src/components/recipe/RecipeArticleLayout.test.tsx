import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '../../types/models';
import { RecipeArticleLayout } from './RecipeArticleLayout';

const buildRecipe = (overrides?: Partial<Recipe>): Recipe => ({
  id: 'recipe-1',
  title: 'Test recipe',
  description:
    'Very long description text that should overflow the clamped area when rendered inside the recipe header for testing.',
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

describe('RecipeArticleLayout', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('recipe-description')) {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: this.parentElement === document.body ? 120 : 60,
          right: 300,
          width: 300,
          height: this.parentElement === document.body ? 120 : 60,
          toJSON: () => ({})
        } as DOMRect;
      }

      return {
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        toJSON: () => ({})
      } as DOMRect;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the three-column timing row and updates last cooked from the shared action', () => {
    const onUpdateLastCooked = vi.fn();

    render(
      <RecipeArticleLayout
        recipe={buildRecipe()}
        lastCookedValue="Today"
        onUpdateLastCooked={onUpdateLastCooked}
        ingredientsContent={<p>Ingredients</p>}
        stepsContent={<p>Steps</p>}
      />
    );

    expect(screen.getByText('Prep time')).toBeInTheDocument();
    expect(screen.getByText('Cook time')).toBeInTheDocument();
    expect(screen.getByText('Last cooked')).toBeInTheDocument();
    expect(screen.getByText('5m')).toBeInTheDocument();
    expect(screen.getByText('20m')).toBeInTheDocument();
    expect(screen.getByText('Today')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Update last cooked date' }));

    expect(onUpdateLastCooked).toHaveBeenCalledTimes(1);
  });

  it('shows an expand control when the description exceeds four lines', async () => {
    render(
      <RecipeArticleLayout
        recipe={buildRecipe()}
        lastCookedValue="Never"
        onUpdateLastCooked={vi.fn()}
        ingredientsContent={<p>Ingredients</p>}
        stepsContent={<p>Steps</p>}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Show more' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));

    expect(screen.getByRole('button', { name: 'Show less' })).toBeInTheDocument();
  });
});
