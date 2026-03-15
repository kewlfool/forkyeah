import { useEffect, useRef, useState, type HTMLAttributes, type ReactNode, type Ref } from 'react';
import type { Recipe } from '../../types/models';

const DESCRIPTION_MAX_LINES = 4;

interface RecipeArticleLayoutProps {
  recipe: Recipe;
  lastCookedValue: string;
  onUpdateLastCooked: () => void;
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
  lastCookedValue,
  onUpdateLastCooked,
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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [descriptionOverflowing, setDescriptionOverflowing] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    setDescriptionExpanded(false);
  }, [recipe.id, recipe.description]);

  useEffect(() => {
    if (!showDescription || !recipe.description.trim() || typeof document === 'undefined') {
      setDescriptionOverflowing(false);
      return;
    }

    const element = descriptionRef.current;
    if (!element) {
      setDescriptionOverflowing(false);
      return;
    }

    const measureOverflow = () => {
      const activeElement = descriptionRef.current;
      if (!activeElement) {
        setDescriptionOverflowing(false);
        return;
      }

      const width = Math.max(activeElement.clientWidth, Math.round(activeElement.getBoundingClientRect().width));
      if (!width) {
        setDescriptionOverflowing(false);
        return;
      }

      const styles = window.getComputedStyle(activeElement);
      const fontSize = Number.parseFloat(styles.fontSize) || 14;
      const lineHeight = Number.parseFloat(styles.lineHeight);
      const resolvedLineHeight = Number.isFinite(lineHeight) ? lineHeight : fontSize * 1.35;
      const maxHeight = resolvedLineHeight * DESCRIPTION_MAX_LINES;

      const clone = activeElement.cloneNode(true) as HTMLParagraphElement;
      clone.classList.remove('is-collapsed');
      clone.style.position = 'fixed';
      clone.style.inset = '-9999px auto auto 0';
      clone.style.visibility = 'hidden';
      clone.style.pointerEvents = 'none';
      clone.style.height = 'auto';
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      clone.style.display = 'block';
      clone.style.webkitLineClamp = 'unset';
      clone.style.webkitBoxOrient = 'initial';
      clone.style.width = `${width}px`;

      document.body.appendChild(clone);
      const fullHeight = clone.getBoundingClientRect().height;
      clone.remove();

      setDescriptionOverflowing(fullHeight > maxHeight + 1);
    };

    measureOverflow();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            measureOverflow();
          })
        : null;

    resizeObserver?.observe(element);
    window.addEventListener('resize', measureOverflow);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureOverflow);
    };
  }, [recipe.description, showDescription]);

  return (
    <>
      <header className="recipe-header" {...headerProps}>
        <div className="recipe-title-row">
          <h1 {...titleProps}>{recipe.title || 'Untitled recipe'}</h1>
          {headerAction ?? null}
        </div>
        {showDescription && recipe.description.trim() ? (
          <div className="recipe-description-block">
            <p ref={descriptionRef} className={`recipe-description${descriptionExpanded ? '' : ' is-collapsed'}`}>
              {recipe.description}
            </p>
            {descriptionOverflowing ? (
              <button
                type="button"
                className="recipe-description-toggle"
                onClick={() => setDescriptionExpanded((current) => !current)}
              >
                {descriptionExpanded ? 'Show less' : 'Show more'}
              </button>
            ) : null}
          </div>
        ) : null}
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
            <div className="recipe-timing-item">
              <strong>Prep time</strong>
              <span>{recipe.prepTime || '—'}</span>
            </div>
            <div className="recipe-timing-item">
              <strong>Cook time</strong>
              <span>{recipe.cookTime || '—'}</span>
            </div>
            <button
              type="button"
              className="recipe-timing-item recipe-timing-button"
              onClick={onUpdateLastCooked}
              aria-label="Update last cooked date"
            >
              <strong>Last cooked</strong>
              <span>{lastCookedValue}</span>
            </button>
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
