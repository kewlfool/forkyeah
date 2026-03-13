import { animate, motion, useMotionValue, useTransform } from 'framer-motion';
import { ChevronDown, LayoutGrid, List, Plus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHorizontalSwipe } from '../../hooks/useHorizontalSwipe';
import { useLongPress } from '../../hooks/useLongPress';
import type { Recipe, RecipeViewMode } from '../../types/models';
import { formatCookedDate } from '../../utils/recipes';

interface RecipeDeckScreenProps {
  recipes: Recipe[];
  deckRecipes?: Recipe[];
  activeRecipe: Recipe;
  viewMode: RecipeViewMode;
  onOpenRecipe: (recipe: Recipe) => void;
  onMoveRecipe: (offset: 1 | -1) => void;
  onImport: () => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipeId: string) => void;
  onSetViewMode: (mode: RecipeViewMode) => void;
  onRequestImage: (recipeId: string) => void;
  onClearImagePrompt: () => void;
  showImportFab?: boolean;
}

const collectTags = (recipe: Recipe): string[] => {
  const deduped = new Set<string>();
  for (const item of [...(recipe.categories ?? []), ...(recipe.cuisines ?? []), ...(recipe.tags ?? [])]) {
    const trimmed = item.trim();
    if (trimmed) {
      deduped.add(trimmed);
    }
  }
  return Array.from(deduped);
};

const viewModeOrder: RecipeViewMode[] = ['scroll', 'card', 'list'];

const modeIcon = (mode: RecipeViewMode): JSX.Element => {
  if (mode === 'scroll') {
    return <ChevronDown size={17} />;
  }
  if (mode === 'list') {
    return <List size={17} />;
  }

  return <LayoutGrid size={17} />;
};

const stackOffsetForDepth = (depth: number, height: number): { x: number; y: number } => {
  const yStep = Math.min(18, height * 0.04);
  return {
    x: 0,
    y: yStep * depth
  };
};

