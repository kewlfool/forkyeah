import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
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
  const [executedQuery, setExecutedQuery] = useState(query.trim());
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastExecutedQueryRef = useRef('');
  const keyboardInset = useKeyboardInset();

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
      setExecutedQuery('');
      setResults([]);
      setStatus('idle');
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    lastExecutedQueryRef.current = trimmed;
    setExecutedQuery(trimmed);
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
      setExecutedQuery('');
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

  const statusMessage = useMemo(() => {
    if (!executedQuery) {
      return '';
    }

    if (status === 'loading') {
      return `Searching for "${executedQuery}"...`;
    }
    if (status === 'error') {
      return `Search failed for "${executedQuery}". Try again.`;
    }
    if (!results.length) {
      return `No results for "${executedQuery}".`;
    }
    return `${results.length} result${results.length === 1 ? '' : 's'} for "${executedQuery}".`;
  }, [executedQuery, results.length, status]);

  const hasSearchSession = executedQuery.length > 0;
  const shellStyle = {
    '--search-keyboard-offset': `${keyboardInset}px`
  } as CSSProperties;
  const statusTone =
    status === 'loading' ? 'loading' : status === 'error' ? 'error' : hasSearchSession ? 'complete' : 'idle';

  return (
    <motion.section
      className={`search-shell screen-layer${hasSearchSession ? '' : ' is-empty'}`}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      style={shellStyle}
      onTouchStart={pinch.onTouchStart}
      onTouchMove={pinch.onTouchMove}
      onTouchEnd={pinch.onTouchEnd}
      onTouchCancel={pinch.onTouchCancel}
    >
      <header className="search-header">
        <h2>Search recipes</h2>
      </header>

      <div className="search-results">
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

      <div className={`search-dock ${hasSearchSession ? 'is-floating' : 'is-centered'}`}>
        <form className="search-form" onSubmit={handleSubmit} aria-busy={status === 'loading'}>
          <input
            ref={inputRef}
            type="search"
            className="search-input"
            placeholder="Search recipes"
            aria-label="Search recipes"
            enterKeyHint="search"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
          />
          <button
            type="submit"
            className="solid-button search-submit-button"
            disabled={status === 'loading' || inputValue.trim().length < 2}
          >
            {status === 'loading' ? 'Searching...' : 'Search'}
          </button>
        </form>
        {statusMessage ? (
          <p className={`search-status is-${statusTone}`} role="status" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
      </div>
    </motion.section>
  );
};
