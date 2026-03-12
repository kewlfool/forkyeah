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

type UiScreen = 'empty' | 'deck' | 'recipe' | 'search' | 'staging';

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
  const [stagingDraft, setStagingDraft] = useState<RecipeStagingDraft | null>(null);
  const [stagingMode, setStagingMode] = useState<'create' | 'edit'>('create');
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [pendingImageRecipeId, setPendingImageRecipeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uiScreen, setUiScreen] = useState<UiScreen>('deck');
  const [openRecipeId, setOpenRecipeId] = useState<string | null>(null);
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
      if (uiScreen !== 'staging' && uiScreen !== 'search') {
        setUiScreen('empty');
      }
      return;
    }

    if (uiScreen === 'empty') {
      setUiScreen('deck');
    }
  }, [homeHydrated, recipeHydrated, recipes.length, uiScreen]);

  useEffect(() => {
    if (uiScreen === 'recipe' && openRecipeId && !recipes.some((recipe) => recipe.id === openRecipeId)) {
      setOpenRecipeId(null);
      setUiScreen(recipes.length ? 'deck' : 'empty');
    }
  }, [openRecipeId, recipes, uiScreen]);

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

      setEditingRecipeId(null);
      setStagingMode('create');
      setStagingDraft(draft);
      setUiScreen('staging');
    } finally {
      setIsParsing(false);
    }
  };

  const handleAccept = (input: RecipeInput) => {
    if (editingRecipeId) {
      updateRecipe(editingRecipeId, input);
    } else {
      createRecipe(input);
    }

    setStagingDraft(null);
    setEditingRecipeId(null);
    setUiScreen('deck');
  };

  const handleDeleteDraft = () => {
    setStagingDraft(null);
    setEditingRecipeId(null);
    setUiScreen(recipes.length ? 'deck' : 'empty');
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

    setEditingRecipeId(recipe.id);
    setStagingMode('edit');
    setStagingDraft(draft);
    setUiScreen('staging');
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

    const targetRecipeId = pendingImageRecipeId ?? activeRecipe?.id ?? null;
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
  const openRecipe = openRecipeId
    ? recipes.find((recipe) => recipe.id === openRecipeId) ?? null
    : activeRecipe;
  const deckActiveRecipe = activeRecipe ?? deckRecipes[0] ?? null;

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

      setEditingRecipeId(null);
      setStagingMode('create');
      setStagingDraft(draft);
      setUiScreen('staging');
    } catch {
      // ignore
    } finally {
      setIsParsing(false);
    }
  };

  const screen = (() => {
    if (uiScreen === 'staging' && stagingDraft) {
      return (
        <RecipeStagingScreen
          key="staging"
          draft={stagingDraft}
          mode={stagingMode}
          startEditing={
            stagingMode === 'edit' || (stagingMode === 'create' && stagingDraft.sourceLabel === 'Manual')
          }
          onAccept={handleAccept}
          onDelete={handleDeleteDraft}
        />
      );
    }

    if (uiScreen === 'empty') {
      return <RecipeEmptyState key="empty" onImport={openImport} />;
    }

    if (uiScreen === 'search') {
      return (
        <RecipeSearchScreen
          key="search"
          query={searchQuery}
          onClose={() => setUiScreen('deck')}
          onImportUrl={handleSearchImport}
        />
      );
    }

    if (uiScreen === 'recipe' && openRecipe) {
      return (
        <RecipeScreen
          key={openRecipe.id}
          recipe={openRecipe}
          onClose={() => {
            setOpenRecipeId(null);
            setUiScreen('deck');
          }}
        />
      );
    }

    if (uiScreen === 'deck' && deckActiveRecipe) {
      return (
        <RecipeDeckScreen
          key="deck"
          recipes={recipes}
          deckRecipes={deckRecipes}
          activeRecipe={deckActiveRecipe}
          viewMode={viewMode}
          onOpenRecipe={(recipeId) => {
            setActiveRecipe(recipeId);
            setOpenRecipeId(recipeId);
            setUiScreen('recipe');
          }}
          onOpenSearch={() => setUiScreen('search')}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
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

    return null;
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

          setEditingRecipeId(null);
          setStagingMode('create');
          setStagingDraft(draft);
          setImportOpen(false);
          setUiScreen('staging');
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
