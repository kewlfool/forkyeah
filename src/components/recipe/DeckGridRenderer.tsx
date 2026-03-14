import type { JSX } from 'react';
import { formatCookedDate } from '../../utils/recipes';
import { type DeckRendererProps, useDeckItemInteractions } from './deckShared';

export const DeckGridRenderer = ({
  recipes,
  selectedRecipeId,
  editingRecipeId,
  registerItemRef,
  onSelectRecipe,
  onOpenRecipe,
  onEnterEditMode,
  onExitEditMode,
  onEditRecipe,
  onDeleteRecipe,
  onRequestImage
}: DeckRendererProps): JSX.Element => {
  return (
    <div className="deck-grid">
      {recipes.map((recipe) => (
        <DeckGridItem
          key={recipe.id}
          recipe={recipe}
          selected={selectedRecipeId === recipe.id}
          editing={editingRecipeId === recipe.id}
          registerRef={registerItemRef(recipe.id)}
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
  );
};

interface DeckGridItemProps extends Omit<DeckRendererProps, 'recipes' | 'selectedRecipeId' | 'editingRecipeId' | 'registerItemRef'> {
  recipe: DeckRendererProps['recipes'][number];
  selected: boolean;
  editing: boolean;
  registerRef: (node: HTMLElement | null) => void;
}

const DeckGridItem = ({
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
}: DeckGridItemProps): JSX.Element => {
  const { longPress, swipe, handleActivate } = useDeckItemInteractions({
    recipe,
    editing,
    onSelectRecipe,
    onOpenRecipe,
    onEnterEditMode,
    onExitEditMode,
    onEditRecipe,
    onDeleteRecipe
  });

  return (
    <article
      ref={registerRef}
      className={`deck-grid-card ${selected ? 'is-selected' : ''} ${editing ? 'is-editing' : ''}`}
      data-recipe-id={recipe.id}
    >
      <div
        role="button"
        tabIndex={0}
        className="deck-grid-card-main"
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
        <div className="deck-grid-media-wrap">
          <div className="deck-grid-media" role="presentation">
            {recipe.imageUrl ? (
              <img
                src={recipe.imageUrl}
                alt=""
                className="deck-grid-media-image"
                loading="lazy"
                decoding="async"
                draggable={false}
              />
            ) : null}
          </div>

          {editing ? (
            <button
              type="button"
              className="deck-grid-image-button"
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

        <div className="deck-grid-copy">
          <strong>{recipe.title || 'Untitled recipe'}</strong>
          <span className="deck-grid-date">Last cooked: {formatCookedDate(recipe.lastCooked)}</span>
        </div>
      </div>
    </article>
  );
};
