import { motion } from 'framer-motion';
import { Layers3, LayoutGrid, List, Plus } from 'lucide-react';
import { useEffect, useRef, type JSX } from 'react';
import type { DeckRendererMode } from '../../types/models';
import { DeckGridRenderer } from './DeckGridRenderer';
import { DeckListRenderer } from './DeckListRenderer';
import { RecipeStackScene } from './RecipeStackScene';
import type { DeckRendererProps } from './deckShared';

interface DeckSceneProps extends Omit<DeckRendererProps, 'registerItemRef'> {
  mode: DeckRendererMode;
  onModeChange: (mode: DeckRendererMode) => void;
  onImport: () => void;
  showImportButton?: boolean;
}

export const DeckScene = ({
  mode,
  recipes,
  selectedRecipeId,
  editingRecipeId,
  onModeChange,
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
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());

  useEffect(() => {
    if (!editingRecipeId) {
      return;
    }

    const handleOutsideTap = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const activeItem = itemRefs.current.get(editingRecipeId);
      if (activeItem && activeItem.contains(target)) {
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

  useEffect(() => {
    onExitEditMode();
  }, [mode, onExitEditMode]);

  const registerItemRef = (recipeId: string) => {
    return (node: HTMLElement | null) => {
      if (node) {
        itemRefs.current.set(recipeId, node);
      } else {
        itemRefs.current.delete(recipeId);
      }
    };
  };

  const rendererProps: DeckRendererProps = {
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
  };

  const nextMode: DeckRendererMode =
    mode === 'list' ? 'grid' : mode === 'grid' ? 'stack' : 'list';
  const modeIcon =
    nextMode === 'grid' ? <LayoutGrid size={18} /> : nextMode === 'stack' ? <Layers3 size={18} /> : <List size={18} />;
  const modeLabel =
    nextMode === 'grid'
      ? 'Switch to grid view'
      : nextMode === 'stack'
        ? 'Switch to stack view'
        : 'Switch to list view';

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

      {mode === 'stack' ? (
        <RecipeStackScene
          key="stack"
          recipes={recipes}
          selectedRecipeId={selectedRecipeId}
          onSelectRecipe={onSelectRecipe}
          onOpenRecipe={onOpenRecipe}
        />
      ) : mode === 'grid' ? (
        <DeckGridRenderer key="grid" {...rendererProps} />
      ) : (
        <DeckListRenderer key="list" {...rendererProps} />
      )}

      <div className="deck-bottom-bar">
        <button
          type="button"
          className="deck-mode-toggle"
          aria-label={modeLabel}
          onClick={() => onModeChange(nextMode)}
        >
          {modeIcon}
        </button>

        {showImportButton ? (
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
