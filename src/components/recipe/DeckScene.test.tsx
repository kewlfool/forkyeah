import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '../../types/models';
import { DeckScene } from './DeckScene';

const buildRecipe = (): Recipe => ({
  id: 'recipe-1',
  title: 'Test recipe',
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
  createdAt: Date.now()
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
});
