import { motion } from 'framer-motion';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from 'react';
import type { Recipe } from '../../types/models';
import { formatCookedDate } from '../../utils/recipes';
import { RecipeArticleLayout } from './RecipeArticleLayout';
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
const STACK_TAP_MOVE_TOLERANCE_PX = 8;

const StackPreviewCard = ({
  recipe,
  depth,
  active
}: {
  recipe: Recipe;
  depth: number;
  active?: boolean;
}): JSX.Element => {
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
      <div className="recipe-stack-preview-media">
        {recipe.imageUrl ? <img src={recipe.imageUrl} alt="" className="recipe-stack-preview-image" /> : null}
      </div>
      <div className="recipe-stack-preview-copy">
        <strong>{recipe.title || 'Untitled recipe'}</strong>
        <span>Last cooked: {formatCookedDate(recipe.lastCooked)}</span>
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
  const contentRef = useRef<HTMLDivElement | null>(null);
  const gestureRef = useRef<ActivePointerGesture | null>(null);
  const scrollPositionsRef = useRef<Record<string, number>>({});
  const settleTimeoutRef = useRef<number | null>(null);
  const tapOpenEligibleRef = useRef(false);
  const gestureStartScrollTopRef = useRef(0);
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

  const activeRecipe = activeIndex >= 0 ? recipes[activeIndex] : null;
  const previousRecipe = activeIndex > 0 ? recipes[activeIndex - 1] : null;
  const upcomingRecipes = activeIndex >= 0 ? recipes.slice(activeIndex + 1, activeIndex + 1 + STACK_PREVIEW_LIMIT) : [];

  const visiblePreviewRecipes = useMemo(() => {
    if (cardOffsetX > 12 && previousRecipe) {
      return [previousRecipe, ...upcomingRecipes.slice(0, STACK_PREVIEW_LIMIT - 1)];
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
    if (!activeRecipe || !contentRef.current) {
      return;
    }

    const content = contentRef.current;
    content.scrollTop = scrollPositionsRef.current[activeRecipe.id] ?? 0;
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

    gestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startedAt: performance.now(),
      width: activeCardRef.current?.clientWidth ?? window.innerWidth
    };
    tapOpenEligibleRef.current = true;
    gestureStartScrollTopRef.current = contentRef.current?.scrollTop ?? 0;
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
    const movedTooFar =
      Math.abs(deltaX) > STACK_TAP_MOVE_TOLERANCE_PX || Math.abs(deltaY) > STACK_TAP_MOVE_TOLERANCE_PX;

    if (movedTooFar) {
      tapOpenEligibleRef.current = false;
    }

    if (gesturePhase === 'deciding') {
      const axis = resolveStackGestureAxis(deltaX, deltaY);
      if (axis === 'x') {
        setGesturePhase('swiping');
        tapOpenEligibleRef.current = false;
      } else if (axis === 'y') {
        setGesturePhase('scrolling');
        tapOpenEligibleRef.current = false;
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
        direction < 0 ? recipes[activeIndex + 1]?.id ?? null : direction > 0 ? recipes[activeIndex - 1]?.id ?? null : null;

      if (direction !== 0 && targetRecipeId) {
        tapOpenEligibleRef.current = false;
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

    tapOpenEligibleRef.current = false;
    resetGesture(false);
  };

  const openActiveRecipeNow = () => {
    if (!activeRecipe || gesturePhase === 'settling') {
      return;
    }

    tapOpenEligibleRef.current = false;
    onOpenRecipe(activeRecipe);
  };

  const handleTapOpenActiveRecipe = () => {
    if (!tapOpenEligibleRef.current) {
      return;
    }

    openActiveRecipeNow();
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
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerCancel}
        >
          <RecipeArticleLayout
            recipe={activeRecipe}
            contentRef={contentRef}
            contentClassName="recipe-stack-content"
            headerProps={{
              role: 'button',
              tabIndex: 0,
              className: 'recipe-header recipe-stack-open-zone',
              onClick: handleTapOpenActiveRecipe,
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openActiveRecipeNow();
                }
              }
            }}
            heroProps={{
              role: 'button',
              tabIndex: 0,
              className: 'recipe-hero recipe-stack-open-zone',
              onClick: handleTapOpenActiveRecipe,
              onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openActiveRecipeNow();
                }
              }
            }}
            contentProps={{
              onScroll: (event) => {
                scrollPositionsRef.current[activeRecipe.id] = event.currentTarget.scrollTop;
                if (
                  gestureRef.current &&
                  Math.abs(event.currentTarget.scrollTop - gestureStartScrollTopRef.current) > 1
                ) {
                  tapOpenEligibleRef.current = false;
                }
              }
            }}
            lastCookedControl={
              <span className="recipe-title-meta">Last cooked: {formatCookedDate(activeRecipe.lastCooked)}</span>
            }
            ingredientsContent={renderReadOnlyIngredients(activeRecipe.ingredients)}
            stepsContent={renderReadOnlySteps(activeRecipe.steps)}
            footer={
              <div className="recipe-stack-footer">
                <button
                  type="button"
                  className="solid-button recipe-stack-open-button"
                  onClick={openActiveRecipeNow}
                >
                  Let&apos;s cook
                </button>
              </div>
            }
          />
        </motion.div>
      </div>
    </div>
  );
};
