import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

type RecipeParseSource = 'pdf' | 'url' | 'manual';

export interface RecipeImportInput {
  url?: string;
  rawText?: string;
  file?: File | null;
  fileName?: string | null;
}

export interface ParsedRecipeDraft {
  title: string;
  description: string;
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
  rawContent: string;
  sourceLabel: string;
  sourceType: RecipeParseSource;
  importWarning?: string;
}

interface ParseLineResult {
  prepTime?: string;
  cookTime?: string;
  tags?: string[];
}

const PREVIEW_LIMIT = 20000;
const SCRAPER_ENDPOINT = (() => {
  const direct = import.meta.env.VITE_SCRAPER_URL as string | undefined;
  if (direct) {
    const normalized = direct.replace(/\/$/, '');
    if (normalized.endsWith('/api/scrape')) {
      return normalized;
    }
    return `${normalized}/api/scrape`;
  }

  return 'https://forkyeah-api-972537921250.us-central1.run.app/api/scrape';
})();

GlobalWorkerOptions.workerSrc = pdfWorker;

const previewText = (value: string): string => {
  const trimmed = value.trim();
  if (trimmed.length <= PREVIEW_LIMIT) {
    return trimmed;
  }
  return `${trimmed.slice(0, PREVIEW_LIMIT)}…`;
};

const normalizeText = (value: string): string => value.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

const cleanLineItem = (value: string): string =>
  value
    .replace(/^[\s•\-*\u2022]+/g, '')
    .replace(/^\d+[\).]\s+/, '')
    .trim();

const normalizeList = (items: string[]): string[] =>
  items
    .map((item) => item.trim())
    .filter(Boolean);

const normalizeTags = (items: string[]): string[] => {
  const deduped = new Set<string>();
  for (const item of items) {
    const trimmed = item.trim();
    if (trimmed) {
      deduped.add(trimmed);
    }
  }
  return Array.from(deduped);
};

const humanizeNutrientKey = (value: string): string => {
  if (!value) {
    return '';
  }

  const cleaned = value.replace(/Content$/i, '').replace(/[_-]+/g, ' ');
  const spaced = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
  if (!spaced) {
    return '';
  }
  return spaced.slice(0, 1).toUpperCase() + spaced.slice(1);
};

const normalizeNutrients = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key, val]) => !key.startsWith('@') && val !== null && val !== undefined)
      .map(([key, val]) => {
        const label = humanizeNutrientKey(key);
        const text = String(val).trim();
        if (!label || !text) {
          return '';
        }
        return `${label}: ${text}`;
      })
      .filter(Boolean);
    return entries;
  }

  return [];
};

const splitTags = (value: string): string[] =>
  value
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const baseDraft = (sourceLabel: string, sourceType: RecipeParseSource): ParsedRecipeDraft => ({
  title: '',
  description: '',
  imageUrl: '',
  ingredients: [],
  steps: [],
  tags: [],
  categories: [],
  cuisines: [],
  nutrients: [],
  prepTime: '',
  cookTime: '',
  notes: '',
  rawContent: '',
  sourceLabel,
  sourceType,
  importWarning: undefined
});

const parseSectionHeader = (line: string): { section: 'ingredients' | 'steps' | 'notes'; remainder: string } | null => {
  const trimmed = line.trim();
  const match = trimmed.match(/^(ingredients?|instructions?|directions?|method|steps?|notes?)\s*:?\s*(.*)$/i);
  if (!match) {
    return null;
  }

  const key = match[1].toLowerCase();
  const remainder = match[2]?.trim() ?? '';

  if (key.startsWith('ingredient')) {
    return { section: 'ingredients', remainder };
  }

  if (key.startsWith('note')) {
    return { section: 'notes', remainder };
  }

  return { section: 'steps', remainder };
};

const parseLineForMeta = (line: string): ParseLineResult => {
  const meta: ParseLineResult = {};

  const timeMatch = line.match(/^(prep|prep time|cook|cook time|total time)\s*:?\s*(.+)$/i);
  if (timeMatch) {
    const label = timeMatch[1].toLowerCase();
    const value = timeMatch[2].trim();
    if (label.startsWith('prep')) {
      meta.prepTime = value;
    } else if (label.startsWith('cook')) {
      meta.cookTime = value;
    } else if (label.startsWith('total')) {
      meta.cookTime = value;
    }
  }

  const tagMatch = line.match(/^(tags?|keywords?)\s*:?\s*(.+)$/i);
  if (tagMatch) {
    meta.tags = splitTags(tagMatch[2]);
  }

  return meta;
};

