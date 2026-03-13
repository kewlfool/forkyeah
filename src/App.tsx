import { AnimatePresence } from 'framer-motion';
import { useEffect, useReducer, useRef, useState, type ChangeEvent } from 'react';
import { RecipeDeckScreen } from './components/recipe/RecipeDeckScreen';
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
import {
  selectActiveRecipe,
  useRecipeStore,
  type RecipeInput
} from './store/useRecipeStore';
import type { Recipe } from './types/models';
import { compressImageFile } from './utils/imageCompression';
import { parseRecipeImport } from './utils/recipeParsing';

type RootRoute = { type: 'empty' } | { type: 'deck' };
type SearchRoute = { type: 'search'; query: string };
type RecipeRoute = { type: 'recipe'; recipeId: string; fallbackRecipe: Recipe };
type StagingRoute = {
  type: 'staging';
  draft: RecipeStagingDraft;
  mode: 'create' | 'edit';
  editingRecipeId: string | null;
};
type NavRoute = RootRoute | SearchRoute | RecipeRoute | StagingRoute;

interface NavigationState {
  stack: [RootRoute, ...NavRoute[]];
  importSheetOpen: boolean;
}

type NavigationAction =
  | { type: 'sync-root'; hasRecipes: boolean }
  | { type: 'open-import' }
  | { type: 'close-import' }
  | { type: 'open-search' }
  | { type: 'set-search-query'; query: string }
  | { type: 'open-recipe'; recipe: Recipe }
  | {
      type: 'open-staging';
      draft: RecipeStagingDraft;
      mode: 'create' | 'edit';
      editingRecipeId: string | null;
    }
  | { type: 'close-top' }
  | { type: 'reset-to-root'; hasRecipes: boolean };

const rootRouteForRecipes = (hasRecipes: boolean): RootRoute => (hasRecipes ? { type: 'deck' } : { type: 'empty' });

const buildInitialNavigationState = (): NavigationState => ({
  stack: [{ type: 'deck' }],
  importSheetOpen: false
});

const isRootRoute = (route: NavRoute): route is RootRoute => route.type === 'deck' || route.type === 'empty';

const replaceRootRoute = (stack: [RootRoute, ...NavRoute[]], root: RootRoute): [RootRoute, ...NavRoute[]] => {
  const rest = stack.slice(1).filter((route) => !isRootRoute(route));
  return [root, ...rest];
};

const navigationReducer = (state: NavigationState, action: NavigationAction): NavigationState => {
  switch (action.type) {
    case 'sync-root': {
      const nextRoot = rootRouteForRecipes(action.hasRecipes);
      if (state.stack[0].type === nextRoot.type) {
        return state;
      }
      return {
        ...state,
        stack: replaceRootRoute(state.stack, nextRoot)
      };
    }

    case 'open-import':
      return { ...state, importSheetOpen: true };

    case 'close-import':
      return state.importSheetOpen ? { ...state, importSheetOpen: false } : state;

    case 'open-search':
      return {
        stack: [state.stack[0], { type: 'search', query: '' }],
        importSheetOpen: false
      };

    case 'set-search-query': {
      const current = state.stack[state.stack.length - 1];
      if (current.type !== 'search') {
        return state;
      }

      return {
        ...state,
        stack: [
          state.stack[0],
          ...state.stack.slice(1, -1),
          { ...current, query: action.query }
        ] as [RootRoute, ...NavRoute[]]
      };
    }

    case 'open-recipe':
      return {
        stack: [
          state.stack[0],
          { type: 'recipe', recipeId: action.recipe.id, fallbackRecipe: action.recipe }
        ],
        importSheetOpen: false
      };

    case 'open-staging': {
      const current = state.stack[state.stack.length - 1];
      const baseStack =
        current.type === 'search' ? ([state.stack[0], current] as [RootRoute, ...NavRoute[]]) : ([state.stack[0]] as [RootRoute, ...NavRoute[]]);

      return {
        stack: [
          ...baseStack,
          {
            type: 'staging',
            draft: action.draft,
            mode: action.mode,
            editingRecipeId: action.editingRecipeId
          }
        ],
        importSheetOpen: false
      };
    }

    case 'close-top':
      if (state.stack.length <= 1) {
        return {
          ...state,
          importSheetOpen: false
        };
      }
      return {
        ...state,
        stack: state.stack.slice(0, -1) as [RootRoute, ...NavRoute[]]
      };

    case 'reset-to-root':
      return {
        stack: [rootRouteForRecipes(action.hasRecipes)],
        importSheetOpen: false
      };

    default:
      return state;
  }
};

