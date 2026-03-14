import type { JSX } from 'react';
import { formatCookedDate } from '../../utils/recipes';
import { collectRecipeTags, type DeckRendererProps, useDeckItemInteractions } from './deckShared';

export const DeckListRenderer = ({
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
    <div className="deck-list">
      {recipes.map((recipe) => (
        <DeckListItem
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

interface DeckListItemProps extends Omit<DeckRendererProps, 'recipes' | 'selectedRecipeId' | 'editingRecipeId' | 'registerItemRef'> {
  recipe: DeckRendererProps['recipes'][number];
  selected: boolean;
  editing: boolean;
  registerRef: (node: HTMLElement | null) => void;
}

const DeckListItem = ({
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
}: DeckListItemProps): JSX.Element => {
  const tags = collectRecipeTags(recipe);
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
          <div className="deck-list-meta">
            <span className="deck-list-date">Last cooked: {formatCookedDate(recipe.lastCooked)}</span>
            <span>Prep {recipe.prepTime || '—'}</span>
            <span>Cook {recipe.cookTime || '—'}</span>
          </div>
        </div>
      </div>
    </article>
  );
};
