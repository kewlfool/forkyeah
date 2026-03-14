import { AnimatePresence } from 'framer-motion';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  appShellReducer,
  buildInitialAppShellState,
  type AppOverlay
} from './app/appShellState';
import { AppStatusOverlay } from './components/common/AppStatusOverlay';
import { ImagePickerController } from './components/common/ImagePickerController';
import { DeckScene } from './components/recipe/DeckScene';
import { RecipeEmptyState } from './components/recipe/RecipeEmptyState';
import { RecipeImportSheet, type RecipeImportPayload } from './components/recipe/RecipeImportSheet';
import { RecipeSearchScreen } from './components/recipe/RecipeSearchScreen';
import { RecipeScreen } from './components/recipe/RecipeScreen';
import {
  RecipeStagingScreen,
  type RecipeStagingDraft
} from './components/recipe/RecipeStagingScreen';
import { useWakeLock } from './hooks/useWakeLock';
import { useHomeStore } from './store/useHomeStore';
import { useRecipeStore, type RecipeInput } from './store/useRecipeStore';
import type { Recipe } from './types/models';
import { orderRecipesByIds, reconcileDeckOrder } from './utils/deckOrdering';
import { compressImageFile } from './utils/imageCompression';
import {
  parseRecipeImport,
  type ParsedRecipeDraft,
  type RecipeImportInput,
  type RecipeImportResult
} from './utils/recipeParsing';

interface ImportAttempt {
  source: 'sheet' | 'search';
  input: RecipeImportInput;
  searchQuery?: string;
}

const buildStagingDraft = (parsed: ParsedRecipeDraft): RecipeStagingDraft => ({
  title: parsed.title,
  description: parsed.description,
  imageUrl: parsed.imageUrl,
  ingredients: parsed.ingredients,
  steps: parsed.steps,
  tags: parsed.tags,
  categories: parsed.categories,
  cuisines: parsed.cuisines,
  nutrients: parsed.nutrients,
  prepTime: parsed.prepTime,
  cookTime: parsed.cookTime,
  notes: parsed.notes,
  lastCooked: null,
  sourceLabel: parsed.sourceLabel,
  rawContent: parsed.rawContent,
  importWarning: parsed.importWarning
});

const buildEditingDraft = (recipe: Recipe): RecipeStagingDraft => ({
  title: recipe.title ?? '',
  description: recipe.description ?? '',
  imageUrl: recipe.imageUrl ?? '',
  ingredients: recipe.ingredients ?? [],
  steps: recipe.steps ?? [],
  tags: recipe.tags ?? [],
  categories: recipe.categories ?? [],
  cuisines: recipe.cuisines ?? [],
  nutrients: recipe.nutrients ?? [],
  prepTime: recipe.prepTime ?? '',
  cookTime: recipe.cookTime ?? '',
  notes: recipe.notes ?? '',
  lastCooked: recipe.lastCooked ?? null,
  sourceLabel: 'Saved recipe',
  rawContent: recipe.notes ?? ''
});

const buildManualDraft = (): RecipeStagingDraft => ({
  title: '',
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
  sourceLabel: 'Manual',
  rawContent: ''
});

const STARTUP_SPLASH_MIN_MS = 900;

const areRecipeIdArraysEqual = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((recipeId, index) => recipeId === right[index]);
};