const deriveTitleFromUrl = (value: string): string => {
  if (!value) {
    return '';
  }

  try {
    const url = new URL(value);
    const parts = url.pathname.split('/').filter(Boolean);
    const last = parts.at(-1);
    if (last) {
      return decodeURIComponent(last)
        .replace(/[-_]/g, ' ')
        .replace(/\.[a-z0-9]+$/i, '')
        .trim();
    }

    return url.hostname;
  } catch {
    return '';
  }
};

const deriveTitleFromFile = (value: string | null | undefined): string => {
  if (!value) {
    return '';
  }

  return value.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' ').trim();
};

const extractPdfText = async (file: File): Promise<string> => {
  const data = await file.arrayBuffer();
  const loadingTask = getDocument({ data });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items as Array<{ str: string; hasEOL?: boolean }>;
    let pageText = '';

    for (const item of items) {
      pageText += item.str;
      pageText += item.hasEOL ? '\n' : ' ';
    }

    const normalized = pageText.trim();
    if (normalized) {
      pages.push(normalized);
    }
  }

  return pages.join('\n\n');
};

const parseRecipeFromText = (
  text: string,
  fallbackTitle: string,
  sourceLabel: string,
  sourceType: RecipeParseSource
): ParsedRecipeDraft => {
  const normalized = normalizeText(text);
  const rawContent = previewText(normalized);
  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let title = fallbackTitle;
  let prepTime = '';
  let cookTime = '';
  const tags: string[] = [];
  const ingredients: string[] = [];
  const steps: string[] = [];
  const notes: string[] = [];

  let currentSection: 'ingredients' | 'steps' | 'notes' | null = null;
  let sawSection = false;

  for (const line of lines) {
    const sectionInfo = parseSectionHeader(line);
    if (sectionInfo) {
      currentSection = sectionInfo.section;
      sawSection = true;

      if (sectionInfo.remainder) {
        const remainderLine = cleanLineItem(sectionInfo.remainder);
        if (remainderLine) {
          if (currentSection === 'ingredients') {
            ingredients.push(...splitTags(remainderLine));
          } else if (currentSection === 'steps') {
            steps.push(remainderLine);
          } else {
            notes.push(remainderLine);
          }
        }
      }
      continue;
    }

    const meta = parseLineForMeta(line);
    if (meta.prepTime && !prepTime) {
      prepTime = meta.prepTime;
      continue;
    }
    if (meta.cookTime && !cookTime) {
      cookTime = meta.cookTime;
      continue;
    }
    if (meta.tags && meta.tags.length) {
      tags.push(...meta.tags);
      continue;
    }

    if (!title && line.length <= 80 && !line.match(/^(serves|yield)/i)) {
      title = line;
      continue;
    }

    if (currentSection === 'ingredients') {
      const cleaned = cleanLineItem(line);
      if (cleaned) {
        ingredients.push(cleaned);
      }
      continue;
    }

    if (currentSection === 'steps') {
      const cleaned = cleanLineItem(line);
      if (cleaned) {
        steps.push(cleaned);
      }
      continue;
    }

    if (currentSection === 'notes') {
      notes.push(line);
    }
  }

  if (!sawSection) {
    const blocks = normalized
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);

    if (blocks.length >= 2) {
      ingredients.push(...blocks[0].split('\n').map(cleanLineItem).filter(Boolean));
      steps.push(...blocks[1].split('\n').map(cleanLineItem).filter(Boolean));
      if (blocks.length > 2) {
        notes.push(blocks.slice(2).join('\n\n'));
      }
    } else {
      const numbered = lines.filter((line) => /^\d+[\).]/.test(line));
      if (numbered.length >= 2) {
        steps.push(...numbered.map(cleanLineItem));
      }
    }
  }

  if (!title) {
    const candidate = lines.find((line) => line.length <= 80);
    if (candidate) {
      title = candidate;
    }
  }

  const draft = baseDraft(sourceLabel, sourceType);
  draft.title = title;
  draft.ingredients = normalizeList(ingredients);
  draft.steps = normalizeList(steps);
  draft.tags = normalizeTags(tags);
  draft.prepTime = prepTime;
  draft.cookTime = cookTime;
  draft.notes = notes.join('\n').trim();
  draft.rawContent = rawContent;
  return draft;
};

const toStringArray = (value: unknown): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return [String(value)];
};

const formatDuration = (value: unknown): string => {
  if (!value) {
    return '';
  }

  const text = String(value).trim();
  const match = text.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/i);
  if (!match) {
    return text;
  }

  const days = Number.parseInt(match[1] ?? '', 10);
  const hours = Number.parseInt(match[2] ?? '', 10);
  const minutes = Number.parseInt(match[3] ?? '', 10);

  const parts: string[] = [];
  if (!Number.isNaN(days) && days > 0) {
    parts.push(`${days} d`);
  }
  if (!Number.isNaN(hours) && hours > 0) {
    parts.push(`${hours} hr`);
  }
  if (!Number.isNaN(minutes) && minutes > 0) {
    parts.push(`${minutes} min`);
  }

  if (!parts.length) {
    return text;
  }

  return parts.join(' ');
};

