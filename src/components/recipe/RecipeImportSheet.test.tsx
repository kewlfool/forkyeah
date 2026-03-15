import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeImportSheet } from './RecipeImportSheet';

describe('RecipeImportSheet', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('uses Create for manual drafts when the URL field is empty', () => {
    const onCreateManual = vi.fn();
    const onContinue = vi.fn();

    render(
      <RecipeImportSheet
        open
        onClose={vi.fn()}
        onContinue={onContinue}
        onCreateManual={onCreateManual}
        onOpenSearch={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onCreateManual).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it('uses Create for URL imports when the field has a link', () => {
    const onCreateManual = vi.fn();
    const onContinue = vi.fn();

    render(
      <RecipeImportSheet
        open
        onClose={vi.fn()}
        onContinue={onContinue}
        onCreateManual={onCreateManual}
        onOpenSearch={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Paste a recipe URL'), {
      target: { value: '  https://example.com/recipe  ' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    expect(onContinue).toHaveBeenCalledWith({ url: 'https://example.com/recipe' });
    expect(onCreateManual).not.toHaveBeenCalled();
  });
});
