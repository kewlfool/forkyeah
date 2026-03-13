import { AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
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
import { parseRecipeImport } from './utils/recipeParsing';

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

type UiState =
  | { type: 'empty' }
  | { type: 'deck' }
  | { type: 'search'; query: string; returnTo: { type: 'empty' } | { type: 'deck' } }
  | {
      type: 'staging';
      draft: RecipeStagingDraft;
      mode: 'create' | 'edit';
      editingRecipeId: string | null;
      returnTo: { type: 'empty' } | { type: 'deck' } | { type: 'search'; query: string; returnTo: { type: 'empty' } | { type: 'deck' } };
    }
  | { type: 'recipe'; recipeId: string; fallbackRecipe: Recipe; returnTo: { type: 'empty' } | { type: 'deck' } };

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

  const [importOpen, setImportOpen] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [pendingImageRecipeId, setPendingImageRecipeId] = useState<string | null>(null);
  const [uiState, setUiState] = useState<UiState>({ type: 'deck' });
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useWakeLock();

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

    if (!recipes.length) {
      if (uiState.type !== 'staging' && uiState.type !== 'search' && uiState.type !== 'recipe') {
        setUiState({ type: 'empty' });
      }
      return;
    }

    if (uiState.type === 'empty') {
      setUiState({ type: 'deck' });
    }
  }, [homeHydrated, recipeHydrated, recipes.length, uiState.type]);

  if (!recipeHydrated || !homeHydrated) {
    return <main className="app-shell loading-shell">Loading...</main>;
  }

  if (isParsing) {
    return <main className="app-shell loading-shell">Parsing recipe...</main>;
  }

  const openImport = () => {
    setImportOpen(true);
  };

  const handleImportContinue = async (payload: RecipeImportPayload) => {
    setImportOpen(false);
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

      setUiState({
        type: 'staging',
        draft,
        mode: 'create',
        editingRecipeId: null,
        returnTo: recipes.length ? { type: 'deck' } : { type: 'empty' }
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleAccept = (input: RecipeInput) => {
    if (uiState.type !== 'staging') {
      return;
    }

    if (uiState.editingRecipeId) {
      updateRecipe(uiState.editingRecipeId, input);
      setActiveRecipe(uiState.editingRecipeId);
    } else {
      const recipeId = createRecipe(input);
      setActiveRecipe(recipeId);
    }

    setUiState({ type: 'deck' });
  };

  const handleDeleteDraft = () => {
    if (uiState.type !== 'staging') {
      return;
    }

    setUiState(uiState.returnTo);
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

    setUiState({
      type: 'staging',
      draft,
      mode: 'edit',
      editingRecipeId: recipe.id,
      returnTo: { type: 'deck' }
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

    const targetRecipeId =
      pendingImageRecipeId ?? (uiState.type === 'recipe' ? uiState.recipeId : activeRecipe?.id ?? null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
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

  const deckRecipes = deckOrder.length
    ? deckOrder
        .map((id) => recipes.find((recipe) => recipe.id === id))
        .filter((recipe): recipe is Recipe => Boolean(recipe))
    : recipes;
  const liveOpenRecipe =
    uiState.type === 'recipe'
      ? recipes.find((recipe) => recipe.id === uiState.recipeId) ?? null
      : null;
  const openRecipe = uiState.type === 'recipe' ? liveOpenRecipe ?? uiState.fallbackRecipe : null;
  const deckActiveRecipe = activeRecipe ?? deckRecipes[0] ?? recipes[0] ?? null;

  const handleOpenRecipe = (recipe: Recipe) => {
    setUiState({
      type: 'recipe',
      recipeId: recipe.id,
      fallbackRecipe: recipe,
      returnTo: recipes.length ? { type: 'deck' } : { type: 'empty' }
    });
  };

  const searchQuery = uiState.type === 'search' ? uiState.query : '';

  const handleSearchImport = async (url: string): Promise<void> => {
    setIsParsing(true);
    try {
      const parsed = await parseRecipeImport({ url });
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

      setUiState({
        type: 'staging',
        draft,
        mode: 'create',
        editingRecipeId: null,
        returnTo: uiState.type === 'search' ? uiState : { type: 'deck' }
      });
    } catch {
      // ignore
    } finally {
      setIsParsing(false);
    }
  };

  const screen = (() => {
    if (uiState.type === 'staging') {
      return (
        <RecipeStagingScreen
          key="staging"
          draft={uiState.draft}
          mode={uiState.mode}
          startEditing={
            uiState.mode === 'edit' || (uiState.mode === 'create' && uiState.draft.sourceLabel === 'Manual')
          }
          onAccept={handleAccept}
          onDelete={handleDeleteDraft}
        />
      );
    }

    if (uiState.type === 'empty') {
      return <RecipeEmptyState key="empty" onImport={openImport} />;
    }

    if (uiState.type === 'search') {
      return (
        <RecipeSearchScreen
          key="search"
          query={searchQuery}
          onQueryChange={(value) => {
            setUiState((current) => (current.type === 'search' ? { ...current, query: value } : current));
          }}
          onClose={() => setUiState(uiState.returnTo)}
          onImportUrl={handleSearchImport}
        />
      );
    }

    if (uiState.type === 'recipe' && openRecipe) {
      return (
        <RecipeScreen
          key={openRecipe.id}
          recipe={openRecipe}
          onClose={() => {
            if (liveOpenRecipe) {
              setActiveRecipe(liveOpenRecipe.id);
            } else if (deckActiveRecipe) {
              setActiveRecipe(deckActiveRecipe.id);
            }
            setUiState(uiState.returnTo);
          }}
        />
      );
    }

    if (deckActiveRecipe) {
      return (
        <RecipeDeckScreen
          key="deck"
          recipes={recipes}
          deckRecipes={deckRecipes}
          activeRecipe={deckActiveRecipe}
          viewMode={viewMode}
          onOpenRecipe={handleOpenRecipe}
          onMoveRecipe={moveActiveRecipeBy}
          onImport={openImport}
          onEdit={(recipe) => handleEditRecipe(recipe)}
          onDelete={(recipeId) => deleteRecipe(recipeId)}
          onSetViewMode={setViewMode}
          onRequestImage={handleRequestImage}
          onClearImagePrompt={clearImagePrompt}
          showImportFab={!importOpen}
        />
      );
    }

    return <RecipeEmptyState key="empty-fallback" onImport={openImport} />;
  })();

  return (
    <main className="app-shell">
      <AnimatePresence mode="wait" initial={false}>
        {screen}
      </AnimatePresence>

      <RecipeImportSheet
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onContinue={handleImportContinue}
        onOpenSearch={() => {
          setImportOpen(false);
          setUiState({
            type: 'search',
            query: '',
            returnTo: recipes.length ? { type: 'deck' } : { type: 'empty' }
          });
        }}
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

          setImportOpen(false);
          setUiState({
            type: 'staging',
            draft,
            mode: 'create',
            editingRecipeId: null,
            returnTo: recipes.length ? { type: 'deck' } : { type: 'empty' }
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