const collectInstructions = (value: unknown): string[] => {
  if (!value) {
    return [];
  }

  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectInstructions(item));
  }

  if (typeof value === 'object') {
    const node = value as Record<string, unknown>;
    if (typeof node.text === 'string') {
      return [node.text];
    }
    if (node.itemListElement) {
      return collectInstructions(node.itemListElement);
    }
  }

  return [];
};

const extractImageUrl = (value: unknown): string => {
  if (!value) {
    return '';
  }

  if (typeof value === 'string') {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return extractImageUrl(value[0]);
  }

  if (typeof value === 'object') {
    const node = value as Record<string, unknown>;
    if (typeof node.url === 'string') {
      return node.url.trim();
    }
    if (typeof node['@id'] === 'string') {
      return node['@id'].trim();
    }
  }

  return '';
};

const extractRecipeFromJsonLd = (doc: Document): Partial<ParsedRecipeDraft> | null => {
  const scripts = Array.from(doc.querySelectorAll('script[type="application/ld+json"]'));
  for (const script of scripts) {
    const text = script.textContent?.trim();
    if (!text) {
      continue;
    }

    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      continue;
    }

    const nodes = Array.isArray(data) ? data : [data];
    const flattened: unknown[] = [];

    for (const node of nodes) {
      if (node && typeof node === 'object' && '@graph' in node) {
        const graph = (node as Record<string, unknown>)['@graph'];
        if (Array.isArray(graph)) {
          flattened.push(...graph);
        } else if (graph) {
          flattened.push(graph);
        }
      } else {
        flattened.push(node);
      }
    }

    const recipeNode = flattened.find((node) => {
      if (!node || typeof node !== 'object') {
        return false;
      }
      const type = (node as Record<string, unknown>)['@type'];
      if (Array.isArray(type)) {
        return type.includes('Recipe');
      }
      return type === 'Recipe';
    });

    if (!recipeNode || typeof recipeNode !== 'object') {
      continue;
    }

    const recipe = recipeNode as Record<string, unknown>;
    const ingredients = toStringArray(recipe.recipeIngredient);
    const instructions = collectInstructions(recipe.recipeInstructions);
    const keywords = toStringArray(recipe.keywords);
    const categories = toStringArray(recipe.recipeCategory);
    const cuisine = toStringArray(recipe.recipeCuisine);
    const imageUrl = extractImageUrl(recipe.image);
    const description = typeof recipe.description === 'string' ? recipe.description : '';
    const nutrients = normalizeNutrients(recipe.nutrition);

    return {
      title: typeof recipe.name === 'string' ? recipe.name : '',
      description,
      imageUrl,
      ingredients,
      steps: instructions,
      tags: normalizeTags([...keywords, ...categories, ...cuisine]),
      categories,
      cuisines: cuisine,
      nutrients,
      prepTime: formatDuration(recipe.prepTime),
      cookTime: formatDuration(recipe.cookTime),
      notes: ''
    };
  }

  return null;
};

interface BackendRecipeResponse {
  title?: string;
  description?: string;
  imageUrl?: string;
  ingredients?: string[];
  steps?: string[];
  tags?: string[];
  categories?: string[];
  cuisines?: string[];
  nutrients?: string[];
  prepTime?: string;
  cookTime?: string;
  notes?: string;
  rawContent?: string;
  sourceLabel?: string;
}

interface BackendFetchResult {
  draft: ParsedRecipeDraft | null;
  error: string | null;
}

const IMPORT_WARNING =
  'Website not supported. Try importing a PDF or use "Create your recipe" and paste the ingredients and steps.';

const readBackendError = async (response: Response): Promise<string | null> => {
  try {
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const data = (await response.json()) as { detail?: string };
      if (typeof data?.detail === 'string' && data.detail.trim()) {
        return data.detail.trim();
      }
    }

    const text = await response.text();
    const trimmed = text.trim();
    if (trimmed) {
      return trimmed.slice(0, 160);
    }
  } catch {
    return null;
  }

  return null;
};

