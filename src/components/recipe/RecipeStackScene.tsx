import { motion } from 'framer-motion';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
  type PointerEvent as ReactPointerEvent
} from 'react';
import type { Recipe } from '../../types/models';
import { formatCookedDate } from '../../utils/recipes';
import { RecipeStackArticleLayout } from './RecipeStackArticleLayout';
import {
  resolveStackGestureAxis,
  resolveStackSwipeDirection,
  STACK_CARD_TRANSITION_MS
} from './recipeStackGesture';

interface RecipeStackSceneProps {
  recipes: Recipe[];
  selectedRecipeId: string | null;
  onSelectRecipe: (recipeId: string) => void;
  onOpenRecipe: (recipe: Recipe) => void;
}

type StackGesturePhase = 'idle' | 'deciding' | 'scrolling' | 'swiping' | 'settling';

interface ActivePointerGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startedAt: number;
  width: number;
}

const STACK_PREVIEW_LIMIT = 2;

const collectPreviewCuisines = (recipe: Recipe): string[] => {
  const seen = new Set<string>();
  const cuisines: string[] = [];

  for (const item of recipe.cuisines ?? []) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    cuisines.push(trimmed);

    if (cuisines.length >= 2) {
      break;
    }
  }

  return cuisines;
};

const buildUniqueRecipeList = (recipes: Array<Recipe | null | undefined>, limit: number): Recipe[] => {
  const seen = new Set<string>();
  const ordered: Recipe[] = [];

  for (const recipe of recipes) {
    if (!recipe || seen.has(recipe.id)) {
      continue;
    }

    seen.add(recipe.id);
    ordered.push(recipe);

    if (ordered.length >= limit) {
      break;
    }
  }

  return ordered;
};

