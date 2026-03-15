import recipeExportTemplate from '../../recipe export temp.html?raw';
import type { Recipe } from '../types/models';

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderListItems = (items: string[], emptyLabel = 'None'): string => {
  if (!items.length) {
    return `<li class="muted-empty">${escapeHtml(emptyLabel)}</li>`;
  }

  return items.map((item) => `<li>${escapeHtml(item)}</li>`).join('\n');
};

const renderDescriptionBlock = (description: string): string => {
  if (!description.trim()) {
    return '';
  }

  return `<p class="description">${escapeHtml(description.trim())}</p>`;
};

const renderTagsBlock = (tags: string[]): string => {
  if (!tags.length) {
    return '';
  }

  return `<div class="tags">${escapeHtml(tags.join(' • '))}</div>`;
};

const renderImageBlock = (title: string, imageUrl?: string): string => {
  if (!imageUrl?.trim()) {
    return '';
  }

  return [
    '<div class="image">',
    `  <img src="${escapeHtml(imageUrl.trim())}" alt="${escapeHtml(title)}" />`,
    '</div>'
  ].join('\n');
};

const renderNutrientsSection = (nutrients: string[]): string => {
  if (!nutrients.length) {
    return '';
  }

  return [
    '<div class="section">',
    '<h2>Nutrients</h2>',
    '<ul class="nutrients">',
    renderListItems(nutrients),
    '</ul>',
    '</div>'
  ].join('\n');
};

const PRINT_SCRIPT = `<script>
(function () {
  const triggerPrint = () => {
    window.setTimeout(() => {
      window.focus();
      window.print();
    }, 60);
  };

  const start = () => {
    const images = Array.from(document.images);
    let pending = 0;

    const markReady = () => {
      pending -= 1;
      if (pending <= 0) {
        triggerPrint();
      }
    };

    for (const image of images) {
      if (image.complete) {
        continue;
      }

      pending += 1;
      image.addEventListener('load', markReady, { once: true });
      image.addEventListener('error', markReady, { once: true });
    }

    if (pending === 0) {
      triggerPrint();
    }
  };

  window.addEventListener('load', start, { once: true });
  window.addEventListener('afterprint', () => {
    window.setTimeout(() => window.close(), 120);
  }, { once: true });
})();
<\/script>`;

const renderTemplate = (template: string, replacements: Record<string, string>): string => {
  let output = template;
  for (const [key, value] of Object.entries(replacements)) {
    output = output.replaceAll(`{{${key}}}`, value);
  }
  return output;
};

export const exportRecipeToPdf = (recipe: Recipe): void => {
  try {
    const title = recipe.title.trim() || 'Untitled recipe';
    const rendered = renderTemplate(recipeExportTemplate, {
      documentTitle: escapeHtml(title),
      title: escapeHtml(title),
      descriptionBlock: renderDescriptionBlock(recipe.description ?? ''),
      tagsBlock: renderTagsBlock(recipe.tags ?? []),
      imageBlock: renderImageBlock(title, recipe.imageUrl),
      prepTime: escapeHtml(recipe.prepTime?.trim() || '—'),
      cookTime: escapeHtml(recipe.cookTime?.trim() || '—'),
      ingredients: renderListItems(recipe.ingredients ?? []),
      steps: renderListItems(recipe.steps ?? []),
      notes: recipe.notes?.trim()
        ? escapeHtml(recipe.notes.trim())
        : '<p class="muted-empty">None</p>',
      nutrientsSection: renderNutrientsSection(recipe.nutrients ?? []),
      printScript: PRINT_SCRIPT
    });

    const exportWindow = window.open('', '_blank', 'width=960,height=1200');
    if (!exportWindow) {
      console.error('Recipe export window was blocked');
      return;
    }

    exportWindow.document.open();
    exportWindow.document.write(rendered);
    exportWindow.document.close();
  } catch (error) {
    console.error('Recipe export failed', error);
  }
};