const fetchRecipeFromBackend = async (url: string): Promise<BackendFetchResult> => {
  if (!SCRAPER_ENDPOINT) {
    return { draft: null, error: 'Scraper not configured.' };
  }

  try {
    const response = await fetch(`${SCRAPER_ENDPOINT}?url=${encodeURIComponent(url)}`);
    if (!response.ok) {
      const errorMessage = await readBackendError(response);
      return {
        draft: null,
        error: errorMessage ?? `Scraper error (${response.status}).`
      };
    }

    const data = (await response.json()) as BackendRecipeResponse;
    const draft = baseDraft(data.sourceLabel ?? url, 'url');
    draft.title = data.title?.trim() || deriveTitleFromUrl(url);
    draft.description = data.description?.trim() || '';
    draft.imageUrl = data.imageUrl?.trim() || '';
    draft.ingredients = normalizeList(data.ingredients ?? []);
    draft.steps = normalizeList(data.steps ?? []);
    draft.categories = normalizeTags(data.categories ?? []);
    draft.cuisines = normalizeTags(data.cuisines ?? []);
    draft.tags = normalizeTags([...(data.tags ?? []), ...draft.categories, ...draft.cuisines]);
    draft.nutrients = normalizeNutrients(data.nutrients ?? []);
    draft.prepTime = data.prepTime ?? '';
    draft.cookTime = data.cookTime ?? '';
    draft.notes = data.notes ?? '';
    draft.rawContent = data.rawContent ?? '';
    if (draft.ingredients.length === 0 && draft.steps.length === 0) {
      draft.importWarning = IMPORT_WARNING;
    }
    return { draft, error: null };
  } catch {
    return { draft: null, error: 'Scraper unreachable.' };
  }
};

const parseRecipeFromUrl = async (url: string): Promise<ParsedRecipeDraft> => {
  const sourceLabel = url;
  const fallbackTitle = deriveTitleFromUrl(url);

  try {
    const backendResult = await fetchRecipeFromBackend(url);
    if (backendResult.draft) {
      if (
        backendResult.draft.ingredients.length === 0 &&
        backendResult.draft.steps.length === 0
      ) {
        backendResult.draft.importWarning = IMPORT_WARNING;
      }
      return backendResult.draft;
    }

    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rawText = previewText(doc.body?.textContent ?? '');

    const jsonLd = extractRecipeFromJsonLd(doc);
    if (jsonLd) {
      const draft = baseDraft(sourceLabel, 'url');
      draft.title = jsonLd.title?.trim() || fallbackTitle;
      draft.description = jsonLd.description?.trim() || '';
      draft.imageUrl = jsonLd.imageUrl?.trim() || '';
      draft.ingredients = normalizeList(jsonLd.ingredients ?? []);
      draft.steps = normalizeList(jsonLd.steps ?? []);
      draft.categories = normalizeTags(jsonLd.categories ?? []);
      draft.cuisines = normalizeTags(jsonLd.cuisines ?? []);
      draft.tags = normalizeTags([...(jsonLd.tags ?? []), ...draft.categories, ...draft.cuisines]);
      draft.nutrients = normalizeNutrients(jsonLd.nutrients ?? []);
      draft.prepTime = jsonLd.prepTime ?? '';
      draft.cookTime = jsonLd.cookTime ?? '';
      draft.notes = jsonLd.notes ?? '';
      draft.rawContent = rawText || previewText(html);
      return draft;
    }

    const parsed = parseRecipeFromText(doc.body?.textContent ?? html, fallbackTitle, sourceLabel, 'url');
    parsed.rawContent = rawText || parsed.rawContent;
    if (parsed.ingredients.length === 0 && parsed.steps.length === 0) {
      parsed.importWarning = IMPORT_WARNING;
    }
    return parsed;
  } catch {
    const draft = baseDraft(sourceLabel, 'url');
    draft.title = fallbackTitle;
    draft.rawContent = url;
    draft.importWarning = IMPORT_WARNING;
    return draft;
  }
};

export const parseRecipeImport = async (input: RecipeImportInput): Promise<ParsedRecipeDraft> => {
  const file = input.file ?? null;
  const url = input.url?.trim() ?? '';
  const rawText = input.rawText?.trim() ?? '';
  const fileName = input.fileName ?? file?.name ?? null;

  if (file) {
    const sourceLabel = fileName ?? 'PDF';
    const fallbackTitle = deriveTitleFromFile(fileName);
    try {
      const text = await extractPdfText(file);
      return parseRecipeFromText(text, fallbackTitle, sourceLabel, 'pdf');
    } catch {
      const draft = baseDraft(sourceLabel, 'pdf');
      draft.title = fallbackTitle;
      draft.rawContent = fileName ?? '';
      return draft;
    }
  }

  if (url) {
    return parseRecipeFromUrl(url);
  }

  if (rawText) {
    const sourceLabel = 'Manual';
    return parseRecipeFromText(rawText, '', sourceLabel, 'manual');
  }

  const empty = baseDraft('Manual', 'manual');
  return empty;
};
