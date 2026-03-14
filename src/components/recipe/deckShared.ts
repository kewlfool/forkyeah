import { useRef } from 'react';
import { useHorizontalSwipe } from '../../hooks/useHorizontalSwipe';
import { useLongPress } from '../../hooks/useLongPress';
import type { Recipe } from '../../types/models';

export interface DeckRendererProps {
  recipes: Recipe[];
  selectedRecipeId: string | null;
  editingRecipeId: string | null;
  registerItemRef: (recipeId: string) => (node: HTMLElement | null) => void;
  onSelectRecipe: (recipeId: string) => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onEnterEditMode: (recipeId: string) => void;
  onExitEditMode: () => void;
  onEditRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
  onRequestImage: (recipeId: string) => void;
}

export const collectRecipeTags = (recipe: Recipe): string[] => {
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

interface UseDeckItemInteractionsArgs {
  recipe: Recipe;
  editing: boolean;
  onSelectRecipe: (recipeId: string) => void;
  onOpenRecipe: (recipe: Recipe) => void;
  onEnterEditMode: (recipeId: string) => void;
  onExitEditMode: () => void;
  onEditRecipe: (recipe: Recipe) => void;
  onDeleteRecipe: (recipeId: string) => void;
}

export const useDeckItemInteractions = ({
  recipe,
  editing,
  onSelectRecipe,
  onOpenRecipe,
  onEnterEditMode,
  onExitEditMode,
  onEditRecipe,
  onDeleteRecipe
}: UseDeckItemInteractionsArgs) => {
  const suppressClickRef = useRef(false);
  const longPressAtRef = useRef(0);

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

  return {
    longPress,
    swipe,
    handleActivate
  };
};
