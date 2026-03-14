import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecipePeekSheet } from './RecipePeekSheet';

afterEach(() => {
  cleanup();
});

describe('RecipePeekSheet', () => {
  it('toggles cook-mode ingredient items on swipe right', () => {
    const onToggleIngredientDone = vi.fn();

    render(
      <RecipePeekSheet
        panel="ingredients"
        ingredientItems={['Salt']}
        ingredientDone={[false]}
        enableIngredientToggle
        notes=""
        nutrientItems={[]}
        timerMinutes={10}
        timerEndsAt={null}
        remainingMinutes={0}
        remainingDisplaySeconds={0}
        timerProgress={0}
        onClose={vi.fn()}
        onToggleIngredientDone={onToggleIngredientDone}
        onTimerMinutesChange={vi.fn()}
        onStartTimer={vi.fn()}
        onStopTimer={vi.fn()}
      />
    );

    const item = screen.getByText('Salt');
    fireEvent.touchStart(item, { touches: [{ clientX: 40, clientY: 40 }] });
    fireEvent.touchMove(item, { touches: [{ clientX: 108, clientY: 42 }] });
    fireEvent.touchEnd(item);

    expect(onToggleIngredientDone).toHaveBeenCalledWith(0);
  });
});
