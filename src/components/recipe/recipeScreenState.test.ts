import { describe, expect, it } from 'vitest';
import { createRecipeScreenState, recipeScreenReducer } from './recipeScreenState';

describe('recipeScreenState', () => {
  it('opens cook mode and closes transient recipe UI', () => {
    const startingState = {
      ...createRecipeScreenState(3, 4),
      peekPanel: 'timer' as const,
      ingredientRailIndex: 1,
      ingredientEditor: { index: 0, value: 'Salt' }
    };

    const next = recipeScreenReducer(startingState, { type: 'open-cook-mode' });

    expect(next.cookModeOpen).toBe(true);
    expect(next.peekPanel).toBeNull();
    expect(next.ingredientRailIndex).toBeNull();
    expect(next.ingredientEditor).toBeNull();
  });

  it('clamps the cook step index when the recipe loses steps', () => {
    const startingState = {
      ...createRecipeScreenState(0, 5),
      cookModeOpen: true,
      cookStepIndex: 4
    };

    const next = recipeScreenReducer(startingState, { type: 'sync-steps', count: 2 });

    expect(next.cookStepIndex).toBe(1);
    expect(next.cookModeOpen).toBe(true);
  });

  it('closes cook mode when a recipe has no steps left', () => {
    const startingState = {
      ...createRecipeScreenState(0, 1),
      cookModeOpen: true,
      cookStepIndex: 0
    };

    const next = recipeScreenReducer(startingState, { type: 'sync-steps', count: 0 });

    expect(next.cookModeOpen).toBe(false);
    expect(next.cookStepIndex).toBe(0);
  });

  it('resets ingredient and step progress when cooking is restarted', () => {
    const startingState = {
      ...createRecipeScreenState(2, 2),
      ingredientDone: [true, false],
      stepDone: [true, true],
      ingredientRailIndex: 1
    };

    const next = recipeScreenReducer(startingState, { type: 'reset-progress' });

    expect(next.ingredientDone).toEqual([false, false]);
    expect(next.stepDone).toEqual([false, false]);
    expect(next.ingredientRailIndex).toBeNull();
  });
});