const AppContent = (): JSX.Element => {
  const hydrateRecipes = useRecipeStore((state) => state.hydrate);
  const recipes = useRecipeStore((state) => state.recipes);
  const createRecipe = useRecipeStore((state) => state.createRecipe);
  const updateRecipe = useRecipeStore((state) => state.updateRecipe);
  const deleteRecipe = useRecipeStore((state) => state.deleteRecipe);
  const recipeHydrated = useRecipeStore((state) => state.hydrated);

  const themeMode = useHomeStore((state) => state.themeMode);
  const deckMode = useHomeStore((state) => state.deckMode);
  const setDeckMode = useHomeStore((state) => state.setDeckMode);
  const hydrateHome = useHomeStore((state) => state.hydrate);
  const homeHydrated = useHomeStore((state) => state.hydrated);

  const [deckOrderIds, setDeckOrderIds] = useState<string[]>([]);
  const [deckSelectedRecipeId, setDeckSelectedRecipeId] = useState<string | null>(null);
  const [deckEditingRecipeId, setDeckEditingRecipeId] = useState<string | null>(null);
  const [appShellState, dispatchAppShell] = useReducer(appShellReducer, undefined, buildInitialAppShellState);
  const appShellRef = useRef(appShellState);
  const initialDeckOrderRef = useRef<string[] | null>(null);
  const mountedRef = useRef(true);
  const splashStartedAtRef = useRef(performance.now());
  const startupOverlayTimerRef = useRef<number | null>(null);
  const parseSessionRef = useRef(0);
  const lastImportAttemptRef = useRef<ImportAttempt | null>(null);
  const handleExitDeckEditMode = useCallback(() => {
    setDeckEditingRecipeId(null);
  }, []);

  useWakeLock();

  useEffect(() => {
    appShellRef.current = appShellState;
  }, [appShellState]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (startupOverlayTimerRef.current !== null) {
        window.clearTimeout(startupOverlayTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    void Promise.all([hydrateRecipes(), hydrateHome()]);
  }, [hydrateHome, hydrateRecipes]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  const resolvedDeckOrderIds = useMemo(() => {
    if (!recipes.length) {
      initialDeckOrderRef.current = null;
      return [];
    }

    if (deckOrderIds.length) {
      return reconcileDeckOrder(deckOrderIds, recipes);
    }

    if (!initialDeckOrderRef.current) {
      initialDeckOrderRef.current = reconcileDeckOrder([], recipes);
    }

    return initialDeckOrderRef.current;
  }, [deckOrderIds, recipes]);

  useEffect(() => {
    if (!recipes.length) {
      setDeckOrderIds([]);
      return;
    }

    setDeckOrderIds((current) => {
      const next = current.length ? reconcileDeckOrder(current, recipes) : resolvedDeckOrderIds;
      return areRecipeIdArraysEqual(current, next) ? current : next;
    });
  }, [recipes, resolvedDeckOrderIds]);

  const deckRecipes = useMemo(() => orderRecipesByIds(recipes, resolvedDeckOrderIds), [recipes, resolvedDeckOrderIds]);

  useEffect(() => {
    if (!deckRecipes.length) {
      setDeckSelectedRecipeId(null);
      setDeckEditingRecipeId(null);
      return;
    }

    setDeckSelectedRecipeId((current) =>
      current && deckRecipes.some((recipe) => recipe.id === current) ? current : deckRecipes[0].id
    );
    setDeckEditingRecipeId((current) =>
      current && deckRecipes.some((recipe) => recipe.id === current) ? current : null
    );
  }, [deckRecipes]);

  useEffect(() => {
    if (!recipeHydrated || !homeHydrated) {
      return;
    }

    dispatchAppShell({ type: 'sync-root', hasRecipes: recipes.length > 0 });
  }, [homeHydrated, recipeHydrated, recipes.length]);

  useEffect(() => {
    if (!recipeHydrated || !homeHydrated) {
      return;
    }

    const elapsedMs = performance.now() - splashStartedAtRef.current;
    const remainingMs = Math.max(0, STARTUP_SPLASH_MIN_MS - elapsedMs);

    if (startupOverlayTimerRef.current !== null) {
      window.clearTimeout(startupOverlayTimerRef.current);
    }

    startupOverlayTimerRef.current = window.setTimeout(() => {
      dispatchAppShell({ type: 'clear-startup-overlay' });
      startupOverlayTimerRef.current = null;
    }, remainingMs);

    return () => {
      if (startupOverlayTimerRef.current !== null) {
        window.clearTimeout(startupOverlayTimerRef.current);
        startupOverlayTimerRef.current = null;
      }
    };
  }, [homeHydrated, recipeHydrated]);

  useEffect(() => {
    const route = appShellState.route;
    if (route.type === 'recipe' && !recipes.some((recipe) => recipe.id === route.recipeId)) {
      dispatchAppShell({ type: 'reset-to-root', hasRecipes: recipes.length > 0 });
    }
  }, [appShellState.route, recipes]);

  const currentRoute = appShellState.route;
  const openRecipe =
    currentRoute.type === 'recipe'
      ? recipes.find((recipe) => recipe.id === currentRoute.recipeId) ?? currentRoute.fallbackRecipe
      : null;

  const openImport = () => {
    setDeckEditingRecipeId(null);
    dispatchAppShell({ type: 'open-import' });
  };

  const handleImportResult = useCallback(
    (attempt: ImportAttempt, result: RecipeImportResult) => {
      if (result.kind === 'draft') {
        const returnTo =
          attempt.source === 'search'
            ? { type: 'search' as const, query: attempt.searchQuery ?? '' }
            : { type: 'root' as const };

        dispatchAppShell({
          type: 'open-staging',
          draft: buildStagingDraft(result.draft),
          mode: 'create',
          editingRecipeId: null,
          returnTo
        });
        return;
      }

      const actions: NonNullable<Extract<AppOverlay, { type: 'status' }>['actions']> = [];
      if (result.error.retryable) {
        actions.push({ id: 'retry-import', label: 'Retry' });
      }
      if (!result.error.retryable && attempt.source === 'sheet') {
        actions.push({ id: 'create-manual', label: 'Create manually' });
      }
      actions.push({
        id: 'close',
        label: 'Close',
        appearance: actions.length ? 'ghost' : 'solid'
      });

      dispatchAppShell({
        type: 'show-error-overlay',
        title: result.error.title,
        message: result.error.message,
        actions
      });
    },
    []
  );

  const runImportAttempt = useCallback(
    async (attempt: ImportAttempt) => {
      const parseSession = parseSessionRef.current + 1;
      parseSessionRef.current = parseSession;
      lastImportAttemptRef.current = attempt;
      dispatchAppShell({ type: 'show-parsing-overlay' });

      try {
        const result = await parseRecipeImport(attempt.input);
        if (!mountedRef.current || parseSessionRef.current !== parseSession) {
          return;
        }

        if (attempt.source === 'search') {
          const latestRoute = appShellRef.current.route;
          if (latestRoute.type !== 'search') {
            return;
          }
          attempt.searchQuery = latestRoute.query;
        }

        handleImportResult(attempt, result);
      } finally {
        if (mountedRef.current && parseSessionRef.current === parseSession) {
          dispatchAppShell({ type: 'hide-parsing-overlay' });
        }
      }
    },
    [handleImportResult]
  );

  const handleImportContinue = async (payload: RecipeImportPayload) => {
    const hasImportSource = Boolean(payload.url.trim() || payload.rawText.trim() || payload.file);
    if (!hasImportSource) {
      dispatchAppShell({
        type: 'show-error-overlay',
        title: 'Invalid import',
        message: 'Add a recipe link, PDF, or text before continuing.',
        actions: [{ id: 'close', label: 'Close' }]
      });
      return;
    }

    await runImportAttempt({
      source: 'sheet',
      input: {
        url: payload.url,
        rawText: payload.rawText,
        file: payload.file,
        fileName: payload.fileName
      }
    });
  };

  const handleAccept = (input: RecipeInput) => {
    if (currentRoute.type !== 'staging') {
      return;
    }

    let nextRecipeId: string;
    if (currentRoute.editingRecipeId) {
      updateRecipe(currentRoute.editingRecipeId, input);
      nextRecipeId = currentRoute.editingRecipeId;
    } else {
      nextRecipeId = createRecipe(input);
    }

    setDeckSelectedRecipeId(nextRecipeId);
    setDeckEditingRecipeId(null);
    dispatchAppShell({ type: 'reset-to-root', hasRecipes: true });
  };

  const handleDeleteDraft = () => {
    dispatchAppShell({ type: 'close-route' });
  };

  const handleEditRecipe = (recipe: Recipe) => {
    setDeckEditingRecipeId(null);

    dispatchAppShell({
      type: 'open-staging',
      draft: buildEditingDraft(recipe),
      mode: 'edit',
      editingRecipeId: recipe.id,
      returnTo: { type: 'root' }
    });
  };

  const handleUpdateImage = (recipeId: string, imageUrl: string) => {
    const recipe = recipes.find((item) => item.id === recipeId);
    if (!recipe) {
      return;
    }

    updateRecipe(recipeId, {
      title: recipe.title,
      description: recipe.description,
      imageUrl,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      tags: recipe.tags,
      categories: recipe.categories,
      cuisines: recipe.cuisines,
      nutrients: recipe.nutrients,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      notes: recipe.notes,
      lastCooked: recipe.lastCooked
    });
  };

  const handleRequestImage = (recipeId: string) => {
    dispatchAppShell({ type: 'request-image', recipeId });
  };

  const handleImagePick = async (recipeId: string, file: File) => {
    try {
      const dataUrl = await compressImageFile(file);
      if (dataUrl) {
        handleUpdateImage(recipeId, dataUrl);
      }
    } catch {
      // ignore image processing errors
    }
  };

  const handleOpenRecipe = (recipe: Recipe) => {
    setDeckSelectedRecipeId(recipe.id);
    setDeckEditingRecipeId(null);
    dispatchAppShell({ type: 'open-recipe', recipe });
  };

  const handleSearchImport = async (url: string): Promise<void> => {
    const latestRoute = appShellRef.current.route;
    await runImportAttempt({
      source: 'search',
      input: { url },
      searchQuery: latestRoute.type === 'search' ? latestRoute.query : ''
    });
  };

  const handleDeleteRecipe = (recipeId: string) => {
    const hasRecipesAfterDelete = recipes.some((recipe) => recipe.id !== recipeId);
    deleteRecipe(recipeId);

    if (deckEditingRecipeId === recipeId) {
      setDeckEditingRecipeId(null);
    }

    if (currentRoute.type === 'recipe' && currentRoute.recipeId === recipeId) {
      dispatchAppShell({ type: 'reset-to-root', hasRecipes: hasRecipesAfterDelete });
    }
  };

  const screen = (() => {
    switch (currentRoute.type) {
      case 'staging':
        return (
          <RecipeStagingScreen
            key={`staging-${currentRoute.mode}-${currentRoute.editingRecipeId ?? 'new'}`}
            draft={currentRoute.draft}
            mode={currentRoute.mode}
            startEditing={
              currentRoute.mode === 'edit' ||
              (currentRoute.mode === 'create' && currentRoute.draft.sourceLabel === 'Manual')
            }
            onAccept={handleAccept}
            onDelete={handleDeleteDraft}
          />
        );

      case 'search':
        return (
          <RecipeSearchScreen
            key="search"
            query={currentRoute.query}
            onQueryChange={(value) => dispatchAppShell({ type: 'set-search-query', query: value })}
            onClose={() => dispatchAppShell({ type: 'close-route' })}
            onImportUrl={handleSearchImport}
          />
        );

      case 'recipe':
        return openRecipe ? (
          <RecipeScreen
            key={openRecipe.id}
            recipe={openRecipe}
            onClose={() => dispatchAppShell({ type: 'close-route' })}
          />
        ) : (
          <RecipeEmptyState key="recipe-missing" onImport={openImport} />
        );

      case 'root':
      default:
        return currentRoute.root === 'deck' && deckRecipes.length ? (
          <DeckScene
            key="deck"
            mode={deckMode}
            recipes={deckRecipes}
            selectedRecipeId={deckSelectedRecipeId}
            editingRecipeId={deckEditingRecipeId}
            onModeChange={setDeckMode}
            onSelectRecipe={setDeckSelectedRecipeId}
            onOpenRecipe={handleOpenRecipe}
            onEnterEditMode={setDeckEditingRecipeId}
            onExitEditMode={handleExitDeckEditMode}
            onEditRecipe={handleEditRecipe}
            onDeleteRecipe={handleDeleteRecipe}
            onRequestImage={handleRequestImage}
            onImport={openImport}
            showImportButton={appShellState.overlay.type !== 'import-sheet'}
          />
        ) : (
          <RecipeEmptyState key="empty" onImport={openImport} />
        );
    }
  })();

  return (
    <main className="app-shell">
      <AnimatePresence mode="wait" initial={false}>
        {screen}
      </AnimatePresence>

      <RecipeImportSheet
        open={appShellState.overlay.type === 'import-sheet'}
        onClose={() => dispatchAppShell({ type: 'close-overlay' })}
        onContinue={handleImportContinue}
        onOpenSearch={() => dispatchAppShell({ type: 'open-search' })}
        onCreateManual={() => {
          setDeckEditingRecipeId(null);

          dispatchAppShell({
            type: 'open-staging',
            draft: buildManualDraft(),
            mode: 'create',
            editingRecipeId: null,
            returnTo: { type: 'root' }
          });
        }}
      />

      <AppStatusOverlay
        open={appShellState.overlay.type === 'status'}
        kind={appShellState.overlay.type === 'status' ? appShellState.overlay.kind : undefined}
        tone={appShellState.overlay.type === 'status' && appShellState.overlay.kind === 'error' ? 'error' : 'loading'}
        title={appShellState.overlay.type === 'status' ? appShellState.overlay.title : ''}
        message={appShellState.overlay.type === 'status' ? appShellState.overlay.message : undefined}
        actions={appShellState.overlay.type === 'status' ? appShellState.overlay.actions : undefined}
        onAction={(actionId) => {
          if (actionId === 'retry-import') {
            const lastAttempt = lastImportAttemptRef.current;
            if (lastAttempt) {
              void runImportAttempt({ ...lastAttempt });
            }
            return;
          }

          if (actionId === 'create-manual') {
            setDeckEditingRecipeId(null);
            dispatchAppShell({
              type: 'open-staging',
              draft: buildManualDraft(),
              mode: 'create',
              editingRecipeId: null,
              returnTo: { type: 'root' }
            });
            return;
          }

          dispatchAppShell({ type: 'close-overlay' });
        }}
      />

      <ImagePickerController
        requestRecipeId={
          appShellState.overlay.type === 'image-picker' ? appShellState.overlay.recipeId : null
        }
        onPick={handleImagePick}
        onCancel={() => dispatchAppShell({ type: 'close-overlay' })}
      />
    </main>
  );
};

const App = (): JSX.Element => {
  return <AppContent />;
};

export default App;
