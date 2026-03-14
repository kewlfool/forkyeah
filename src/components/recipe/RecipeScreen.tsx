import { motion } from 'framer-motion';
import { ChefHat, Leaf, Share2, StickyNote, Timer, Utensils } from 'lucide-react';
import { useEffect, useMemo, useReducer, type CSSProperties } from 'react';
import { useHorizontalSwipe } from '../../hooks/useHorizontalSwipe';
import { useLongPress } from '../../hooks/useLongPress';
import { usePinchToClose } from '../../hooks/usePinchToClose';
import { useRecipeStore, type RecipeInput } from '../../store/useRecipeStore';
import type { Recipe } from '../../types/models';
import { IngredientEditorSheet } from './IngredientEditorSheet';
import { RecipeArticleLayout } from './RecipeArticleLayout';
import { RecipeIngredientList } from './RecipeIngredientList';
import { RecipePeekSheet } from './RecipePeekSheet';
import {
  createRecipeScreenState,
  recipeScreenReducer,
  type RecipePeekPanel
} from './recipeScreenState';

interface RecipeScreenProps {
  recipe: Recipe;
  onClose: () => void;
}

interface StepItemProps {
  item: string;
  isDone: boolean;
  onSwipeRight: () => void;
}

const StepItem = ({ item, isDone, onSwipeRight }: StepItemProps): JSX.Element => {
  const swipe = useHorizontalSwipe({
    onSwipeRight,
    threshold: 48
  });

  return (
    <li
      className={`recipe-step-item ${isDone ? 'is-done' : ''}`}
      onTouchStart={swipe.onTouchStart}
      onTouchMove={swipe.onTouchMove}
      onTouchEnd={swipe.onTouchEnd}
      onTouchCancel={swipe.onTouchCancel}
    >
      {item}
    </li>
  );
};

