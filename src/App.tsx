import { AnimatePresence } from 'framer-motion';
import { useEffect, useReducer, useRef, useState, type ChangeEvent } from 'react';
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
import { compressImageFile } from './utils/imageCompression';
import { parseRecipeImport } from './utils/recipeParsing';

type RootScene = 'empty' | 'deck';

type RootRoute = {
  type: 'root';
  root: RootScene;
};

type SearchRoute = {
  type: 'search';
  root: RootScene;
  query: string;
};

type RecipeRoute = {
  type: 'recipe';
  root: RootScene;
  recipeId: string;
  fallbackRecipe: Recipe;
};

type StagingReturnTarget =
  | { type: 'root' }
  | {
      type: 'search';
      query: string;
    };

type StagingRoute = {
  type: 'staging';
  root: RootScene;
  draft: RecipeStagingDraft;
  mode: 'create' | 'edit';
  editingRecipeId: string | null;
  returnTo: StagingReturnTarget;
};

type AppRoute = RootRoute | SearchRoute | RecipeRoute | StagingRoute;

type AppOverlay =
  | { type: 'none' }
  | { type: 'import-sheet' }
  | {
      type: 'image-picker';
      recipeId: string;
    };

interface AppShellState {
  route: AppRoute;
  overlay: AppOverlay;
}

type AppShellAction =
  | { type: 'sync-root'; hasRecipes: boolean }
  | { type: 'open-import' }
  | { type: 'request-image'; recipeId: string }
  | { type: 'close-overlay' }
  | { type: 'open-search' }
  | { type: 'set-search-query'; query: string }
  | { type: 'open-recipe'; recipe: Recipe }
  | {
      type: 'open-staging';
      draft: RecipeStagingDraft;
      mode: 'create' | 'edit';
      editingRecipeId: string | null;
      returnTo: StagingReturnTarget;
    }
  | { type: 'close-route' }
  | { type: 'reset-to-root'; hasRecipes: boolean };

const rootSceneForRecipes = (hasRecipes: boolean): RootScene => (hasRecipes ? 'deck' : 'empty');

const initialRoute = (): RootRoute => ({
  type: 'root',
  root: 'deck'
});

const buildInitialAppShellState = (): AppShellState => ({
  route: initialRoute(),
  overlay: { type: 'none' }
});

const syncRouteRoot = (route: AppRoute, root: RootScene): AppRoute => {
  switch (route.type) {
    case 'root':
      return { type: 'root', root };

    case 'search':
      return { ...route, root };

    case 'recipe':
      return { ...route, root };

    case 'staging':
      return { ...route, root };

    default:
      return route;
  }
};

const routeAfterClose = (route: AppRoute): AppRoute => {
  switch (route.type) {
    case 'search':
    case 'recipe':
      return { type: 'root', root: route.root };

    case 'staging':
      return route.returnTo.type === 'search'
        ? { type: 'search', root: route.root, query: route.returnTo.query }
        : { type: 'root', root: route.root };

    case 'root':
    default:
      return route;
  }
};

