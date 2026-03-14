import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RecipeCookMode } from './RecipeCookMode';

afterEach(() => {
  cleanup();
});

describe('RecipeCookMode', () => {
  it('navigates forward on left swipe', () => {
    const onNextStep = vi.fn();

    render(
      <RecipeCookMode
        open
        steps={['Prep onions', 'Add tomatoes']}
        stepIndex={0}
        timerEndsAt={null}
        timerProgress={0}
        onPreviousStep={vi.fn()}
        onNextStep={onNextStep}
        onOpenIngredients={vi.fn()}
        onOpenTimer={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const swipeSurface = screen.getByText('Prep onions').closest('.cook-mode-step-shell');
    expect(swipeSurface).not.toBeNull();

    fireEvent.touchStart(swipeSurface!, {
      touches: [{ clientX: 220, clientY: 120 }]
    });
    fireEvent.touchMove(swipeSurface!, {
      touches: [{ clientX: 120, clientY: 126 }]
    });
    fireEvent.touchEnd(swipeSurface!);

    expect(onNextStep).toHaveBeenCalledTimes(1);
  });

  it('opens utility actions from the bottom buttons', () => {
    const onOpenIngredients = vi.fn();
    const onOpenTimer = vi.fn();
    const onClose = vi.fn();

    render(
      <RecipeCookMode
        open
        steps={['Prep onions']}
        stepIndex={0}
        timerEndsAt={null}
        timerProgress={0}
        onPreviousStep={vi.fn()}
        onNextStep={vi.fn()}
        onOpenIngredients={onOpenIngredients}
        onOpenTimer={onOpenTimer}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Open ingredients' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open timer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit cook mode' }));

    expect(onOpenIngredients).toHaveBeenCalledTimes(1);
    expect(onOpenTimer).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
