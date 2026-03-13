const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_MAX_BYTES = 450_000;
const DEFAULT_OUTPUT_TYPE = 'image/jpeg';

const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = (error) => {
      URL.revokeObjectURL(objectUrl);
      reject(error);
    };
    image.src = objectUrl;
  });

const drawToCanvas = (image: HTMLImageElement, maxDimension: number): HTMLCanvasElement => {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const longestSide = Math.max(width, height);
  const scale = longestSide > maxDimension ? maxDimension / longestSide : 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context unavailable');
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
};

const canvasToBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error('Failed to encode image'));
      },
      type,
      quality
    );
  });

export const compressImageFile = async (
  file: File,
  options?: {
    maxDimension?: number;
    maxBytes?: number;
  }
): Promise<string> => {
  const maxDimension = options?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;

  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return fileToDataUrl(file);
  }

  const image = await loadImage(file);
  const canvas = drawToCanvas(image, maxDimension);

  let quality = 0.82;
  let blob = await canvasToBlob(canvas, DEFAULT_OUTPUT_TYPE, quality);

  while (blob.size > maxBytes && quality > 0.5) {
    quality -= 0.08;
    blob = await canvasToBlob(canvas, DEFAULT_OUTPUT_TYPE, quality);
  }

  return blobToDataUrl(blob);
};
