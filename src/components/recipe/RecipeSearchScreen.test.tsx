import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecipeSearchScreen } from './RecipeSearchScreen';
import { searchRecipes, type RecipeSearchResult } from '../../utils/recipeSearch';

vi.mock('../../utils/recipeSearch', () => ({
  searchRecipes: vi.fn()
}));

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
};

type ViewportListener = () => void;

const createDeferred = <T,>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });

  return { promise, resolve, reject };
};

describe('RecipeSearchScreen', () => {
  const mockedSearchRecipes = vi.mocked(searchRecipes);
  const viewportListeners: Record<'resize' | 'scroll', Set<ViewportListener>> = {
    resize: new Set(),
    scroll: new Set()
  };
  const visualViewport = {
    height: 620,
    offsetTop: 0,
    addEventListener: vi.fn((type: 'resize' | 'scroll', listener: ViewportListener) => {
      viewportListeners[type].add(listener);
    }),
    removeEventListener: vi.fn((type: 'resize' | 'scroll', listener: ViewportListener) => {
      viewportListeners[type].delete(listener);
    })
  };

  const emitViewport = (type: 'resize' | 'scroll') => {
    viewportListeners[type].forEach((listener) => listener());
  };

  beforeEach(() => {
    mockedSearchRecipes.mockReset();
    viewportListeners.resize.clear();
    viewportListeners.scroll.clear();
    visualViewport.height = 620;
    visualViewport.offsetTop = 0;

    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: visualViewport
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 820
    });

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('shows in-flight search status and the completed result summary', async () => {
    const deferred = createDeferred<RecipeSearchResult[]>();
    mockedSearchRecipes.mockReturnValueOnce(deferred.promise);

    const { container } = render(
      <RecipeSearchScreen query="" onQueryChange={vi.fn()} onClose={vi.fn()} onImportUrl={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText('Search recipes'), { target: { value: 'Pasta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByRole('button', { name: 'Searching...' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Searching for "Pasta"...');
    expect(container.querySelector('.search-dock')).toHaveClass('is-floating');

    deferred.resolve([{ title: 'Pasta', url: 'https://example.com/pasta' }]);

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('1 result for "Pasta".');
    });
  });

  it('tracks the iOS visual viewport inset for the bottom dock', async () => {
    const { container } = render(
      <RecipeSearchScreen query="" onQueryChange={vi.fn()} onClose={vi.fn()} onImportUrl={vi.fn()} />
    );

    const shell = container.querySelector('.search-shell') as HTMLElement;

    await waitFor(() => {
      expect(shell.style.getPropertyValue('--search-keyboard-offset')).toBe('200px');
    });

    visualViewport.height = 680;
    emitViewport('resize');

    await waitFor(() => {
      expect(shell.style.getPropertyValue('--search-keyboard-offset')).toBe('140px');
    });
  });
});
