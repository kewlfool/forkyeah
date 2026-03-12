import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { usePinchToClose } from '../../hooks/usePinchToClose';
import { searchRecipes, type RecipeSearchResult } from '../../utils/recipeSearch';

interface RecipeSearchScreenProps {
  query: string;
  onClose: () => void;
  onImportUrl: (url: string) => Promise<void>;
}

export const RecipeSearchScreen = ({
  query,
  onClose,
  onImportUrl
}: RecipeSearchScreenProps): JSX.Element => {
  const [results, setResults] = useState<RecipeSearchResult[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');

  const pinch = usePinchToClose({
    onPinchOut: onClose,
    direction: 'in',
    threshold: 42
  });

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setStatus('idle');
      return;
    }

    setStatus('loading');
    const timer = window.setTimeout(() => {
      void searchRecipes(trimmed, 10)
        .then((items) => {
          setResults(items);
          setStatus('idle');
        })
        .catch(() => {
          setResults([]);
          setStatus('error');
        });
    }, 300);

    return () => window.clearTimeout(timer);
  }, [query]);

  const resultsLabel = useMemo(() => {
    if (!query.trim()) {
      return 'Type to search recipes.';
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
  }, [query, results.length, status]);

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
