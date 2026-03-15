import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseRecipeImport } from './recipeParsing';

describe('parseRecipeImport', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns an explicit invalid-input error when no import source exists', async () => {
    const result = await parseRecipeImport({});

    expect(result).toEqual({
      kind: 'error',
      error: {
        code: 'invalid-input',
        title: 'Invalid import',
        message: 'Add a recipe link, PDF, or text before continuing.',
        retryable: false
      }
    });
  });

  it('returns a draft with an import warning for unsupported URL results', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          title: 'Unsupported recipe',
          author: 'Test Author',
          source: 'Example Kitchen',
          ingredients: [],
          steps: [],
          sourceLabel: 'https://example.com/recipe'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      )
    ) as typeof fetch;

    const result = await parseRecipeImport({ url: 'https://example.com/recipe' });

    expect(result.kind).toBe('draft');
    if (result.kind === 'draft') {
      expect(result.draft.title).toBe('Unsupported recipe');
      expect(result.draft.author).toBe('Test Author');
      expect(result.draft.source).toBe('Example Kitchen');
      expect(result.draft.importWarning).toContain('Website not supported');
    }
  });

  it('returns a retryable scraper-unreachable error when fetch rejects', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as typeof fetch;

    const result = await parseRecipeImport({ url: 'https://example.com/recipe' });

    expect(result).toEqual({
      kind: 'error',
      error: {
        code: 'scraper-unreachable',
        title: 'Import unavailable',
        message: 'The recipe import service could not be reached. Retry in a moment or create the recipe manually.',
        retryable: true
      }
    });
  });
});
