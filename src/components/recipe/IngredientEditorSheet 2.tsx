import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

interface IngredientEditorSheetProps {
  open: boolean;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export const IngredientEditorSheet = ({
  open,
  value,
  onChange,
  onClose,
  onSave
}: IngredientEditorSheetProps): JSX.Element => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
  }, [open]);

  const canSave = Boolean(value.trim());

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="modal-sheet ingredient-editor-sheet"
            initial={{ y: 32, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Edit ingredient</h2>
            <label className="form-field">
              <span className="field-label">Ingredient</span>
              <input
                ref={inputRef}
                type="text"
                className="list-input"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canSave) {
                    event.preventDefault();
                    onSave();
                  }
                }}
              />
            </label>

            <div className="modal-actions">
              <button type="button" className="ghost-button" onClick={onClose}>
                Cancel
              </button>
              <button type="button" className="solid-button" onClick={onSave} disabled={!canSave}>
                Save
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
