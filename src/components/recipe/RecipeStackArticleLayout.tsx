import type { HTMLAttributes, ReactNode, Ref, UIEvent } from 'react';
import type { Recipe } from '../../types/models';
import { formatCookedDate } from '../../utils/recipes';

interface RecipeStackArticleLayoutProps {
  recipe: Recipe;
  bodyRef?: Ref<HTMLDivElement>;
  onBodyScroll?: (event: UIEvent<HTMLDivElement>) => void;
  headerSwipeZoneProps?: HTMLAttributes<HTMLDivElement>;
  ingredientsContent: ReactNode;
  stepsContent: ReactNode;
  onOpenRecipe: () => void;
}

const collectCuisineTags = (cuisines: string[]): string[] => {
  const seen = new Set<string>();
  const tags: string[] = [];

  for (const cuisine of cuisines) {
    const trimmed = cuisine.trim();
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

export const RecipeStackArticleLayout = ({
  recipe,
  bodyRef,
  onBodyScroll,
  headerSwipeZoneProps,
  ingredientsContent,
  stepsContent,
  onOpenRecipe
}: RecipeStackArticleLayoutProps): JSX.Element => {
  const hasImage = Boolean(recipe.imageUrl);
  const cuisines = collectCuisineTags(recipe.cuisines ?? []);

  return (
    <div className="recipe-stack-article">
      <div ref={bodyRef} className="recipe-stack-body" onScroll={onBodyScroll}>
        <div className="recipe-stack-header-shell">
          <header className="recipe-stack-header">
            <div className={`recipe-stack-header-image ${hasImage ? 'has-image' : ''}`} role="presentation">
              {hasImage ? (
                <img
                  src={recipe.imageUrl}
                  alt=""
                  className="recipe-stack-header-image-img"
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
              ) : null}
            </div>

            <div className="recipe-stack-header-copy">
              <h1>{recipe.title || 'Untitled recipe'}</h1>
              {cuisines.length ? (
                <div className="recipe-stack-cuisines">
                  {cuisines.map((cuisine) => (
                    <span key={cuisine}>{cuisine}</span>
                  ))}
                </div>
              ) : null}
              <div className="recipe-stack-meta">
                <div className="recipe-stack-meta-primary">
                  <span>Prep {recipe.prepTime || '—'}</span>
                  <span>Cook {recipe.cookTime || '—'}</span>
                </div>
                <span className="recipe-title-meta">Last cooked: {formatCookedDate(recipe.lastCooked)}</span>
              </div>
            </div>
          </header>

          <div
            {...headerSwipeZoneProps}
            className="recipe-stack-header-swipe-zone"
            aria-hidden="true"
          />
        </div>

        <section className="recipe-section">
          <h2>Ingredients</h2>
          {ingredientsContent}
        </section>

        <section className="recipe-section">
          <h2>Steps</h2>
          {stepsContent}
        </section>
      </div>

      <button type="button" className="recipe-stack-footer" onClick={onOpenRecipe}>
        <span>Let&apos;s cook</span>
      </button>
    </div>
  );
};