const appShellReducer = (state: AppShellState, action: AppShellAction): AppShellState => {
  switch (action.type) {
    case 'sync-root': {
      const nextRoot = rootSceneForRecipes(action.hasRecipes);
      if (state.route.root === nextRoot) {
        return state;
      }
      return {
        ...state,
        route: syncRouteRoot(state.route, nextRoot)
      };
    }

    case 'open-import':
      return {
        ...state,
        overlay: { type: 'import-sheet' }
      };

    case 'request-image':
      return {
        ...state,
        overlay: { type: 'image-picker', recipeId: action.recipeId }
      };

    case 'close-overlay':
      return state.overlay.type === 'none'
        ? state
        : {
            ...state,
            overlay: { type: 'none' }
          };

    case 'open-search':
      return {
        route: {
          type: 'search',
          root: state.route.root,
          query: ''
        },
        overlay: { type: 'none' }
      };

    case 'set-search-query':
      if (state.route.type !== 'search') {
        return state;
      }

      return {
        ...state,
        route: {
          ...state.route,
          query: action.query
        }
      };

    case 'open-recipe':
      return {
        route: {
          type: 'recipe',
          root: state.route.root,
          recipeId: action.recipe.id,
          fallbackRecipe: action.recipe
        },
        overlay: { type: 'none' }
      };

    case 'open-staging':
      return {
        route: {
          type: 'staging',
          root: state.route.root,
          draft: action.draft,
          mode: action.mode,
          editingRecipeId: action.editingRecipeId,
          returnTo: action.returnTo
        },
        overlay: { type: 'none' }
      };

    case 'close-route':
      return {
        ...state,
        route: routeAfterClose(state.route)
      };

    case 'reset-to-root':
      return {
        route: {
          type: 'root',
          root: rootSceneForRecipes(action.hasRecipes)
        },
        overlay: { type: 'none' }
      };

    default:
      return state;
  }
};

