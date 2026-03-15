import { describe, expect, it } from 'vitest';
import type { Recipe } from '../types/models';
import { buildRecipeExportHtml } from './recipePdf';

const buildRecipe = (overrides?: Partial<Recipe>): Recipe => ({
  id: 'recipe-1',
  title: 'Test recipe',
  description: 'A recipe description.',
  author: 'Chef Example',
  source: 'https://example.com/recipe',
  imageUrl: 'https://example.com/image.jpg',
  ingredients: ['1 cup flour', '2 eggs', '1 tsp salt'],
  steps: ['Mix', 'Bake'],
  tags: ['Dinner'],
  categories: ['Main'],
  cuisines: ['Italian'],
  nutrients: ['Calories: 300'],
  prepTime: '10 min',
  cookTime: '20 min',
  notes: 'Serve warm.',
  lastCooked: null,
  createdAt: Date.now(),
  ...overrides
});

describe('buildRecipeExportHtml', () => {
  it('renders the ingredients in two columns and includes footer metadata', () => {
    const html = buildRecipeExportHtml(buildRecipe());

    expect(html).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(html).toContain('<ul class="ingredients">');
    expect(html).toContain('Chef Example');
    expect(html).toContain('https://example.com/recipe');
    expect(html).toContain('<span class="footer-meta-label">Author</span>');
    expect(html).toContain('<span class="footer-meta-label">Source</span>');
  });
});
