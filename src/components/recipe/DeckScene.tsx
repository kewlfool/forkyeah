import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useHorizontalSwipe } from '../../hooks/useHorizontalSwipe';
import { useLongPress } from '../../hooks/useLongPress';
import type { Recipe } from '../../types/models';
import { formatCookedDate } from '../../utils/recipes';

interface DeckSceneProps {
  recipes: Recipe[];
  selectedRecipeId: string | null;
  editingRecipeId: string | null;
  onSelectRecipe: (recipeId: string) => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onEnterEditMode: (recipeId: string) => void;
  onExitEditMode: () => void;
  onEditRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  onRequestImage: (recipeId: string) => void;
  onImport: () => void;
  showImportButton?: boolean;
}

const collectTags = (recipe: Recipe): string[] => {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const item of [...(recipe.categories ?? []), ...(recipe.cuisines ?? []), ...(recipe.tags ?? [])]) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    tags.push(trimmed);
  }

  return tags;
};

export const DeckScene = ({
  recipes,
  selectedRecipeId,
  editingRecipeId,
  onSelectRecipe,
  onOpenRecipe,
  onEnterEditMode,
  onExitEditMode,
  onEditRecipe,
  onDeleteRecipe,
  onRequestImage,
  onImport,
  showImportButton = true
}: DeckSceneProps): JSX.Element => {
  const rowRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!editingRecipeId) {
      return;
    }

    const handleOutsideTap = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const activeRow = rowRefs.current.get(editingRecipeId);
      if (activeRow && activeRow.contains(target)) {
        return;
      }

      onExitEditMode();
    };

    document.addEventListener('mousedown', handleOutsideTap);
    document.addEventListener('touchstart', handleOutsideTap, { passive: true });

    return () => {
      document.removeEventListener('mousedown', handleOutsideTap);
      document.removeEventListener('touchstart', handleOutsideTap);
    };
  }, [editingRecipeId, onExitEditMode]);

  const registerRowRef = (recipeId: string) => {
    return (node: HTMLElement | null) => {
      if (node) {
        rowRefs.current.set(recipeId, node);
      } else {
        rowRefs.current.delete(recipeId);
      }
    };
  };

  return (
    <motion.section
      className="overview-shell recipe-deck-shell screen-layer"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
    >
      <header className="overview-header overview-header-flat">
        <h1>Forkyeah</h1>
        <div className="header-actions">
          <span className="recipe-total-count" aria-label={`Total recipes ${recipes.length}`}>
            {recipes.length}
          </span>
        </div>
      </header>

      <div className={`deck-list ${showImportButton ? 'has-floating-add' : ''}`}>
        {recipes.map((recipe) => (
          <DeckListRow
            key={recipe.id}
            recipe={recipe}
            selected={selectedRecipeId === recipe.id}
            editing={editingRecipeId === recipe.id}
            registerRef={registerRowRef(recipe.id)}
            onSelectRecipe={onSelectRecipe}
            onOpenRecipe={onOpenRecipe}
            onEnterEditMode={onEnterEditMode}
            onExitEditMode={onExitEditMode}
            onEditRecipe={onEditRecipe}
            onDeleteRecipe={onDeleteRecipe}
            onRequestImage={onRequestImage}
          />
        ))}
      </div>

      {showImportButton ? (
        <div className="deck-bottom-bar">
          <button
            type="button"
            className="import-fab deck-import-button"
            aria-label="Import recipe"
            onClick={onImport}
          >
            <Plus size={20} />
          </button>
        </div>
      ) : null}
    </motion.section>
  );
};

interface DeckListRowProps {
  recipe: Recipe;
  selected: boolean;
  editing: boolean;
  registerRef: (node: HTMLElement | null) => void;
  onSelectRecipe: (recipeId: string) => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onEnterEditMode: (recipeId: string) => void;
  onExitEditMode: () => void;
  onEditRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  onRequestImage: (recipeId: string) => void;
}

const DeckListRow = ({
  recipe,
  selected,
  editing,
  registerRef,
  onSelectRecipe,
  onOpenRecipe,
  onEnterEditMode,
  onExitEditMode,
  onEditRecipe,
  onDeleteRecipe,
  onRequestImage
}: DeckListRowProps): JSX.Element => {
  const suppressClickRef = useRef(false);
  const longPressAtRef = useRef(0);
  const tags = collectTags(recipe);

  const longPress = useLongPress({
    onLongPress: () => {
      suppressClickRef.current = true;
      longPressAtRef.current = Date.now();
      onSelectRecipe(recipe.id);
      onEnterEditMode(recipe.id);
    },
    delay: 430
  });

  const swipe = useHorizontalSwipe({
    onSwipeLeft: () => {
      if (!editing) {
        return;
      }

      suppressClickRef.current = true;
      onDeleteRecipe(recipe.id);
    },
    threshold: 64,
    disabled: !editing
  });

  const handleActivate = () => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    onSelectRecipe(recipe.id);

    if (editing) {
      if (Date.now() - longPressAtRef.current < 260) {
        return;
      }

      onExitEditMode();
      onEditRecipe(recipe);
      return;
    }

    onOpenRecipe(recipe);
  };

  return (
    <article
      ref={registerRef}
      className={`deck-list-row ${selected ? 'is-selected' : ''} ${editing ? 'is-editing' : ''}`}
      data-recipe-id={recipe.id}
    >
      <div
        role="button"
        tabIndex={0}
        className="deck-list-row-main"
        onTouchStart={swipe.onTouchStart}
        onTouchMove={swipe.onTouchMove}
        onTouchEnd={swipe.onTouchEnd}
        onTouchCancel={swipe.onTouchCancel}
        onPointerDown={longPress.onPointerDown}
        onPointerMove={longPress.onPointerMove}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onPointerLeave={longPress.onPointerLeave}
        onClick={handleActivate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleActivate();
          }
        }}
        aria-label={`Open ${recipe.title || 'recipe'}`}
      >
        <div className="deck-list-thumb-wrap">
          <div className="deck-list-thumb" role="presentation">
            {recipe.imageUrl ? (
              <img
                src={recipe.imageUrl}
                alt=""
                className="deck-list-thumb-image"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            ) : null}
          </div>

          {editing ? (
            <button
              type="button"
              className="deck-list-image-button"
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

        <div className="deck-list-copy">
          <strong>{recipe.title || 'Untitled recipe'}</strong>
          {tags.length ? (
            <div className="deck-list-tags">
              {tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          ) : (
            <span className="deck-list-muted">No tags</span>
          )}
          <span className="deck-list-date">Last cooked: {formatCookedDate(recipe.lastCooked)}</span>
        </div>

        <div className="deck-list-times">
          <span>Prep {recipe.prepTime || '—'}</span>
          <span>Cook {recipe.cookTime || '—'}</span>
        </div>
      </div>
    </article>
  );
};