export const RecipeDeckScreen = ({
  recipes,
  deckRecipes,
  activeRecipe,
  viewMode,
  onOpenRecipe,
  onMoveRecipe,
  onImport,
  onEdit,
  onDelete,
  onSetViewMode,
  onRequestImage,
  onClearImagePrompt,
  showImportFab = true
}: RecipeDeckScreenProps): JSX.Element => {
  const [jigglingRecipeId, setJigglingRecipeId] = useState<string | null>(null);
  const swipeLockRef = useRef(false);
  const suppressClickRef = useRef(false);
  const longPressAtRef = useRef(0);
  const dragStateRef = useRef({ active: false, moved: false });
  const stackRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const isScrollingRef = useRef(false);
  const scrollStopTimeoutRef = useRef<number | null>(null);
  const [stackSize, setStackSize] = useState({ width: 0, height: 0 });
  const dragX = useMotionValue(0);
  const dragRotate = useTransform(dragX, [-180, 0, 180], [0, 0, 0]);
  const dragRotateY = useTransform(dragX, [-180, 0, 180], [0, 0, 0]);
  const cardTiltX = 0;
  const dragThreshold = 160;
  const cardRecipes = deckRecipes && deckRecipes.length ? deckRecipes : recipes;
  const totalCount = recipes.length;
  const isActiveJiggling = jigglingRecipeId === activeRecipe.id;

  const registerCardRef = useCallback((recipeId: string) => {
    return (node: HTMLElement | null) => {
      if (node) {
        cardRefs.current.set(recipeId, node);
      } else {
        cardRefs.current.delete(recipeId);
      }
    };
  }, []);

  const longPress = useLongPress({
    onLongPress: () => {
      if (jigglingRecipeId) {
        return;
      }
      longPressAtRef.current = Date.now();
      suppressClickRef.current = true;
      setJigglingRecipeId(activeRecipe.id);
    },
    delay: 430
  });

  useEffect(() => {
    setJigglingRecipeId(null);
    dragX.set(0);
    swipeLockRef.current = false;
    dragStateRef.current = { active: false, moved: false };
  }, [activeRecipe.id, viewMode]);

  useEffect(() => {
    if (!jigglingRecipeId) {
      return;
    }

    const handleOutsideTap = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const activeCard = cardRefs.current.get(jigglingRecipeId);
      if (activeCard && activeCard.contains(target)) {
        return;
      }
      setJigglingRecipeId(null);
    };

    document.addEventListener('mousedown', handleOutsideTap);
    document.addEventListener('touchstart', handleOutsideTap, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleOutsideTap);
      document.removeEventListener('touchstart', handleOutsideTap);
    };
  }, [jigglingRecipeId]);

  useEffect(() => {
    const element = stackRef.current;
    if (!element) {
      return;
    }

    const updateSize = () => {
      setStackSize({ width: element.offsetWidth, height: element.offsetHeight });
    };

    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    return () => {
      if (scrollStopTimeoutRef.current !== null) {
        window.clearTimeout(scrollStopTimeoutRef.current);
      }
    };
  }, []);

  const activeIndex = useMemo(() => {
    const index = cardRecipes.findIndex((recipe) => recipe.id === activeRecipe.id);
    return index >= 0 ? index : 0;
  }, [activeRecipe.id, cardRecipes]);

  const canSwipe = cardRecipes.length > 1;
  const wrapIndex = (index: number) => (index + cardRecipes.length) % cardRecipes.length;
  const nextRecipe = canSwipe ? cardRecipes[wrapIndex(activeIndex + 1)] : null;
  const prevRecipe = canSwipe ? cardRecipes[wrapIndex(activeIndex - 1)] : null;
  const nextRecipe2 = cardRecipes.length > 2 ? cardRecipes[wrapIndex(activeIndex + 2)] : null;
  const prevRecipe2 = cardRecipes.length > 3 ? cardRecipes[wrapIndex(activeIndex - 2)] : null;

  const stackItems = useMemo(() => {
    const items: Array<{ recipe: Recipe; role: string; depth: number }> = [];
    const seen = new Set<string>();
    const add = (recipe: Recipe | null, role: string) => {
      if (!recipe || seen.has(recipe.id)) {
        return;
      }
      items.push({ recipe, role, depth: items.length + 1 });
      seen.add(recipe.id);
    };

    add(nextRecipe, 'next1');
    add(prevRecipe, 'prev1');
    add(nextRecipe2, 'next2');
    add(prevRecipe2, 'prev2');
    return items.slice(0, 4);
  }, [nextRecipe, prevRecipe, nextRecipe2, prevRecipe2]);

  const stackMetrics = useMemo(() => {
    const height = stackSize.height || 420;
    const baseScales = [0.985, 0.97, 0.955, 0.94];
    const baseOpacities = [1, 1, 1, 1];

    return stackItems.map((item, index) => {
      const offset = stackOffsetForDepth(item.depth, height);
      return {
        ...item,
        offset,
        scale: baseScales[index] ?? 0.9,
        opacity: baseOpacities[index] ?? 0.4
      };
    });
  }, [stackItems, stackSize.height, stackSize.width]);

  const nextPrimary = stackMetrics.find((item) => item.role === 'next1') ?? null;
  const prevPrimary = stackMetrics.find((item) => item.role === 'prev1') ?? null;

  const nextPrimaryX = useTransform(
    dragX,
    [-dragThreshold, 0, dragThreshold],
    [0, nextPrimary?.offset.x ?? 0, (nextPrimary?.offset.x ?? 0) * 1.05]
  );
  const nextPrimaryY = useTransform(
    dragX,
    [-dragThreshold, 0, dragThreshold],
    [0, nextPrimary?.offset.y ?? 0, (nextPrimary?.offset.y ?? 0) * 1.05]
  );
  const nextPrimaryScale = useTransform(
    dragX,
    [-dragThreshold, 0, dragThreshold],
    [1, nextPrimary?.scale ?? 0.96, (nextPrimary?.scale ?? 0.96) - 0.02]
  );
  const nextPrimaryOpacity = useTransform(dragX, [-dragThreshold, 0, dragThreshold], [1, 1, 1]);

  const prevPrimaryX = useTransform(
    dragX,
    [-dragThreshold, 0, dragThreshold],
    [(prevPrimary?.offset.x ?? 0) * 1.05, prevPrimary?.offset.x ?? 0, 0]
  );
  const prevPrimaryY = useTransform(
    dragX,
    [-dragThreshold, 0, dragThreshold],
    [(prevPrimary?.offset.y ?? 0) * 1.05, prevPrimary?.offset.y ?? 0, 0]
  );
  const prevPrimaryScale = useTransform(
    dragX,
    [-dragThreshold, 0, dragThreshold],
    [(prevPrimary?.scale ?? 0.96) - 0.02, prevPrimary?.scale ?? 0.96, 1]
  );
  const prevPrimaryOpacity = useTransform(dragX, [-dragThreshold, 0, dragThreshold], [1, 1, 1]);

  const handleScroll = () => {
    isScrollingRef.current = true;
    if (jigglingRecipeId) {
      setJigglingRecipeId(null);
    }
    if (scrollStopTimeoutRef.current !== null) {
      window.clearTimeout(scrollStopTimeoutRef.current);
    }
    scrollStopTimeoutRef.current = window.setTimeout(() => {
      isScrollingRef.current = false;
    }, 140);
  };

  const handleCardClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (isActiveJiggling) {
      return;
    }

    onOpenRecipe(activeRecipe);
  };

  const beginEdit = (recipe: Recipe) => {
    if (dragStateRef.current.active) {
      dragStateRef.current.active = false;
    }
    dragStateRef.current.moved = false;
    dragX.set(0);
    swipeLockRef.current = false;
    requestAnimationFrame(() => {
      onEdit(recipe);
    });
  };

  const handleCardTap = () => {
    const moved = dragStateRef.current.moved || Math.abs(dragX.get()) > 8;
    if (dragStateRef.current.active || moved) {
      dragStateRef.current.moved = false;
      return;
    }

    if (isActiveJiggling) {
      if (Date.now() - longPressAtRef.current < 260) {
        return;
      }
      onClearImagePrompt();
      setJigglingRecipeId(null);
      beginEdit(activeRecipe);
      return;
    }

    handleCardClick();
  };

  const handleDragStart = () => {
    dragStateRef.current.active = true;
  };

  const handleDrag = () => {
    if (Math.abs(dragX.get()) > 8) {
      dragStateRef.current.moved = true;
    }
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    dragStateRef.current.active = false;
    dragStateRef.current.moved = false;
    if (swipeLockRef.current) {
      dragX.set(0);
      return;
    }

    const offsetX = info.offset.x;
    const velocityX = info.velocity.x;
    const threshold = 140;
    const velocityThreshold = 900;

    if (isActiveJiggling) {
      const shouldDelete = offsetX < -threshold || velocityX < -velocityThreshold;
      if (shouldDelete) {
        swipeLockRef.current = true;
        void animate(dragX, -window.innerWidth * 0.8, {
          duration: 0.16,
          ease: 'easeOut'
        }).then(() => {
          setJigglingRecipeId(null);
          onClearImagePrompt();
          onDelete(activeRecipe.id);
          dragX.set(0);
          swipeLockRef.current = false;
        });
        return;
      }

      void animate(dragX, 0, { duration: 0.18, ease: 'easeOut' });
      return;
    }

    if (!canSwipe) {
      dragX.set(0);
      return;
    }

    if (Math.abs(offsetX) > threshold || Math.abs(velocityX) > velocityThreshold) {
      swipeLockRef.current = true;
      const direction = offsetX < 0 || velocityX < -velocityThreshold ? 1 : -1;
      const targetX = direction === 1 ? -window.innerWidth * 0.7 : window.innerWidth * 0.7;

      void animate(dragX, targetX, {
        duration: 0.18,
        ease: 'easeOut'
      }).then(() => {
        onMoveRecipe(direction as 1 | -1);
        dragX.set(0);
        swipeLockRef.current = false;
      });
    } else {
      void animate(dragX, 0, { duration: 0.2, ease: 'easeOut' });
    }
  };

  const cycleViewMode = () => {
    const currentIndex = viewModeOrder.indexOf(viewMode);
    const nextMode = viewModeOrder[(currentIndex + 1) % viewModeOrder.length];
    onSetViewMode(nextMode);
  };

  return (
    <motion.section
      className="overview-shell recipe-deck-shell screen-layer"
      initial={{ opacity: 0, scale: 0.99 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.99 }}
    >
      <header className="overview-header overview-header-flat">
        <h1>Forkyeah</h1>
        <div className="header-actions">
          <span className="recipe-total-count" aria-label={`Total recipes ${totalCount}`}>
            {totalCount}
          </span>
        </div>
      </header>

      {viewMode === 'card' ? (
        <div className="recipe-deck">
          <div className="recipe-card-stack" ref={stackRef}>
            {stackMetrics.map((item, index) => {
              const zIndex = item.role === 'next1' || item.role === 'prev1' ? 40 : 34 - index * 4;
              if (item.role === 'next1') {
                return (
                  <motion.article
                    key={`stack-${item.recipe.id}-${item.role}`}
                  className="recipe-card recipe-card-back recipe-card-back-next"
                  aria-hidden="true"
                  style={{
                    x: nextPrimaryX,
                    y: nextPrimaryY,
                    scale: nextPrimaryScale,
                    opacity: nextPrimaryOpacity,
                    rotateX: 0,
                    rotateY: 0,
                    translateZ: 0,
                    zIndex
                  }}
                >
                    {renderRecipeCardContent(item.recipe)}
                  </motion.article>
                );
              }

              if (item.role === 'prev1') {
                return (
                  <motion.article
                    key={`stack-${item.recipe.id}-${item.role}`}
                  className="recipe-card recipe-card-back recipe-card-back-prev"
                  aria-hidden="true"
                  style={{
                    x: prevPrimaryX,
                    y: prevPrimaryY,
                    scale: prevPrimaryScale,
                    opacity: prevPrimaryOpacity,
                    rotateX: 0,
                    rotateY: 0,
                    translateZ: 0,
                    zIndex
                  }}
                >
                    {renderRecipeCardContent(item.recipe)}
                  </motion.article>
                );
              }

              return (
                <motion.article
                  key={`stack-${item.recipe.id}-${item.role}`}
                  className="recipe-card recipe-card-back"
                  aria-hidden="true"
                  style={{
                    x: item.offset.x,
                    y: item.offset.y,
                    scale: item.scale,
                    opacity: item.opacity,
                    rotateX: 0,
                    rotateY: 0,
                    translateZ: 0,
                    zIndex
                  }}
                >
                  {renderRecipeCardContent(item.recipe)}
                </motion.article>
              );
            })}
            <motion.article
              ref={registerCardRef(activeRecipe.id)}
              data-recipe-card-id={activeRecipe.id}
              className={`recipe-card recipe-card-front ${isActiveJiggling ? 'recipe-card-jiggle' : ''}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              onTap={handleCardTap}
              onPointerDown={(event) => {
                dragStateRef.current.moved = false;
                dragStateRef.current.active = false;
                longPress.onPointerDown(event);
              }}
              onPointerMove={longPress.onPointerMove}
              onPointerUp={longPress.onPointerUp}
              onPointerCancel={longPress.onPointerCancel}
              onPointerLeave={longPress.onPointerLeave}
              drag={canSwipe || isActiveJiggling ? 'x' : false}
              dragElastic={0.18}
              dragMomentum={false}
              onDragStart={handleDragStart}
              onDrag={handleDrag}
              onDragEnd={handleDragEnd}
              style={{
                x: dragX,
                rotate: dragRotate,
                rotateX: cardTiltX,
                rotateY: dragRotateY,
                translateZ: 0,
                zIndex: 50
              }}
              role="button"
              tabIndex={0}
              aria-label={`Open ${activeRecipe.title}`}
            >
              <div className={`recipe-card-inner ${isActiveJiggling ? 'is-jiggling' : ''}`}>
                {renderRecipeCardContent(activeRecipe)}

                {isActiveJiggling ? (
                  <button
                    type="button"
                    className="recipe-card-image-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRequestImage(activeRecipe.id);
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    onPointerUp={(event) => event.stopPropagation()}
                    aria-label="Change recipe thumbnail"
                  />
                ) : null}

              </div>
            </motion.article>
          </div>

        </div>
      ) : viewMode === 'scroll' ? (
        <div className="recipe-scroll-view" ref={scrollRef} onScroll={handleScroll}>
          <div className="recipe-scroll-stack">
            {cardRecipes.map((recipe, index) => (
              <ScrollRecipeCard
                key={recipe.id}
                recipe={recipe}
                isJiggling={jigglingRecipeId === recipe.id}
                canStartLongPress={() => !isScrollingRef.current}
                onStartJiggle={() => {
                  setJigglingRecipeId(recipe.id);
                }}
                onStopJiggle={() => setJigglingRecipeId(null)}
                onOpen={onOpenRecipe}
                onEdit={onEdit}
                onBeforeEdit={onClearImagePrompt}
                onDelete={onDelete}
                onRequestImage={(recipeId) => {
                  onRequestImage(recipeId);
                }}
                registerRef={registerCardRef(recipe.id)}
                zIndex={index}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="overview-list recipe-list-view has-floating-add">
          {cardRecipes.map((recipe) => (
            <RecipeRow
              key={recipe.id}
              recipe={recipe}
              isJiggling={jigglingRecipeId === recipe.id}
              onStartJiggle={() => setJigglingRecipeId(recipe.id)}
              onStopJiggle={() => setJigglingRecipeId(null)}
              onOpen={onOpenRecipe}
              onEdit={onEdit}
              onBeforeEdit={onClearImagePrompt}
              onDelete={onDelete}
              onRequestImage={(recipeId) => {
                onRequestImage(recipeId);
              }}
              registerRef={registerCardRef(recipe.id)}
            />
          ))}
        </div>
      )}

      <div className="deck-bottom-bar">
        <button
          type="button"
          className="plain-icon-button deck-view-button"
          onClick={cycleViewMode}
          aria-label="Switch recipe view mode"
        >
          {modeIcon(viewMode)}
        </button>
        {showImportFab ? (
          <button
            type="button"
            className="import-fab deck-import-button"
            aria-label="Import recipe"
            onClick={onImport}
          >
            <Plus size={20} />
          </button>
        ) : null}
      </div>

    </motion.section>
  );
};

const renderRecipeCardContent = (recipe: Recipe): JSX.Element => {
  const hasImage = Boolean(recipe.imageUrl);
  const tags = collectTags(recipe);
  return (
    <div className={`recipe-card-main ${hasImage ? 'has-image' : ''}`}>
      {hasImage ? (
        <div className="recipe-card-thumb" role="presentation">
          <img
            src={recipe.imageUrl}
            alt=""
            className="recipe-card-thumb-image"
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>
      ) : null}
      <div className="recipe-card-body">
        <strong>{recipe.title || 'Untitled recipe'}</strong>
        <div className="recipe-card-meta">
          {tags.length ? (
            <div className="recipe-card-tags">
              {tags.map((tag) => (
                <span key={tag} className="recipe-card-tag">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <span className="recipe-card-tag">No tag</span>
          )}
          <span className="recipe-card-date">Last cooked: {formatCookedDate(recipe.lastCooked)}</span>
        </div>
      </div>
    </div>
  );
};

const ScrollRecipeCard = ({
  recipe,
  isJiggling,
  canStartLongPress,
  onStartJiggle,
  onStopJiggle,
  onOpen,
  onEdit,
  onBeforeEdit,
  onDelete,
  onRequestImage,
  registerRef,
  zIndex
}: {
  recipe: Recipe;
  isJiggling: boolean;
  canStartLongPress: () => boolean;
  onStartJiggle: () => void;
  onStopJiggle: () => void;
  onOpen: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onBeforeEdit: () => void;
  onDelete: (recipeId: string) => void;
  onRequestImage: (recipeId: string) => void;
  registerRef: (node: HTMLElement | null) => void;
  zIndex: number;
}): JSX.Element => {
  const suppressClickRef = useRef(false);
  const longPressAtRef = useRef(0);
  const longPress = useLongPress({
    onLongPress: () => {
      if (!canStartLongPress()) {
        return;
      }
      suppressClickRef.current = true;
      longPressAtRef.current = Date.now();
      onStartJiggle();
    },
    delay: 430,
    shouldStart: () => canStartLongPress()
  });
  const swipe = useHorizontalSwipe({
    onSwipeLeft: () => {
      if (!isJiggling) {
        return;
      }
      suppressClickRef.current = true;
      onBeforeEdit();
      onStopJiggle();
      onDelete(recipe.id);
    },
    threshold: 64,
    disabled: !isJiggling
  });

  const handleTap = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (isJiggling) {
      if (Date.now() - longPressAtRef.current < 260) {
        return;
      }
      onBeforeEdit();
      onStopJiggle();
      beginEdit();
      return;
    }

    onOpen(recipe);
  };

  const beginEdit = () => {
    requestAnimationFrame(() => {
      onEdit(recipe);
    });
  };

  return (
    <article
      ref={registerRef}
      data-recipe-card-id={recipe.id}
      className={`recipe-card recipe-scroll-card ${isJiggling ? 'recipe-card-jiggle' : ''}`}
      style={{ zIndex }}
      onClick={handleTap}
      onTouchStart={swipe.onTouchStart}
      onTouchMove={swipe.onTouchMove}
      onTouchEnd={swipe.onTouchEnd}
      onTouchCancel={swipe.onTouchCancel}
      onPointerDown={longPress.onPointerDown}
      onPointerMove={longPress.onPointerMove}
      onPointerUp={longPress.onPointerUp}
      onPointerCancel={longPress.onPointerCancel}
      onPointerLeave={longPress.onPointerLeave}
      role="button"
      tabIndex={0}
      aria-label={`Open ${recipe.title}`}
    >
      <div className={`recipe-card-inner ${isJiggling ? 'is-jiggling' : ''}`}>
        {renderRecipeCardContent(recipe)}

        {isJiggling ? (
          <button
            type="button"
            className="recipe-card-image-button"
            onClick={(event) => {
              event.stopPropagation();
              onRequestImage(recipe.id);
            }}
            onPointerDown={(event) => event.stopPropagation()}
            onPointerUp={(event) => event.stopPropagation()}
            aria-label="Change recipe thumbnail"
          />
        ) : null}
      </div>
    </article>
  );
};

const RecipeRow = ({
  recipe,
  isJiggling,
  onStartJiggle,
  onStopJiggle,
  onOpen,
  onEdit,
  onBeforeEdit,
  onDelete,
  onRequestImage,
  registerRef
}: {
  recipe: Recipe;
  isJiggling: boolean;
  onStartJiggle: () => void;
  onStopJiggle: () => void;
  onOpen: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onBeforeEdit: () => void;
  onDelete: (recipeId: string) => void;
  onRequestImage: (recipeId: string) => void;
  registerRef: (node: HTMLElement | null) => void;
}): JSX.Element => {
  const tags = collectTags(recipe);
  const suppressClickRef = useRef(false);
  const longPressAtRef = useRef(0);
  const longPress = useLongPress({
    onLongPress: () => {
      suppressClickRef.current = true;
      longPressAtRef.current = Date.now();
      onStartJiggle();
    },
    delay: 430
  });
  const swipe = useHorizontalSwipe({
    onSwipeLeft: () => {
      if (!isJiggling) {
        return;
      }
      suppressClickRef.current = true;
      onBeforeEdit();
      onStopJiggle();
      onDelete(recipe.id);
    },
    threshold: 64,
    disabled: !isJiggling
  });

  const handleRowClick = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (isJiggling) {
      if (Date.now() - longPressAtRef.current < 260) {
        return;
      }
      onBeforeEdit();
      onStopJiggle();
      beginEdit();
      return;
    }

    onOpen(recipe);
  };

  const beginEdit = () => {
    requestAnimationFrame(() => {
      onEdit(recipe);
    });
  };

  return (
    <article
      ref={registerRef}
      data-recipe-card-id={recipe.id}
      className={`row-card recipe-row-card ${isJiggling ? 'recipe-row-jiggle' : ''}`}
    >
      <div
        role="button"
        tabIndex={0}
        className="row-card-main"
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
        onTouchCancel={swipe.onTouchCancel}
        onPointerDown={longPress.onPointerDown}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onPointerLeave={longPress.onPointerLeave}
        onClick={handleRowClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleRowClick();
          }
        }}
        aria-label={`Open ${recipe.title}`}
      >
        <div className="recipe-row-thumb-wrap">
          <div className="recipe-row-thumb" role="presentation">
            {recipe.imageUrl ? (
              <img
                src={recipe.imageUrl}
                alt=""
                className="recipe-row-thumb-image"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            ) : null}
          </div>
          {isJiggling ? (
            <button
              type="button"
              className="recipe-row-image-button"
              aria-label="Change recipe thumbnail"
              onClick={(event) => {
                event.stopPropagation();
                onRequestImage(recipe.id);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onPointerUp={(event) => event.stopPropagation()}
            />
          ) : null}
        </div>
        <div className="recipe-row-content">
          <strong>{recipe.title || 'Untitled recipe'}</strong>
          {tags.length ? (
            <div className="recipe-row-tags">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : null}
        </div>
        <div className="recipe-row-times">
          <span>Prep {recipe.prepTime || '—'}</span>
          <span>Cook {recipe.cookTime || '—'}</span>
        </div>
      </div>
    </article>
  );
};
