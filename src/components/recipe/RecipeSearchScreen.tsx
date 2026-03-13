import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePinchToClose } from '../../hooks/usePinchToClose';
import { searchRecipes, type RecipeSearchResult } from '../../utils/recipeSearch';

interface RecipeSearchScreenProps {
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onImportUrl: (url: string) => Promise<void>;
}

export const RecipeSearchScreen = ({
  query,
  onQueryChange,
  onClose,
  onImportUrl
}: RecipeSearchScreenProps): JSX.Element => {
  const [inputValue, setInputValue] = useState(query);
  const [results, setResults] = useState<RecipeSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastExecutedQueryRef = useRef('');

  const pinch = usePinchToClose({
    onPinchOut: onClose,
    direction: 'in',
    threshold: 42
  });

  useEffect(() => {
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  }, []);

  const runSearch = useCallback((value: string) => {
    const trimmed = value.trim();
    abortRef.current?.abort();

    if (trimmed.length < 2) {
      lastExecutedQueryRef.current = '';
      setResults([]);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    lastExecutedQueryRef.current = trimmed;
    setStatus('loading');

    void searchRecipes(trimmed, 10, controller.signal)
      .then((items) => {
        if (controller.signal.aborted) {
          return;
        }
        setResults(items);
        setStatus('idle');
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
          return;
        }
        setResults([]);
        setStatus('error');
      });
  }, []);

  useEffect(() => {
    setInputValue(query);
    if (query.trim() && query.trim() !== lastExecutedQueryRef.current) {
      runSearch(query);
      return;
    }

    if (!query.trim()) {
      lastExecutedQueryRef.current = '';
      setResults([]);
      setStatus('idle');
    }
  }, [query, runSearch]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    []
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = inputValue.trim();
    onQueryChange(trimmed);
    runSearch(trimmed);
  };

  const resultsLabel = useMemo(() => {
    const activeQuery = query.trim();
    const pendingQuery = inputValue.trim();

    if (!activeQuery && !pendingQuery) {
      return 'Type a search and press Search.';
    }
    if (pendingQuery && pendingQuery !== activeQuery) {
      return 'Press Search to update results.';
    }
    if (status === 'loading') {
      return 'Searching…';
    }
    if (status === 'error') {
      return 'Search failed. Try again.';
    }
    if (!results.length) {
      return 'No results yet.';
    }
    return '';
  }, [inputValue, query, results.length, status]);

  return (
    <motion.section
      className="search-shell screen-layer"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      onTouchStart={pinch.onTouchStart}
      onTouchMove={pinch.onTouchMove}
      onTouchEnd={pinch.onTouchEnd}
      onTouchCancel={pinch.onTouchCancel}
    >
      <header className="search-header">
        <h2>Search recipes</h2>
        <form className="search-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="search"
            className="search-input"
            placeholder="Search recipes"
            aria-label="Search recipes"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
          />
          <button
            type="submit"
            className="solid-button search-submit-button"
            disabled={status === 'loading' || inputValue.trim().length < 2}
          >
            Search
          </button>
        </form>
      </header>

      <div className="search-results">
        {resultsLabel ? <p className="muted search-empty">{resultsLabel}</p> : null}
        {results.map((result) => (
          <button
            key={result.url}
            type="button"
            className="search-result-card"
            onClick={() => {
              void onImportUrl(result.url);
            }}
          >
            <div
              className="search-result-thumb"
              style={result.thumbnail ? { backgroundImage: `url(${result.thumbnail})` } : undefined}
            />
            <div className="search-result-body">
              <strong>{result.title || result.url}</strong>
              {result.snippet ? <span>{result.snippet}</span> : null}
            </div>
          </button>
        ))}
      </div>
    </motion.section>
  );
};
