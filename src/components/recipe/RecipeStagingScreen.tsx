import { motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useLongPress } from '../../hooks/useLongPress';
import type { RecipeInput } from '../../store/useRecipeStore';
import {
  formatCookedDate,
  toDateInputValue,
  fromDateInputValue
} from '../../utils/recipes';

export interface RecipeStagingDraft {
  title: string;
  description: string;
  author: string;
  source: string;
  imageUrl?: string;
  ingredients: string[];
  steps: string[];
  tags: string[];
  categories: string[];
  cuisines: string[];
  nutrients: string[];
  prepTime: string;
  cookTime: string;
  notes: string;
  lastCooked: number | null;
  sourceLabel: string;
  rawContent: string;
  importWarning?: string;
}

interface RecipeStagingScreenProps {
  draft: RecipeStagingDraft;
  mode: 'create' | 'edit';
  onAccept: (input: RecipeInput) => void;
  onDelete: () => void;
  startEditing?: boolean;
}

const normalizeInputList = (items: string[]): string[] =>
  items.map((item) => item.trim()).filter(Boolean);

const mergeTagGroups = (...groups: string[][]): string[] => {
  const deduped = new Set<string>();
  for (const group of groups) {
    for (const item of group) {
      const trimmed = item.trim();
      if (trimmed) {
        deduped.add(trimmed);
      }
    }
  }
  return Array.from(deduped);
};


