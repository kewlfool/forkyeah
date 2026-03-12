import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { Recipe } from '../types/models';
import { formatCookedDate } from './recipes';

const safeFileName = (value: string): string =>
  value
    .trim()
    .replace(/[^a-z0-9\-_\s]/gi, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 48);

const wrapText = (text: string, maxWidth: number, font: any, size: number): string[] => {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) {
    return [''];
  }
  const lines: string[] = [];
  let line = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const word = words[i];
    const testLine = `${line} ${word}`;
    if (font.widthOfTextAtSize(testLine, size) <= maxWidth) {
      line = testLine;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
};

const dataUrlToBytes = async (dataUrl: string): Promise<Uint8Array> => {
  const response = await fetch(dataUrl);
  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
};

export const exportRecipeToPdf = async (recipe: Recipe): Promise<void> => {
  try {
  const title = recipe.title?.trim() || 'Untitled recipe';
  const pdfDoc = await PDFDocument.create();
  const pageWidth = 612;
  const pageHeight = 792;
  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  let y = pageHeight - margin;
  const lineGap = 4;

  const ensureSpace = (heightNeeded: number) => {
    if (y - heightNeeded < margin) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      y = pageHeight - margin;
    }
  };

  const drawLine = (text: string, size: number, isBold = false, color = rgb(0.12, 0.16, 0.22)) => {
    ensureSpace(size + lineGap);
    page.drawText(text, {
      x: margin,
      y: y - size,
      size,
      font: isBold ? fontBold : font,
      color
    });
    y -= size + lineGap;
  };

  const drawWrapped = (text: string, size: number, isBold = false) => {
    const lines = wrapText(text, contentWidth, isBold ? fontBold : font, size);
    lines.forEach((line) => drawLine(line, size, isBold));
  };

  drawWrapped(title, 22, true);
  drawLine(`Last cooked: ${formatCookedDate(recipe.lastCooked)}`, 10, false, rgb(0.4, 0.45, 0.5));

  if (recipe.tags?.length) {
    const tagLine = recipe.tags.join(', ');
    drawLine(`Tags: ${tagLine}`, 10, false, rgb(0.4, 0.45, 0.5));
  }

  y -= 6;

  if (recipe.imageUrl) {
    try {
      const imageBytes = await dataUrlToBytes(recipe.imageUrl);
      const isPng = recipe.imageUrl.startsWith('data:image/png');
      const image = isPng ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
      const targetHeight = 100;
      const scale = Math.min(contentWidth / image.width, targetHeight / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      ensureSpace(targetHeight + 12);
      const x = margin + (contentWidth - drawWidth) / 2;
      page.drawImage(image, {
        x,
        y: y - targetHeight + (targetHeight - drawHeight) / 2,
        width: drawWidth,
        height: drawHeight
      });
      y -= targetHeight + 10;
    } catch {
      // ignore image failures
    }
  }

  const timingFontSize = 12;
  ensureSpace(timingFontSize * 2 + 10);
  page.drawText(`Prep`, { x: margin, y: y - timingFontSize, size: timingFontSize, font, color: rgb(0.4, 0.45, 0.5) });
  page.drawText(`Cook`, {
    x: margin + contentWidth / 2,
    y: y - timingFontSize,
    size: timingFontSize,
    font,
    color: rgb(0.4, 0.45, 0.5)
  });
  y -= timingFontSize + 4;
  page.drawText(recipe.prepTime || '—', { x: margin, y: y - 14, size: 14, font: fontBold, color: rgb(0.12, 0.16, 0.22) });
  page.drawText(recipe.cookTime || '—', {
    x: margin + contentWidth / 2,
    y: y - 14,
    size: 14,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.22)
  });
  y -= 22;

  const drawSectionTitle = (label: string) => {
    y -= 6;
    drawLine(label.toUpperCase(), 11, true, rgb(0.4, 0.45, 0.5));
  };

  const drawList = (items: string[], ordered = false) => {
    if (!items.length) {
      drawLine('None', 11, false, rgb(0.6, 0.64, 0.7));
      return;
    }
    items.forEach((item, index) => {
      const prefix = ordered ? `${index + 1}. ` : '• ';
      const lines = wrapText(prefix + item, contentWidth, font, 11);
      lines.forEach((line) => drawLine(line, 11));
    });
  };

  drawSectionTitle('Ingredients');
  drawList(recipe.ingredients ?? []);

  drawSectionTitle('Steps');
  drawList(recipe.steps ?? [], true);

  drawSectionTitle('Notes');
  if (recipe.notes?.trim()) {
    drawWrapped(recipe.notes.trim(), 11);
  } else {
    drawLine('None', 11, false, rgb(0.6, 0.64, 0.7));
  }

  drawSectionTitle('Nutrients');
  drawList(recipe.nutrients ?? []);

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const filename = `${safeFileName(title) || 'recipe'}.pdf`;
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch {
      // fallback to download
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    // ignore export failures
    console.error('PDF export failed', error);
  }
};
