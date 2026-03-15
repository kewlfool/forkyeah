import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '../../types/models';
import { DeckScene } from './DeckScene';

const buildRecipe = (overrides?: Partial<Recipe>): Recipe => ({
  id: 'recipe-1',
  title: 'Test recipe',
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
  createdAt: Date.now(),
  ...overrides
});

afterEach(() => {
  cleanup();
});

describe('DeckScene', () => {
  it('switches to the next renderer mode through the toggle button', () => {
    const onModeChange = vi.fn();
    const onExitEditMode = vi.fn();

    render(
      <DeckScene
        mode="list"
        recipes={[buildRecipe()]}
        selectedRecipeId="recipe-1"
        editingRecipeId={null}
        onModeChange={onModeChange}
        onSelectRecipe={vi.fn()}
        onOpenRecipe={vi.fn()}
        onEnterEditMode={vi.fn()}
        onExitEditMode={onExitEditMode}
        onEditRecipe={vi.fn()}
        onDeleteRecipe={vi.fn()}
        onRequestImage={vi.fn()}
        onImport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Switch to grid view'));

    expect(onModeChange).toHaveBeenCalledWith('grid');
  });

  it('cycles from grid mode to stack mode', () => {
    const onModeChange = vi.fn();

    render(
      <DeckScene
        mode="grid"
        recipes={[buildRecipe()]}
        selectedRecipeId="recipe-1"
        editingRecipeId={null}
        onModeChange={onModeChange}
        onSelectRecipe={vi.fn()}
        onOpenRecipe={vi.fn()}
        onEnterEditMode={vi.fn()}
        onExitEditMode={vi.fn()}
        onEditRecipe={vi.fn()}
        onDeleteRecipe={vi.fn()}
        onRequestImage={vi.fn()}
        onImport={vi.fn()}
      />
    );

    fireEvent.click(screen.getByLabelText('Switch to stack view'));

    expect(onModeChange).toHaveBeenCalledWith('stack');
  });

  it('exits edit mode when tapping outside the active deck item', () => {
    const onExitEditMode = vi.fn();

    render(
      <DeckScene
        mode="list"
        recipes={[buildRecipe()]}
        selectedRecipeId="recipe-1"
        editingRecipeId="recipe-1"
        onModeChange={vi.fn()}
        onSelectRecipe={vi.fn()}
        onOpenRecipe={vi.fn()}
        onEnterEditMode={vi.fn()}
        onExitEditMode={onExitEditMode}
        onEditRecipe={vi.fn()}
        onDeleteRecipe={vi.fn()}
        onRequestImage={vi.fn()}
        onImport={vi.fn()}
      />
    );

    onExitEditMode.mockClear();
    fireEvent.mouseDown(document.body);

    expect(onExitEditMode).toHaveBeenCalledTimes(1);
  });

  it('shows prep and cook metadata in grid mode instead of last cooked', () => {
    render(
      <DeckScene
        mode="grid"
        recipes={[buildRecipe({ prepTime: '5m', cookTime: '20m', lastCooked: Date.now() })]}
        selectedRecipeId="recipe-1"
        editingRecipeId={null}
        onModeChange={vi.fn()}
        onSelectRecipe={vi.fn()}
        onOpenRecipe={vi.fn()}
        onEnterEditMode={vi.fn()}
        onExitEditMode={vi.fn()}
        onEditRecipe={vi.fn()}
        onDeleteRecipe={vi.fn()}
        onRequestImage={vi.fn()}
        onImport={vi.fn()}
      />
    );

    expect(screen.getByText((_, element) => element?.textContent === 'Prep 5m')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Cook 20m')).toBeInTheDocument();
    expect(screen.queryByText(/Last cooked:/i)).not.toBeInTheDocument();
  });

  it('shows prep, cook, and last cooked together in list mode', () => {
    render(
      <DeckScene
        mode="list"
        recipes={[buildRecipe({ prepTime: '5m', cookTime: '20m', lastCooked: Date.now() })]}
        selectedRecipeId="recipe-1"
        editingRecipeId={null}
        onModeChange={vi.fn()}
        onSelectRecipe={vi.fn()}
        onOpenRecipe={vi.fn()}
        onEnterEditMode={vi.fn()}
        onExitEditMode={vi.fn()}
        onEditRecipe={vi.fn()}
        onDeleteRecipe={vi.fn()}
        onRequestImage={vi.fn()}
        onImport={vi.fn()}
      />
    );

    expect(screen.getByText((_, element) => element?.textContent === 'Prep 5m')).toBeInTheDocument();
    expect(screen.getByText((_, element) => element?.textContent === 'Cook 20m')).toBeInTheDocument();
    expect(screen.getByText(/Last cooked:/i)).toBeInTheDocument();
  });
});