const StackPreviewCard = ({
  recipe,
  depth,
  active
}: {
  recipe: Recipe;
  depth: number;
  active?: boolean;
}): JSX.Element => {
  const previewIngredients = recipe.ingredients.slice(0, 2);
  const previewCuisines = collectPreviewCuisines(recipe);

  return (
    <div
      className={`recipe-stack-preview ${active ? 'is-active-preview' : ''} ${recipe.imageUrl ? 'has-image' : 'no-image'}`}
      style={{
        transform: `translateY(${depth * 14}px) scale(${1 - depth * 0.03})`,
        opacity: Math.max(0.18, 0.72 - depth * 0.18),
        zIndex: 3 - depth
      }}
      aria-hidden="true"
    >
      <div className="recipe-stack-preview-card">
        <div className="recipe-stack-preview-media">
          {recipe.imageUrl ? <img src={recipe.imageUrl} alt="" className="recipe-stack-preview-image" /> : null}
        </div>

        <div className="recipe-stack-preview-copy">
          <strong>{recipe.title || 'Untitled recipe'}</strong>
          {previewCuisines.length ? (
            <div className="recipe-stack-preview-cuisines">
              {previewCuisines.map((cuisine) => (
                <span key={cuisine}>{cuisine}</span>
              ))}
            </div>
          ) : null}
          <span>Last cooked: {formatCookedDate(recipe.lastCooked)}</span>
          {previewIngredients.length ? (
            <ul className="recipe-stack-preview-ingredients">
              {previewIngredients.map((ingredient, index) => (
                <li key={`${ingredient}-${index}`}>{ingredient}</li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const renderReadOnlyIngredients = (ingredients: string[]): JSX.Element => {
  if (!ingredients.length) {
    return <p className="muted">No ingredients yet.</p>;
  }

  return (
    <ul className="recipe-ingredients-list recipe-ingredients-readonly">
      {ingredients.map((item, index) => (
        <li key={`${item}-${index}`} className="recipe-item-row">
          <span className="recipe-item-text">{item}</span>
        </li>
      ))}
    </ul>
  );
};

const renderReadOnlySteps = (steps: string[]): JSX.Element => {
  if (!steps.length) {
    return <p className="muted">No steps yet.</p>;
  }

  return (
    <ol className="recipe-steps-list">
      {steps.map((item, index) => (
        <li key={`${item}-${index}`} className="recipe-step-item">
          {item}
        </li>
      ))}
    </ol>
  );
};

export const RecipeStackScene = ({
  recipes,
  selectedRecipeId,
  onSelectRecipe,
  onOpenRecipe
}: RecipeStackSceneProps): JSX.Element => {
  const activeCardRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<ActivePointerGesture | null>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const settleTimeoutRef = useRef<number | null>(null);
  const [gesturePhase, setGesturePhase] = useState<StackGesturePhase>('idle');
  const [cardOffsetX, setCardOffsetX] = useState(0);
  const [transitionMs, setTransitionMs] = useState(0);

  const activeIndex = useMemo(() => {
    if (!recipes.length) {
      return -1;
    }

    const selectedIndex = selectedRecipeId
      ? recipes.findIndex((recipe) => recipe.id === selectedRecipeId)
      : -1;

    return selectedIndex >= 0 ? selectedIndex : 0;
  }, [recipes, selectedRecipeId]);

  const getWrappedRecipe = useCallback(
    (offset: number): Recipe | null => {
      if (activeIndex < 0 || recipes.length <= 1) {
        return null;
      }

      const normalizedIndex = (activeIndex + offset + recipes.length) % recipes.length;
      return recipes[normalizedIndex] ?? null;
    },
    [activeIndex, recipes]
  );

  const activeRecipe = activeIndex >= 0 ? recipes[activeIndex] : null;
  const previousRecipe = getWrappedRecipe(-1);
  const upcomingRecipes = useMemo(() => {
    if (activeIndex < 0 || recipes.length <= 1) {
      return [];
    }

    const nextRecipes: Recipe[] = [];
    const previewCount = Math.min(STACK_PREVIEW_LIMIT, recipes.length - 1);

    for (let offset = 1; offset <= previewCount; offset += 1) {
      const recipe = getWrappedRecipe(offset);
      if (recipe) {
        nextRecipes.push(recipe);
      }
    }

    return nextRecipes;
  }, [activeIndex, getWrappedRecipe, recipes.length]);

  const visiblePreviewRecipes = useMemo(() => {
    if (cardOffsetX > 12 && previousRecipe) {
      return buildUniqueRecipeList([previousRecipe, ...upcomingRecipes], STACK_PREVIEW_LIMIT);
    }

    return upcomingRecipes;
  }, [cardOffsetX, previousRecipe, upcomingRecipes]);

  useEffect(() => {
    return () => {
      if (settleTimeoutRef.current !== null) {
        window.clearTimeout(settleTimeoutRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    if (!activeRecipe || !bodyRef.current) {
      return;
    }

    const body = bodyRef.current;
    body.scrollTop = scrollPositionsRef.current[activeRecipe.id] ?? 0;
  }, [activeRecipe?.id]);

  useEffect(() => {
    if (settleTimeoutRef.current !== null) {
      return;
    }

    setCardOffsetX(0);
    setTransitionMs(0);
    setGesturePhase('idle');
  }, [activeRecipe?.id]);

  const resetGesture = (withTransition: boolean) => {
    gestureRef.current = null;
    setGesturePhase('idle');
    setTransitionMs(withTransition ? STACK_CARD_TRANSITION_MS : 0);
    setCardOffsetX(0);
  };

  const settleToRecipe = (recipeId: string, direction: -1 | 1, width: number) => {
    if (!activeRecipe) {
      return;
    }

    setGesturePhase('settling');
    setTransitionMs(STACK_CARD_TRANSITION_MS);
    setCardOffsetX(direction < 0 ? -width : width);
    settleTimeoutRef.current = window.setTimeout(() => {
      settleTimeoutRef.current = null;
      onSelectRecipe(recipeId);
      gestureRef.current = null;
      setTransitionMs(0);
      setCardOffsetX(0);
      setGesturePhase('idle');
    }, STACK_CARD_TRANSITION_MS);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!activeRecipe || gesturePhase === 'settling') {
      return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    if (event.target instanceof Element && event.target.closest('.recipe-stack-footer')) {
      return;
    }

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      width: activeCardRef.current?.clientWidth ?? window.innerWidth
    };
    setTransitionMs(0);
    setGesturePhase('deciding');
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId || gesturePhase === 'settling') {
      return;
    }

    const deltaX = event.clientX - gesture.startX;
    const deltaY = event.clientY - gesture.startY;

    if (gesturePhase === 'deciding') {
      const axis = resolveStackGestureAxis(deltaX, deltaY);
      if (axis === 'x') {
        setGesturePhase('swiping');
      } else if (axis === 'y') {
        setGesturePhase('scrolling');
      } else {
        return;
      }
    }

    if (gesturePhase === 'scrolling') {
      return;
    }

    event.preventDefault();
    setCardOffsetX(deltaX);
  };

  const handlePointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    const elapsedMs = Math.max(1, performance.now() - gesture.startedAt);
    const deltaX = event.clientX - gesture.startX;

    if (gesturePhase === 'swiping') {
      const direction = resolveStackSwipeDirection(deltaX, elapsedMs, gesture.width);
      const targetRecipeId =
        direction < 0
          ? getWrappedRecipe(1)?.id ?? null
          : direction > 0
            ? getWrappedRecipe(-1)?.id ?? null
            : null;

      if (direction !== 0 && targetRecipeId) {
        settleToRecipe(targetRecipeId, direction, gesture.width);
        return;
      }

      resetGesture(true);
      return;
    }

    resetGesture(false);
  };

  const handlePointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) {
      return;
    }

    resetGesture(false);
  };

  const handleOpenActiveRecipe = () => {
    if (!activeRecipe || gesturePhase === 'settling') {
      return;
    }

    onOpenRecipe(activeRecipe);
  };

  const handleBodyScroll = (event: UIEvent<HTMLDivElement>) => {
    if (!activeRecipe) {
      return;
    }

    scrollPositionsRef.current[activeRecipe.id] = event.currentTarget.scrollTop;
  };

  const swipeZoneHandlers = {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerEnd,
    onPointerCancel: handlePointerCancel
  };

  if (!activeRecipe) {
    return <div className="recipe-stack-empty muted">No recipes yet.</div>;
  }

  const rotation = Math.max(-8, Math.min(8, cardOffsetX / 36));

  return (
    <div className="recipe-stack-scene">
      <div className="recipe-stack-stage">
        {visiblePreviewRecipes
          .slice()
          .reverse()
          .map((recipe, index, collection) => (
            <StackPreviewCard
              key={recipe.id}
              recipe={recipe}
              depth={collection.length - index}
              active={cardOffsetX > 12 && previousRecipe?.id === recipe.id}
            />
          ))}

        <motion.div
          ref={activeCardRef}
          className="recipe-stack-card"
          style={{
            transform: `translateX(${cardOffsetX}px) rotate(${rotation}deg)`,
            transitionDuration: `${transitionMs}ms`
          }}
        >
          <RecipeStackArticleLayout
            recipe={activeRecipe}
            bodyRef={bodyRef}
            onBodyScroll={handleBodyScroll}
            headerSwipeZoneProps={swipeZoneHandlers}
            ingredientsContent={renderReadOnlyIngredients(activeRecipe.ingredients)}
            stepsContent={renderReadOnlySteps(activeRecipe.steps)}
            onOpenRecipe={handleOpenActiveRecipe}
          />
          <div className="recipe-stack-gutter recipe-stack-gutter-left" aria-hidden="true" {...swipeZoneHandlers} />
          <div className="recipe-stack-gutter recipe-stack-gutter-right" aria-hidden="true" {...swipeZoneHandlers} />
        </motion.div>
      </div>
    </div>
  );
};