const AppContent = (): JSX.Element => {
  const hydrateRecipes = useRecipeStore((state) => state.hydrate);
  const recipes = useRecipeStore((state) => state.recipes);
  const activeRecipe = useRecipeStore(selectActiveRecipe);
  const viewMode = useRecipeStore((state) => state.viewMode);
  const deckOrder = useRecipeStore((state) => state.deckOrder);
  const setViewMode = useRecipeStore((state) => state.setViewMode);
  const setActiveRecipe = useRecipeStore((state) => state.setActiveRecipe);
  const moveActiveRecipeBy = useRecipeStore((state) => state.moveActiveRecipeBy);
  const createRecipe = useRecipeStore((state) => state.createRecipe);
  const updateRecipe = useRecipeStore((state) => state.updateRecipe);
  const deleteRecipe = useRecipeStore((state) => state.deleteRecipe);
  const recipeHydrated = useRecipeStore((state) => state.hydrated);

  const themeMode = useHomeStore((state) => state.themeMode);
  const hydrateHome = useHomeStore((state) => state.hydrate);
  const homeHydrated = useHomeStore((state) => state.hydrated);

  const [isParsing, setIsParsing] = useState(false);
  const [pendingImageRecipeId, setPendingImageRecipeId] = useState<string | null>(null);
  const [navigationState, dispatchNavigation] = useReducer(navigationReducer, undefined, buildInitialNavigationState);
  const navigationStateRef = useRef(navigationState);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useWakeLock();

  useEffect(() => {
    navigationStateRef.current = navigationState;
  }, [navigationState]);

  useEffect(() => {
    void Promise.all([hydrateRecipes(), hydrateHome()]);
  }, [hydrateHome, hydrateRecipes]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (!recipes.length || activeRecipe) {
      return;
    }

    setActiveRecipe(recipes[0].id);
  }, [activeRecipe, recipes, setActiveRecipe]);

  useEffect(() => {
    if (!recipeHydrated || !homeHydrated) {
      return;
    }

    dispatchNavigation({ type: 'sync-root', hasRecipes: recipes.length > 0 });
  }, [homeHydrated, recipeHydrated, recipes.length]);

  const currentRoute = navigationState.stack[navigationState.stack.length - 1];
  const deckRecipes = deckOrder.length
    ? deckOrder
        .map((id) => recipes.find((recipe) => recipe.id === id))
        .filter((recipe): recipe is Recipe => Boolean(recipe))
    : recipes;
  const deckActiveRecipe =
    activeRecipe && deckRecipes.some((recipe) => recipe.id === activeRecipe.id)
      ? activeRecipe
      : deckRecipes[0] ?? recipes[0] ?? null;
  const liveRecipe =
    currentRoute.type === 'recipe'
      ? recipes.find((recipe) => recipe.id === currentRoute.recipeId) ?? null
      : null;
  const openRecipe = currentRoute.type === 'recipe' ? liveRecipe ?? currentRoute.fallbackRecipe : null;

  useEffect(() => {
    if (currentRoute.type !== 'recipe' || openRecipe) {
      return;
    }

    dispatchNavigation({ type: 'close-top' });
  }, [currentRoute, openRecipe]);

  const openImport = () => {
    dispatchNavigation({ type: 'open-import' });
  };

  const handleImportContinue = async (payload: RecipeImportPayload) => {
    dispatchNavigation({ type: 'close-import' });
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

      dispatchNavigation({
        type: 'open-staging',
        draft,
        mode: 'create',
        editingRecipeId: null
      });
    } finally {
      setIsParsing(false);
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

    setActiveRecipe(nextRecipeId);
    dispatchNavigation({ type: 'reset-to-root', hasRecipes: true });
  };

  const handleDeleteDraft = () => {
    dispatchNavigation({ type: 'close-top' });
  };

  const handleEditRecipe = (recipe: Recipe) => {
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

    dispatchNavigation({
      type: 'open-staging',
      draft,
      mode: 'edit',
      editingRecipeId: recipe.id
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

  const clearImagePrompt = () => {
    setPendingImageRecipeId(null);
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
      imageInputRef.current.blur();
    }
  };

  const handleRequestImage = (recipeId: string) => {
    setPendingImageRecipeId(recipeId);
    imageInputRef.current?.click();
  };

  const handleImageSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const latestRoute = navigationStateRef.current.stack[navigationStateRef.current.stack.length - 1];
    const targetRecipeId =
      pendingImageRecipeId ?? (latestRoute.type === 'recipe' ? latestRoute.recipeId : deckActiveRecipe?.id ?? null);

    try {
      const dataUrl = await compressImageFile(file);
      if (dataUrl && targetRecipeId) {
        handleUpdateImage(targetRecipeId, dataUrl);
      }
    } catch {
      // ignore
    } finally {
      event.target.value = '';
      setPendingImageRecipeId(null);
    }
  };

  const handleOpenRecipe = (recipe: Recipe) => {
    setActiveRecipe(recipe.id);
    dispatchNavigation({ type: 'open-recipe', recipe });
  };

  const handleSearchImport = async (url: string): Promise<void> => {
    setIsParsing(true);
    try {
      const parsed = await parseRecipeImport({ url });
      const latestRoute = navigationStateRef.current.stack[navigationStateRef.current.stack.length - 1];
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

      dispatchNavigation({
        type: 'open-staging',
        draft,
        mode: 'create',
        editingRecipeId: null
      });
    } catch {
      // ignore
    } finally {
      setIsParsing(false);
    }
  };

  const handleDeleteRecipe = (recipeId: string) => {
    const hasRecipesAfterDelete = recipes.some((recipe) => recipe.id !== recipeId);
    deleteRecipe(recipeId);

    const latestRoute = navigationStateRef.current.stack[navigationStateRef.current.stack.length - 1];
    if (latestRoute.type === 'recipe' && latestRoute.recipeId === recipeId) {
      dispatchNavigation({ type: 'reset-to-root', hasRecipes: hasRecipesAfterDelete });
    }
  };

  const screen = (() => {
    switch (currentRoute.type) {
      case 'staging':
        return (
          <RecipeStagingScreen
            key="staging"
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

      case 'empty':
        return <RecipeEmptyState key="empty" onImport={openImport} />;

      case 'search':
        return (
          <RecipeSearchScreen
            key="search"
            query={currentRoute.query}
            onQueryChange={(value) => dispatchNavigation({ type: 'set-search-query', query: value })}
            onClose={() => dispatchNavigation({ type: 'close-top' })}
            onImportUrl={handleSearchImport}
          />
        );

      case 'recipe':
        return openRecipe ? (
          <RecipeScreen
            key={openRecipe.id}
            recipe={openRecipe}
            onClose={() => dispatchNavigation({ type: 'close-top' })}
          />
        ) : (
          <RecipeEmptyState key="recipe-missing" onImport={openImport} />
        );

      case 'deck':
      default:
        return deckActiveRecipe ? (
          <RecipeDeckScreen
            key="deck"
            recipes={recipes}
            deckRecipes={deckRecipes}
            activeRecipe={deckActiveRecipe}
            viewMode={viewMode}
            onOpenRecipe={handleOpenRecipe}
            onMoveRecipe={moveActiveRecipeBy}
            onImport={openImport}
            onEdit={handleEditRecipe}
            onDelete={handleDeleteRecipe}
            onSetViewMode={setViewMode}
            onRequestImage={handleRequestImage}
            onClearImagePrompt={clearImagePrompt}
            showImportFab={!navigationState.importSheetOpen}
          />
        ) : (
          <RecipeEmptyState key="empty-fallback" onImport={openImport} />
        );
    }
  })();

  return (
    <main className="app-shell">
      <AnimatePresence mode="wait" initial={false}>
        {screen}
      </AnimatePresence>

      <RecipeImportSheet
        open={navigationState.importSheetOpen}
        onClose={() => dispatchNavigation({ type: 'close-import' })}
        onContinue={handleImportContinue}
        onOpenSearch={() => dispatchNavigation({ type: 'open-search' })}
        onCreateManual={() => {
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

          dispatchNavigation({
            type: 'open-staging',
            draft,
            mode: 'create',
            editingRecipeId: null
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
