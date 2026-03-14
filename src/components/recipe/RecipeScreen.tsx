import { motion } from 'framer-motion';
import { ChefHat, Leaf, Pencil, Share2, StickyNote, Timer, Trash2, Utensils } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type TouchEvent } from 'react';
import { useHorizontalSwipe } from '../../hooks/useHorizontalSwipe';
import { useLongPress } from '../../hooks/useLongPress';
import { usePinchToClose } from '../../hooks/usePinchToClose';
import { useRecipeStore, type RecipeInput } from '../../store/useRecipeStore';
import type { Recipe } from '../../types/models';
import { exportRecipeToPdf } from '../../utils/recipePdf';

interface RecipeScreenProps {
  recipe: Recipe;
  onClose: () => void;
}

const INGREDIENT_RAIL_WIDTH = 88;

interface IngredientItemProps {
  item: string;
  isDone: boolean;
  showActions: boolean;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const IngredientItem = ({
  item,
  isDone,
  showActions,
  onSwipeLeft,
  onSwipeRight,
  onEdit,
  onDelete
}: IngredientItemProps): JSX.Element => {
  const [railOpen, setRailOpen] = useState(false);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!showActions) {
      setRailOpen(false);
    }
  }, [showActions]);

  const onTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (event.touches.length !== 1) {
      swipeStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;

    if (!start || event.changedTouches.length !== 1) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);

    if (deltaY > Math.abs(deltaX) * 1.1) {
      return;
    }

    if (deltaX <= -48) {
      setRailOpen(true);
      onSwipeLeft();
      return;
    }

    if (deltaX >= 54) {
      onSwipeRight();
      setRailOpen(false);
      return;
    }

    if (Math.abs(deltaX) < 12 && railOpen) {
      setRailOpen(false);
    }
  };

  return (
    <li className="recipe-item-shell">
      <div className="recipe-item-rail" aria-hidden={!railOpen}>
        <button type="button" className="recipe-swipe-action" aria-label="Edit ingredient" onClick={onEdit}>
          <Pencil size={14} />
        </button>
        <button type="button" className="recipe-swipe-action" aria-label="Delete ingredient" onClick={onDelete}>
          <Trash2 size={14} />
        </button>
      </div>
      <div
        className={`recipe-item-row ${isDone ? 'is-done' : ''}`}
        style={{ transform: railOpen ? `translateX(-${INGREDIENT_RAIL_WIDTH}px)` : 'translateX(0)' }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          swipeStartRef.current = null;
        }}
      >
        <span className="recipe-item-text">{item}</span>
      </div>
    </li>
  );
};

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
  const contentRef = useRef<HTMLDivElement | null>(null);
  const navIconSize = 18;
  const [nowTick, setNowTick] = useState(() => Date.now());

  const [peekPanel, setPeekPanel] = useState<'ingredients' | 'notes' | 'nutrients' | 'timer' | null>(null);
  const [timerMinutes, setTimerMinutes] = useState(10);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timerNow, setTimerNow] = useState(() => Date.now());
  const [timerDurationMs, setTimerDurationMs] = useState<number | null>(null);
  const [ingredientDone, setIngredientDone] = useState<boolean[]>([]);
  const [stepDone, setStepDone] = useState<boolean[]>([]);
  const [ingredientRailIndex, setIngredientRailIndex] = useState<number | null>(null);

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

  const hasHeroImage = Boolean(recipe.imageUrl);
  const lastCookedLabel = useMemo(() => {
    if (!recipe.lastCooked) {
      return 'Last cooked: Never';
    }
    const cookedDate = new Date(recipe.lastCooked);
    const now = new Date(nowTick);
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
  }, [nowTick, recipe.lastCooked]);

  const displayTags = useMemo(() => {
    const deduped = new Set<string>();
    for (const item of [...(recipe.categories ?? []), ...(recipe.cuisines ?? []), ...(recipe.tags ?? [])]) {
      const trimmed = item.trim();
      if (trimmed) {
        deduped.add(trimmed);
      }
    }
    return Array.from(deduped);
  }, [recipe.categories, recipe.cuisines, recipe.tags]);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowTick(Date.now());
    }, 60000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    if (!timerEndsAt) {
      return;
    }

    const timerId = window.setInterval(() => {
      setTimerNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [timerEndsAt]);

  useEffect(() => {
    if (timerEndsAt && timerNow >= timerEndsAt) {
      setTimerEndsAt(null);
      setTimerDurationMs(null);
    }
  }, [timerEndsAt, timerNow]);

  const remainingSeconds = timerEndsAt ? Math.max(0, Math.ceil((timerEndsAt - timerNow) / 1000)) : 0;
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingDisplaySeconds = remainingSeconds % 60;
  const remainingMs = timerEndsAt ? Math.max(0, timerEndsAt - timerNow) : 0;
  const timerProgress =
    timerDurationMs && timerDurationMs > 0 ? Math.min(1, Math.max(0, 1 - remainingMs / timerDurationMs)) : 0;

  const startTimer = () => {
    const minutes = Number.isFinite(timerMinutes) ? Math.max(1, Math.floor(timerMinutes)) : 1;
    setTimerMinutes(minutes);
    const durationMs = minutes * 60 * 1000;
    setTimerDurationMs(durationMs);
    setTimerEndsAt(Date.now() + durationMs);
  };

  const stopTimer = () => {
    setTimerEndsAt(null);
    setTimerDurationMs(null);
  };

  useEffect(() => {
    setIngredientDone((prev) =>
      recipe.ingredients.map((_, index) => prev[index] ?? false)
    );
  }, [recipe.ingredients.length]);

  useEffect(() => {
    setStepDone((prev) => recipe.steps.map((_, index) => prev[index] ?? false));
  }, [recipe.steps.length]);

  useEffect(() => {
    setIngredientDone(recipe.ingredients.map(() => false));
    setStepDone(recipe.steps.map(() => false));
    setIngredientRailIndex(null);
  }, [recipe.id]);

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

  const toggleIngredientDone = (index: number) => {
    setIngredientDone((prev) => prev.map((value, idx) => (idx === index ? !value : value)));
    setIngredientRailIndex(null);
  };

  const toggleStepDone = (index: number) => {
    setStepDone((prev) => prev.map((value, idx) => (idx === index ? !value : value)));
  };

  const handleIngredientSwipeLeft = (index: number) => {
    setIngredientRailIndex(index);
  };

  const handleEditIngredient = (index: number) => {
    const current = recipe.ingredients[index];
    const next = window.prompt('Edit ingredient', current);
    if (next === null) {
      return;
    }
    const trimmed = next.trim();
    if (!trimmed) {
      return;
    }
    const updated = recipe.ingredients.map((item, idx) => (idx === index ? trimmed : item));
    updateRecipe(recipe.id, buildRecipeInput({ ingredients: updated }));
    setIngredientRailIndex(null);
  };

  const handleDeleteIngredient = (index: number) => {
    const updated = recipe.ingredients.filter((_, idx) => idx !== index);
    updateRecipe(recipe.id, buildRecipeInput({ ingredients: updated }));
    setIngredientDone((prev) => prev.filter((_, idx) => idx !== index));
    setIngredientRailIndex(null);
  };

  return (
    <motion.section
      className="recipe-shell screen-layer"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      style={{ transformOrigin: 'center center' }}
      onTouchStart={(event) => {
        pinch.onTouchStart(event);
      }}
      onTouchMove={(event) => {
        pinch.onTouchMove(event);
      }}
      onTouchEnd={() => {
        pinch.onTouchEnd();
      }}
      onTouchCancel={() => {
        pinch.onTouchCancel();
      }}
    >
      <header className="recipe-header">
        <div className="recipe-title-row">
          <h1
            onPointerDown={titleLongPress.onPointerDown}
            onPointerUp={titleLongPress.onPointerUp}
            onPointerCancel={titleLongPress.onPointerCancel}
            onPointerLeave={titleLongPress.onPointerLeave}
          >
            {recipe.title || 'Untitled recipe'}
          </h1>
          <button
            type="button"
            className="plain-icon-button"
            aria-label="Export recipe"
            onClick={() => exportRecipeToPdf(recipe)}
          >
            <Share2 size={16} />
          </button>
        </div>
        {(recipe.description ?? '').trim() ? <p className="recipe-description">{recipe.description}</p> : null}
        <div className="recipe-meta-row">
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
        </div>
      </header>

      <div className="recipe-content" ref={contentRef}>
        <div className="recipe-hero">
          <div className={`recipe-hero-image ${hasHeroImage ? 'has-image' : ''}`} role="presentation">
            {hasHeroImage ? (
              <img
                src={recipe.imageUrl}
                alt=""
                className="recipe-hero-image-img"
                loading="eager"
                decoding="async"
                draggable={false}
              />
            ) : null}
          </div>
          <div className="recipe-timing">
            <div>
              <span className="muted">Prep</span>
              <strong>{recipe.prepTime || '—'}</strong>
            </div>
            <div>
              <span className="muted">Cook</span>
              <strong>{recipe.cookTime || '—'}</strong>
            </div>
          </div>
        </div>
        {displayTags.length ? (
          <div className="recipe-tag-row recipe-tag-row-hero">
            {displayTags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
        ) : null}

        <section className="recipe-section">
          <h2>Ingredients</h2>
          {(recipe.ingredients ?? []).length ? (
            <ul className="recipe-ingredients-list">
              {(recipe.ingredients ?? []).map((item, index) => (
                <IngredientItem
                  key={`${item}-${index}`}
                  item={item}
                  isDone={ingredientDone[index]}
                  showActions={ingredientRailIndex === index}
                  onSwipeLeft={() => handleIngredientSwipeLeft(index)}
                  onSwipeRight={() => toggleIngredientDone(index)}
                  onEdit={() => handleEditIngredient(index)}
                  onDelete={() => handleDeleteIngredient(index)}
                />
              ))}
            </ul>
          ) : (
            <p className="muted">No ingredients yet.</p>
          )}
        </section>

        <section className="recipe-section">
          <h2>Steps</h2>
          {(recipe.steps ?? []).length ? (
            <ol className="recipe-steps-list">
              {(recipe.steps ?? []).map((item, index) => (
                <StepItem
                  key={`${item}-${index}`}
                  item={item}
                  isDone={stepDone[index]}
                  onSwipeRight={() => toggleStepDone(index)}
                />
              ))}
            </ol>
          ) : (
            <p className="muted">No steps yet.</p>
          )}
        </section>

        <section className="recipe-section">
          <h2>Notes</h2>
          {(recipe.notes ?? '').trim() ? <p>{recipe.notes}</p> : <p className="muted">No notes yet.</p>}
        </section>
      </div>

      <div
        className="recipe-nav"
        onPointerDown={navLongPress.onPointerDown}
        onPointerUp={navLongPress.onPointerUp}
        onPointerCancel={navLongPress.onPointerCancel}
        onPointerLeave={navLongPress.onPointerLeave}
      >
        <button
          type="button"
          className="recipe-nav-icon"
          onClick={() => setPeekPanel('ingredients')}
          aria-label="Ingredients"
        >
          <Utensils size={navIconSize} />
        </button>
        <button
          type="button"
          className="recipe-nav-icon"
          onClick={() => setPeekPanel('notes')}
          aria-label="Notes"
        >
          <StickyNote size={navIconSize} />
        </button>
        <button
          type="button"
          className="recipe-nav-icon"
          onClick={() => setPeekPanel('nutrients')}
          aria-label="Nutrients"
        >
          <Leaf size={navIconSize} />
        </button>
        <button type="button" className="recipe-nav-icon recipe-nav-spacer" aria-label="Cook mode">
          <ChefHat size={navIconSize} />
        </button>
        <button
          type="button"
          className="recipe-nav-icon"
          onClick={() => setPeekPanel('timer')}
          aria-label="Timer"
        >
          {timerEndsAt ? (
            <span className="timer-dial" style={{ '--progress': timerProgress } as CSSProperties}>
              <span className="timer-dial-inner" />
            </span>
          ) : (
            <Timer size={navIconSize} />
          )}
        </button>
      </div>

      {peekPanel ? (
        <div
          className="recipe-peek-overlay"
          onClick={() => {
            setPeekPanel(null);
          }}
        >
          <div
            className="recipe-peek-card"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            {peekPanel === 'ingredients' ? (
              <>
                <h3>Ingredients</h3>
                {(recipe.ingredients ?? []).length ? (
                  <ul className="recipe-peek-list">
                    {(recipe.ingredients ?? []).map((item, index) => (
                      <li
                        key={`${item}-${index}`}
                        className={ingredientDone[index] ? 'is-done' : undefined}
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No ingredients yet.</p>
                )}
              </>
            ) : null}

            {peekPanel === 'notes' ? (
              <>
                <h3>Notes</h3>
                {(recipe.notes ?? '').trim() ? <p>{recipe.notes}</p> : <p className="muted">No notes yet.</p>}
              </>
            ) : null}

            {peekPanel === 'nutrients' ? (
              <>
                <h3>Nutrients</h3>
                {(recipe.nutrients ?? []).length ? (
                  <ul className="recipe-peek-list">
                    {(recipe.nutrients ?? []).map((item, index) => (
                      <li key={`${item}-${index}`}>{item}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">No nutrients yet.</p>
                )}
              </>
            ) : null}

            {peekPanel === 'timer' ? (
              <>
                <h3>Timer</h3>
                {timerEndsAt ? (
                  <div className="timer-readout">
                    <strong>
                      {remainingMinutes}:{remainingDisplaySeconds.toString().padStart(2, '0')}
                    </strong>
                    <button type="button" className="ghost-button" onClick={stopTimer}>
                      Stop
                    </button>
                  </div>
                ) : (
                  <div className="timer-controls">
                    <label className="form-field">
                      <span className="field-label">Minutes</span>
                      <input
                        type="number"
                        min={1}
                        max={240}
                        value={timerMinutes}
                        onChange={(event) => setTimerMinutes(Number(event.target.value))}
                        className="list-input"
                      />
                    </label>
                    <div className="timer-presets">
                      {[5, 10, 15, 20].map((minutes) => (
                        <button
                          key={minutes}
                          type="button"
                          className="ghost-button"
                          onClick={() => setTimerMinutes(minutes)}
                        >
                          {minutes}m
                        </button>
                      ))}
                    </div>
                    <button type="button" className="solid-button" onClick={startTimer}>
                      Start timer
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      ) : null}

    </motion.section>
  );
};