const AppContent = (): JSX.Element => {
  const hydrateRecipes = useRecipeStore((state) => state.hydrate);
  const recipes = useRecipeStore((state) => state.recipes);
  const createRecipe = useRecipeStore((state) => state.createRecipe);
  const updateRecipe = useRecipeStore((state) => state.updateRecipe);
  const deleteRecipe = useRecipeStore((state) => state.deleteRecipe);
  const recipeHydrated = useRecipeStore((state) => state.hydrated);

  const themeMode = useHomeStore((state) => state.themeMode);
  const hydrateHome = useHomeStore((state) => state.hydrate);
  const homeHydrated = useHomeStore((state) => state.hydrated);

  const [isParsing, setIsParsing] = useState(false);
  const [deckSelectedRecipeId, setDeckSelectedRecipeId] = useState<string | null>(null);
  const [deckEditingRecipeId, setDeckEditingRecipeId] = useState<string | null>(null);
  const [appShellState, dispatchAppShell] = useReducer(appShellReducer, undefined, buildInitialAppShellState);
  const appShellRef = useRef(appShellState);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const mountedRef = useRef(true);
  const parseSessionRef = useRef(0);

  useWakeLock();

  useEffect(() => {
    appShellRef.current = appShellState;
  }, [appShellState]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void Promise.all([hydrateRecipes(), hydrateHome()]);
  }, [hydrateHome, hydrateRecipes]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (!recipes.length) {
      setDeckSelectedRecipeId(null);
      setDeckEditingRecipeId(null);
      return;
    }

    setDeckSelectedRecipeId((current) =>
      current && recipes.some((recipe) => recipe.id === current) ? current : recipes[0].id
    );
    setDeckEditingRecipeId((current) =>
      current && recipes.some((recipe) => recipe.id === current) ? current : null
    );
  }, [recipes]);

  useEffect(() => {
    if (!recipeHydrated || !homeHydrated) {
      return;
    }

    dispatchAppShell({ type: 'sync-root', hasRecipes: recipes.length > 0 });
  }, [homeHydrated, recipeHydrated, recipes.length]);

  useEffect(() => {
    if (appShellState.overlay.type !== 'image-picker') {
      return;
    }

    requestAnimationFrame(() => {
      imageInputRef.current?.click();
    });

    const handleFocus = () => {
      window.setTimeout(() => {
        dispatchAppShell({ type: 'close-overlay' });
      }, 0);
    };

    window.addEventListener('focus', handleFocus, { once: true });
    return () => window.removeEventListener('focus', handleFocus);
  }, [appShellState.overlay]);

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

  if (!recipeHydrated || !homeHydrated) {
    return <main className="app-shell loading-shell">Loading...</main>;
  }

  if (isParsing) {
    return <main className="app-shell loading-shell">Parsing recipe...</main>;
  }

  const openImport = () => {
    setDeckEditingRecipeId(null);
    dispatchAppShell({ type: 'open-import' });
  };

  const handleImportContinue = async (payload: RecipeImportPayload) => {
    const hasImportSource = Boolean(payload.url.trim() || payload.rawText.trim() || payload.file);
    if (!hasImportSource) {
      return;
    }

    const parseSession = parseSessionRef.current + 1;
    parseSessionRef.current = parseSession;
    dispatchAppShell({ type: 'close-overlay' });
    setIsParsing(true);

    try {
      const parsed = await parseRecipeImport({
        url: payload.url,
        rawText: payload.rawText,
        file: payload.file,
        fileName: payload.fileName
      });

      const draft: RecipeStagingDraft = {
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
      };

      if (!mountedRef.current || parseSessionRef.current !== parseSession) {
        return;
      }

      dispatchAppShell({
        type: 'open-staging',
        draft,
        mode: 'create',
        editingRecipeId: null,
        returnTo: { type: 'root' }
      });
    } finally {
      if (mountedRef.current && parseSessionRef.current === parseSession) {
        setIsParsing(false);
      }
    }
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

    const draft: RecipeStagingDraft = {
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
    };

    dispatchAppShell({
      type: 'open-staging',
      draft,
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

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const latestState = appShellRef.current;
    const targetRecipeId =
      latestState.overlay.type === 'image-picker'
        ? latestState.overlay.recipeId
        : latestState.route.type === 'recipe'
          ? latestState.route.recipeId
          : deckSelectedRecipeId;

    try {
      if (!file || !targetRecipeId) {
        return;
      }

      const dataUrl = await compressImageFile(file);
      if (dataUrl) {
        handleUpdateImage(targetRecipeId, dataUrl);
      }
    } catch {
      // ignore image processing errors
    } finally {
      event.target.value = '';
      dispatchAppShell({ type: 'close-overlay' });
    }
  };

  const handleOpenRecipe = (recipe: Recipe) => {
    setDeckSelectedRecipeId(recipe.id);
    setDeckEditingRecipeId(null);
    dispatchAppShell({ type: 'open-recipe', recipe });
  };

  const handleSearchImport = async (url: string): Promise<void> => {
    const parseSession = parseSessionRef.current + 1;
    parseSessionRef.current = parseSession;
    setIsParsing(true);

    try {
      const parsed = await parseRecipeImport({ url });
      if (!mountedRef.current || parseSessionRef.current !== parseSession) {
        return;
      }

      const latestRoute = appShellRef.current.route;
      if (latestRoute.type !== 'search') {
        return;
      }

      const draft: RecipeStagingDraft = {
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
      };

      dispatchAppShell({
        type: 'open-staging',
        draft,
        mode: 'create',
        editingRecipeId: null,
        returnTo: { type: 'search', query: latestRoute.query }
      });
    } catch {
      // ignore search import failures
    } finally {
      if (mountedRef.current && parseSessionRef.current === parseSession) {
        setIsParsing(false);
      }
    }
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
        return currentRoute.root === 'deck' && recipes.length ? (
          <DeckScene
            key="deck"
            recipes={recipes}
            selectedRecipeId={deckSelectedRecipeId}
            editingRecipeId={deckEditingRecipeId}
            onSelectRecipe={setDeckSelectedRecipeId}
            onOpenRecipe={handleOpenRecipe}
            onEnterEditMode={setDeckEditingRecipeId}
            onExitEditMode={() => setDeckEditingRecipeId(null)}
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

          const draft: RecipeStagingDraft = {
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
          };

          dispatchAppShell({
            type: 'open-staging',
            draft,
            mode: 'create',
            editingRecipeId: null,
            returnTo: { type: 'root' }
          });
        }}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="recipe-card-image-input"
        onChange={handleImageSelect}
      />
    </main>
  );
};

const App = (): JSX.Element => {
  return <AppContent />;
};

export default App;
