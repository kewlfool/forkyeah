import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type TouchEvent } from 'react';

const INGREDIENT_RAIL_WIDTH = 88;

interface RecipeIngredientListProps {
  ingredients: string[];
  ingredientDone: boolean[];
  ingredientRailIndex: number | null;
  onOpenRail: (index: number) => void;
  onToggleDone: (index: number) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
}

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

export const RecipeIngredientList = ({
  ingredients,
  ingredientDone,
  ingredientRailIndex,
  onOpenRail,
  onToggleDone,
  onEdit,
  onDelete
}: RecipeIngredientListProps): JSX.Element => {
  if (!ingredients.length) {
    return <p className="muted">No ingredients yet.</p>;
  }

  return (
    <ul className="recipe-ingredients-list">
      {ingredients.map((item, index) => (
        <IngredientItem
          key={`${item}-${index}`}
          item={item}
          isDone={ingredientDone[index]}
          showActions={ingredientRailIndex === index}
          onSwipeLeft={() => onOpenRail(index)}
          onSwipeRight={() => onToggleDone(index)}
          onEdit={() => onEdit(index)}
          onDelete={() => onDelete(index)}
        />
      ))}
    </ul>
  );
};
