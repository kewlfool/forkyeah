import type { HTMLAttributes, ReactNode, Ref } from 'react';
import type { Recipe } from '../../types/models';

interface RecipeArticleLayoutProps {
  recipe: Recipe;
  lastCookedControl: ReactNode;
  headerAction?: ReactNode;
  headerProps?: HTMLAttributes<HTMLElement>;
  titleProps?: HTMLAttributes<HTMLHeadingElement>;
  heroProps?: HTMLAttributes<HTMLDivElement>;
  showDescription?: boolean;
  ingredientsContent: ReactNode;
  stepsContent: ReactNode;
  notesContent?: ReactNode;
  footer?: ReactNode;
  contentRef?: Ref<HTMLDivElement>;
  contentClassName?: string;
  contentProps?: HTMLAttributes<HTMLDivElement>;
}

const collectRecipeTags = (recipe: Recipe): string[] => {
  const deduped = new Set<string>();
  for (const item of [...(recipe.categories ?? []), ...(recipe.cuisines ?? []), ...(recipe.tags ?? [])]) {
    const trimmed = item.trim();
    if (trimmed) {
      deduped.add(trimmed);
    }
  }
  return Array.from(deduped);
};

export const RecipeArticleLayout = ({
  recipe,
  lastCookedControl,
  headerAction,
  headerProps,
  titleProps,
  heroProps,
  showDescription = true,
  ingredientsContent,
  stepsContent,
  notesContent,
  footer,
  contentRef,
  contentClassName,
  contentProps
}: RecipeArticleLayoutProps): JSX.Element => {
  const displayTags = collectRecipeTags(recipe);
  const hasHeroImage = Boolean(recipe.imageUrl);

  return (
    <>
      <header className="recipe-header" {...headerProps}>
        <div className="recipe-title-row">
          <h1 {...titleProps}>{recipe.title || 'Untitled recipe'}</h1>
          {headerAction ?? null}
        </div>
        {showDescription && recipe.description.trim() ? (
          <p className="recipe-description">{recipe.description}</p>
        ) : null}
        <div className="recipe-meta-row">{lastCookedControl}</div>
      </header>

      <div
        ref={contentRef}
        className={contentClassName ? `recipe-content ${contentClassName}` : 'recipe-content'}
        {...contentProps}
      >
        <div className="recipe-hero" {...heroProps}>
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
          {ingredientsContent}
        </section>

        <section className="recipe-section">
          <h2>Steps</h2>
          {stepsContent}
        </section>

        <section className="recipe-section">
          <h2>Notes</h2>
          {notesContent ?? (recipe.notes.trim() ? <p>{recipe.notes}</p> : <p className="muted">No notes yet.</p>)}
        </section>
      </div>

      {footer ?? null}
    </>
  );
};
