export interface RecipeSearchResult {
  title: string;
  url: string;
  thumbnail?: string;
  snippet?: string;
}

const SEARCH_ENDPOINT = (() => {
  const direct = import.meta.env.VITE_SEARCH_URL as string | undefined;
  if (direct) {
    return direct;
  }

  const scraper = import.meta.env.VITE_SCRAPER_URL as string | undefined;
  if (scraper) {
    const normalized = scraper.replace(/\/$/, '');
    if (normalized.endsWith('/api/scrape')) {
      return normalized.replace(/\/api\/scrape$/, '/api/search');
    }
    return `${normalized}/api/search`;
  }

  return 'https://forkyeah-api-972537921250.us-central1.run.app/api/search';
})();

export const searchRecipes = async (
  query: string,
  limit = 10,
  signal?: AbortSignal
): Promise<RecipeSearchResult[]> => {
  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const url = `${SEARCH_ENDPOINT}?q=${encodeURIComponent(trimmed)}&limit=${limit}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`Search failed: ${response.status}`);
  }

  const data = (await response.json()) as { results?: RecipeSearchResult[] };
  return data.results ?? [];
};