export const RecipeScreen = ({ recipe, onClose }: RecipeScreenProps): JSX.Element => {
  const navIconSize = 18;
  const [uiState, dispatchUi] = useReducer(
    recipeScreenReducer,
    undefined,
    () => createRecipeScreenState(recipe.ingredients.length, recipe.steps.length)
  );

  const updateRecipe = useRecipeStore((state) => state.updateRecipe);

  const pinch = usePinchToClose({
    onPinchOut: onClose,
    direction: 'in',
    threshold: 42
  });

  const titleLongPress = useLongPress({
    onLongPress: onClose
  });
  const navLongPress = useLongPress({
    onLongPress: onClose
  });

  const lastCookedLabel = useMemo(() => {
    if (!recipe.lastCooked) {
      return 'Last cooked: Never';
    }

    const cookedDate = new Date(recipe.lastCooked);
    const now = new Date(uiState.nowTick);
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfCooked = new Date(
      cookedDate.getFullYear(),
      cookedDate.getMonth(),
      cookedDate.getDate()
    ).getTime();
    const dayDiff = Math.max(0, Math.round((startOfToday - startOfCooked) / (24 * 60 * 60 * 1000)));

    if (dayDiff === 0) {
      return 'Cooked: Today';
    }
    if (dayDiff === 1) {
      return 'Cooked: Yesterday';
    }

    return `Last cooked: ${cookedDate.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })}`;
  }, [recipe.lastCooked, uiState.nowTick]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      dispatchUi({ type: 'tick-clock', now: Date.now() });
    }, 60000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!uiState.timerEndsAt) {
      return;
    }

    const timerId = window.setInterval(() => {
      dispatchUi({ type: 'tick-timer', now: Date.now() });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [uiState.timerEndsAt]);

  useEffect(() => {
    dispatchUi({ type: 'sync-ingredients', count: recipe.ingredients.length });
  }, [recipe.ingredients.length]);

  useEffect(() => {
    dispatchUi({ type: 'sync-steps', count: recipe.steps.length });
  }, [recipe.steps.length]);

  const buildRecipeInput = (overrides: Partial<RecipeInput>): RecipeInput => ({
    title: recipe.title,
    description: recipe.description,
    imageUrl: recipe.imageUrl,
    ingredients: recipe.ingredients,
    steps: recipe.steps,
    tags: recipe.tags,
    categories: recipe.categories,
    cuisines: recipe.cuisines,
    nutrients: recipe.nutrients,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    notes: recipe.notes,
    lastCooked: recipe.lastCooked,
    ...overrides
  });

  const remainingSeconds = uiState.timerEndsAt
    ? Math.max(0, Math.ceil((uiState.timerEndsAt - uiState.timerNow) / 1000))
    : 0;
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingDisplaySeconds = remainingSeconds % 60;
  const remainingMs = uiState.timerEndsAt ? Math.max(0, uiState.timerEndsAt - uiState.timerNow) : 0;
  const timerProgress =
    uiState.timerDurationMs && uiState.timerDurationMs > 0
      ? Math.min(1, Math.max(0, 1 - remainingMs / uiState.timerDurationMs))
      : 0;

  const handleEditIngredient = (index: number) => {
    dispatchUi({
      type: 'open-ingredient-editor',
      index,
      value: recipe.ingredients[index] ?? ''
    });
  };

  const handleIngredientEditorSave = () => {
    if (!uiState.ingredientEditor) {
      return;
    }

    const trimmed = uiState.ingredientEditor.value.trim();
    if (!trimmed) {
      return;
    }

    const updated = recipe.ingredients.map((item, index) =>
      index === uiState.ingredientEditor?.index ? trimmed : item
    );
    updateRecipe(recipe.id, buildRecipeInput({ ingredients: updated }));
    dispatchUi({ type: 'close-ingredient-editor' });
  };

  const handleDeleteIngredient = (index: number) => {
    const updated = recipe.ingredients.filter((_, itemIndex) => itemIndex !== index);
    updateRecipe(recipe.id, buildRecipeInput({ ingredients: updated }));
    dispatchUi({ type: 'remove-ingredient-state', index });
  };

  const handleExport = async () => {
    const { exportRecipeToPdf } = await import('../../utils/recipePdf');
    exportRecipeToPdf(recipe);
  };

  const openPeekPanel = (panel: RecipePeekPanel) => {
    dispatchUi({ type: 'set-peek-panel', panel });
  };

  return (
    <motion.section
      className="recipe-shell screen-layer"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      style={{ transformOrigin: 'center center' }}
      onTouchStart={pinch.onTouchStart}
      onTouchMove={pinch.onTouchMove}
      onTouchEnd={pinch.onTouchEnd}
      onTouchCancel={pinch.onTouchCancel}
    >
      <RecipeArticleLayout
        recipe={recipe}
        titleProps={{
          onPointerDown: titleLongPress.onPointerDown,
          onPointerUp: titleLongPress.onPointerUp,
          onPointerCancel: titleLongPress.onPointerCancel,
          onPointerLeave: titleLongPress.onPointerLeave
        }}
        headerAction={
          <button
            type="button"
            className="plain-icon-button"
            aria-label="Export recipe"
            onClick={() => {
              void handleExport();
            }}
          >
            <Share2 size={16} />
          </button>
        }
        lastCookedControl={
          <button
            type="button"
            className="recipe-title-meta recipe-cooked-button"
            onClick={() => {
              updateRecipe(recipe.id, buildRecipeInput({ lastCooked: Date.now() }));
            }}
            aria-label="Update last cooked date"
          >
            {lastCookedLabel}
          </button>
        }
        ingredientsContent={
          <RecipeIngredientList
            ingredients={recipe.ingredients}
            ingredientDone={uiState.ingredientDone}
            ingredientRailIndex={uiState.ingredientRailIndex}
            onOpenRail={(index) => dispatchUi({ type: 'open-ingredient-rail', index })}
            onToggleDone={(index) => dispatchUi({ type: 'toggle-ingredient-done', index })}
            onEdit={handleEditIngredient}
            onDelete={handleDeleteIngredient}
          />
        }
        stepsContent={
          recipe.steps.length ? (
            <ol className="recipe-steps-list">
              {recipe.steps.map((item, index) => (
                <StepItem
                  key={`${item}-${index}`}
                  item={item}
                  isDone={uiState.stepDone[index]}
                  onSwipeRight={() => dispatchUi({ type: 'toggle-step-done', index })}
                />
              ))}
            </ol>
          ) : (
            <p className="muted">No steps yet.</p>
          )
        }
        footer={
          <div
            className="recipe-nav"
            onPointerDown={navLongPress.onPointerDown}
            onPointerUp={navLongPress.onPointerUp}
            onPointerCancel={navLongPress.onPointerCancel}
            onPointerLeave={navLongPress.onPointerLeave}
          >
            <button
              type="button"
              className={`recipe-nav-icon ${uiState.peekPanel === 'ingredients' ? 'is-active' : ''}`}
              onClick={() => openPeekPanel('ingredients')}
              aria-label="Ingredients"
            >
              <Utensils size={navIconSize} />
            </button>
            <button
              type="button"
              className={`recipe-nav-icon ${uiState.peekPanel === 'notes' ? 'is-active' : ''}`}
              onClick={() => openPeekPanel('notes')}
              aria-label="Notes"
            >
              <StickyNote size={navIconSize} />
            </button>
            <button
              type="button"
              className={`recipe-nav-icon ${uiState.peekPanel === 'nutrients' ? 'is-active' : ''}`}
              onClick={() => openPeekPanel('nutrients')}
              aria-label="Nutrients"
            >
              <Leaf size={navIconSize} />
            </button>
            <button type="button" className="recipe-nav-icon recipe-nav-spacer" aria-label="Cook mode">
              <ChefHat size={navIconSize} />
            </button>
            <button
              type="button"
              className={`recipe-nav-icon ${uiState.peekPanel === 'timer' ? 'is-active' : ''}`}
              onClick={() => openPeekPanel('timer')}
              aria-label="Timer"
            >
              {uiState.timerEndsAt ? (
                <span className="timer-dial" style={{ '--progress': timerProgress } as CSSProperties}>
                  <span className="timer-dial-inner" />
                </span>
              ) : (
                <Timer size={navIconSize} />
              )}
            </button>
          </div>
        }
      />

      <RecipePeekSheet
        panel={uiState.peekPanel}
        ingredientItems={recipe.ingredients}
        ingredientDone={uiState.ingredientDone}
        notes={recipe.notes}
        nutrientItems={recipe.nutrients}
        timerMinutes={uiState.timerMinutes}
        timerEndsAt={uiState.timerEndsAt}
        remainingMinutes={remainingMinutes}
        remainingDisplaySeconds={remainingDisplaySeconds}
        timerProgress={timerProgress}
        onClose={() => dispatchUi({ type: 'set-peek-panel', panel: null })}
        onTimerMinutesChange={(value) => dispatchUi({ type: 'set-timer-minutes', minutes: value })}
        onStartTimer={() => dispatchUi({ type: 'start-timer', now: Date.now() })}
        onStopTimer={() => dispatchUi({ type: 'stop-timer' })}
      />

      <IngredientEditorSheet
        open={Boolean(uiState.ingredientEditor)}
        value={uiState.ingredientEditor?.value ?? ''}
        onChange={(value) => dispatchUi({ type: 'set-ingredient-editor-value', value })}
        onClose={() => dispatchUi({ type: 'close-ingredient-editor' })}
        onSave={handleIngredientEditorSave}
      />
    </motion.section>
  );
};
