import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type FormEvent } from 'react';

export interface RecipeImportPayload {
  url: string;
  rawText: string;
  file: File | null;
  fileName: string | null;
}

interface RecipeImportSheetProps {
  open: boolean;
  onClose: () => void;
  onContinue: (payload: RecipeImportPayload) => void;
  onCreateManual: () => void;
}

export const RecipeImportSheet = ({
  open,
  onClose,
  onContinue,
  onCreateManual
}: RecipeImportSheetProps): JSX.Element => {
  const [url, setUrl] = useState('');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    requestAnimationFrame(() => {
      urlInputRef.current?.focus();
    });
  }, [open]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onContinue({
      url: url.trim(),
      rawText: rawText.trim(),
      file,
      fileName
    });
    setUrl('');
    setRawText('');
    setFile(null);
    setFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

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
            className="modal-sheet"
            initial={{ y: 42, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 32, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2>Import recipe</h2>
            <form onSubmit={handleSubmit} className="stack-12" autoComplete="off">
              <label className="form-field">
                <span className="field-label">Recipe link</span>
                <input
                  ref={urlInputRef}
                  type="url"
                  name="recipe-url"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="url"
                  data-lpignore="true"
                  data-form-type="other"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className="list-input"
                  placeholder="Paste a recipe URL"
                />
              </label>

              <label className="form-field">
                <span className="field-label">PDF recipe</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="list-input"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    setFile(file ?? null);
                    setFileName(file ? file.name : null);
                  }}
                />
                {fileName ? <small className="muted">Selected: {fileName}</small> : null}
              </label>

              <p className="muted import-note">Paste a link or PDF, or create from scratch below.</p>

              <div className="modal-actions">
                <button type="button" className="ghost-button" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="solid-button">
                  Continue
                </button>
              </div>
            </form>

            <button
              type="button"
              className="solid-button create-recipe-button"
              onClick={() => {
                onCreateManual();
                setUrl('');
                setRawText('');
                setFile(null);
                setFileName(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
            >
              Create your recipe
            </button>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