export const RecipeStagingScreen = ({
  draft,
  mode,
  onAccept,
  onDelete,
  startEditing = false
}: RecipeStagingScreenProps): JSX.Element => {
  const [isEditing, setIsEditing] = useState(startEditing);

  const [title, setTitle] = useState(draft.title);
  const [description, setDescription] = useState(draft.description);
  const [author, setAuthor] = useState(draft.author);
  const [source, setSource] = useState(draft.source);
  const [imageUrl, setImageUrl] = useState(draft.imageUrl ?? '');
  const [tagsInput, setTagsInput] = useState(draft.tags.join(', '));
  const [categoriesInput, setCategoriesInput] = useState(draft.categories.join(', '));
  const [cuisinesInput, setCuisinesInput] = useState(draft.cuisines.join(', '));
  const [nutrientsInput, setNutrientsInput] = useState<string[]>(draft.nutrients);
  const [prepTime, setPrepTime] = useState(draft.prepTime);
  const [cookTime, setCookTime] = useState(draft.cookTime);
  const [ingredientsInput, setIngredientsInput] = useState<string[]>(draft.ingredients);
  const [stepsInput, setStepsInput] = useState<string[]>(draft.steps);
  const [notesInput, setNotesInput] = useState(draft.notes);
  const [lastCookedInput, setLastCookedInput] = useState(toDateInputValue(draft.lastCooked));

  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsEditing(mode === 'edit' ? true : startEditing);
    setTitle(draft.title);
    setDescription(draft.description);
    setAuthor(draft.author);
    setSource(draft.source);
    setImageUrl(draft.imageUrl ?? '');
    setTagsInput(draft.tags.join(', '));
    setCategoriesInput(draft.categories.join(', '));
    setCuisinesInput(draft.cuisines.join(', '));
    setNutrientsInput(draft.nutrients);
    setPrepTime(draft.prepTime);
    setCookTime(draft.cookTime);
    setIngredientsInput(draft.ingredients);
    setStepsInput(draft.steps);
    setNotesInput(draft.notes);
    setLastCookedInput(toDateInputValue(draft.lastCooked));
  }, [draft, startEditing]);

  const longPress = useLongPress({
    onLongPress: () => setIsEditing(true),
    disabled: isEditing || mode === 'edit'
  });

  const tags = useMemo(
    () =>
      tagsInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [tagsInput]
  );
  const categories = useMemo(
    () =>
      categoriesInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [categoriesInput]
  );
  const cuisines = useMemo(
    () =>
      cuisinesInput
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    [cuisinesInput]
  );
  const nutrients = useMemo(() => normalizeInputList(nutrientsInput), [nutrientsInput]);
  const displayTags = useMemo(() => mergeTagGroups(tags, categories, cuisines), [tags, categories, cuisines]);

  const ingredients = useMemo(() => normalizeInputList(ingredientsInput), [ingredientsInput]);
  const steps = useMemo(() => normalizeInputList(stepsInput), [stepsInput]);
  const lastCooked = useMemo(() => fromDateInputValue(lastCookedInput), [lastCookedInput]);

  const handleAccept = () => {
    onAccept({
      title,
      description,
      author,
      source,
      imageUrl,
      ingredients,
      steps,
      tags,
      categories,
      cuisines,
      nutrients,
      prepTime,
      cookTime,
      notes: notesInput,
      lastCooked
    });
  };


  const titleDisplay = title.trim() || 'Untitled recipe';

  const showEditForm = mode === 'edit' || isEditing;

  return (
    <motion.section
      className="staging-shell screen-layer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      transition={{ duration: 0.2 }}
    >
      <header className="staging-header">
        <div>
          <h1>{mode === 'edit' ? 'Edit recipe' : 'Recipe staging'}</h1>
          <p className="muted">Review the parsed recipe and accept when it looks right.</p>
        </div>
        {isEditing && mode !== 'edit' ? (
          <button type="button" className="ghost-button" onClick={() => setIsEditing(false)}>
            Done
          </button>
        ) : null}
      </header>

      <div
        className="staging-content"
        ref={contentRef}
        onPointerDown={longPress.onPointerDown}
        onPointerUp={longPress.onPointerUp}
        onPointerCancel={longPress.onPointerCancel}
        onPointerLeave={longPress.onPointerLeave}
      >
        {draft.importWarning ? <div className="staging-warning">{draft.importWarning}</div> : null}
        {showEditForm ? (
          <div className="staging-card staging-card-edit">
            <label className="form-field">
              <span className="field-label">Title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="list-input"
                maxLength={80}
              />
            </label>

            <label className="form-field">
              <span className="field-label">Description</span>
              <textarea
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="list-input list-input-textarea"
                placeholder="Short summary of the recipe"
              />
            </label>

            <label className="form-field">
              <span className="field-label">Author</span>
              <input
                type="text"
                value={author}
                onChange={(event) => setAuthor(event.target.value)}
                className="list-input"
                placeholder="e.g. Jane Doe"
              />
            </label>

            <label className="form-field">
              <span className="field-label">Source</span>
              <input
                type="text"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                className="list-input"
                placeholder="e.g. https://example.com/recipe"
              />
            </label>

            <div className="staging-grid">
              <label className="form-field">
                <span className="field-label">Prep time</span>
                <input
                  type="text"
                  value={prepTime}
                  onChange={(event) => setPrepTime(event.target.value)}
                  className="list-input"
                  placeholder="e.g. 15 min"
                />
              </label>
              <label className="form-field">
                <span className="field-label">Cook time</span>
                <input
                  type="text"
                  value={cookTime}
                  onChange={(event) => setCookTime(event.target.value)}
                  className="list-input"
                  placeholder="e.g. 35 min"
                />
              </label>
            </div>

            <label className="form-field">
              <span className="field-label">Ingredients</span>
              <div className="staging-list-editor">
                {ingredientsInput.length ? (
                  ingredientsInput.map((value, index) => (
                    <div key={`ingredient-${index}`} className="staging-line-row">
                      <input
                        type="text"
                        value={value}
                        onChange={(event) => {
                          const next = [...ingredientsInput];
                          next[index] = event.target.value;
                          setIngredientsInput(next);
                        }}
                        className="list-input"
                      />
                      <button
                        type="button"
                        className="plain-icon-button"
                        aria-label="Delete ingredient"
                        onClick={() =>
                          setIngredientsInput(ingredientsInput.filter((_, itemIndex) => itemIndex !== index))
                        }
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <input
                    type="text"
                    value=""
                    onChange={(event) => setIngredientsInput([event.target.value])}
                    className="list-input"
                    placeholder="Add an ingredient"
                  />
                )}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIngredientsInput([...ingredientsInput, ''])}
                >
                  Add ingredient
                </button>
              </div>
            </label>

            <label className="form-field">
              <span className="field-label">Steps</span>
              <div className="staging-list-editor">
                {stepsInput.length ? (
                  stepsInput.map((value, index) => (
                    <div key={`step-${index}`} className="staging-line-row">
                      <input
                        type="text"
                        value={value}
                        onChange={(event) => {
                          const next = [...stepsInput];
                          next[index] = event.target.value;
                          setStepsInput(next);
                        }}
                        className="list-input"
                      />
                      <button
                        type="button"
                        className="plain-icon-button"
                        aria-label="Delete step"
                        onClick={() => setStepsInput(stepsInput.filter((_, itemIndex) => itemIndex !== index))}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                ) : (
                  <input
                    type="text"
                    value=""
                    onChange={(event) => setStepsInput([event.target.value])}
                    className="list-input"
                    placeholder="Add a step"
                  />
                )}
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setStepsInput([...stepsInput, ''])}
                >
                  Add step
                </button>
              </div>
            </label>

            <label className="form-field">
              <span className="field-label">Notes</span>
              <textarea
                rows={4}
                value={notesInput}
                onChange={(event) => setNotesInput(event.target.value)}
                className="list-input list-input-textarea"
                placeholder="Optional notes"
              />
            </label>

            <label className="form-field">
              <span className="field-label">Tags</span>
              <input
                type="text"
                value={tagsInput}
                onChange={(event) => setTagsInput(event.target.value)}
                className="list-input"
                placeholder="comma-separated"
              />
            </label>

            <label className="form-field">
              <span className="field-label">Categories</span>
              <input
                type="text"
                value={categoriesInput}
                onChange={(event) => setCategoriesInput(event.target.value)}
                className="list-input"
                placeholder="comma-separated"
              />
            </label>

            <label className="form-field">
              <span className="field-label">Cuisines</span>
              <input
                type="text"
                value={cuisinesInput}
                onChange={(event) => setCuisinesInput(event.target.value)}
                className="list-input"
                placeholder="comma-separated"
              />
            </label>

            <label className="form-field">
              <span className="field-label">Last cooked</span>
              <input
                type="date"
                value={lastCookedInput}
                onChange={(event) => setLastCookedInput(event.target.value)}
                className="list-input"
              />
            </label>
          </div>
        ) : (
          <div className="staging-card">
              <div className="staging-title">
                <div>
                  <h2>{titleDisplay}</h2>
                  {description.trim() ? <p className="muted">{description}</p> : null}
                  {author.trim() ? <p className="muted">Author: {author}</p> : null}
                  <p className="muted">Source: {source || draft.sourceLabel || 'Manual'}</p>
                </div>
              <div className="staging-meta">
                <span>Prep {prepTime || '—'}</span>
                <span>Cook {cookTime || '—'}</span>
              </div>
            </div>

            <div className="staging-tags">
              {displayTags.length ? (
                displayTags.map((tag) => <span key={tag}>{tag}</span>)
              ) : (
                <span className="muted">No tags</span>
              )}
            </div>

            <div className="staging-section">
              <h3>Ingredients</h3>
              {ingredients.length ? (
                <ul>
                  {ingredients.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No ingredients yet.</p>
              )}
            </div>

            <div className="staging-section">
              <h3>Steps</h3>
              {steps.length ? (
                <ol>
                  {steps.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ol>
              ) : (
                <p className="muted">No steps yet.</p>
              )}
            </div>

            <div className="staging-section">
              <h3>Notes</h3>
              {notesInput.trim() ? <p>{notesInput}</p> : <p className="muted">No notes yet.</p>}
            </div>

            <div className="staging-section">
              <h3>Nutrients</h3>
              {nutrients.length ? (
                <ul>
                  {nutrients.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="muted">No nutrients yet.</p>
              )}
            </div>

            <div className="staging-section">
              <h3>Last cooked</h3>
              <p>{formatCookedDate(lastCooked)}</p>
            </div>

            <p className="muted staging-hint">Long press to edit fields.</p>
          </div>
        )}
      </div>

      <footer className="staging-actions">
        <button type="button" className="ghost-button" onClick={onDelete}>
          {mode === 'edit' ? 'Cancel' : 'Delete'}
        </button>
        <button type="button" className="solid-button" onClick={handleAccept}>
          {mode === 'edit' ? 'Save' : 'Accept'}
        </button>
      </footer>

    </motion.section>
  );
};
