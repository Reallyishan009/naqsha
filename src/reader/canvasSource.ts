import type { PixelData } from './types';

export type ImageSource = HTMLImageElement | ImageBitmap | Blob;

export type Context2DLike = {
  drawImage(image: CanvasImageSource, dx: number, dy: number): void;
  getImageData(sx: number, sy: number, sw: number, sh: number): { width: number; height: number; data: Uint8ClampedArray };
};

export type CanvasLike = { getContext(kind: '2d'): Context2DLike | null };

type CanvasFactory = (width: number, height: number) => CanvasLike;

/** Default factory: OffscreenCanvas when available, otherwise a canvas element. */
const defaultCreateCanvas: CanvasFactory = (width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(width, height) as unknown as CanvasLike;
  }
  if (typeof document !== 'undefined') {
    const element = document.createElement('canvas');
    element.width = width;
    element.height = height;
    return element as unknown as CanvasLike;
  }
  throw new Error('No canvas is available in this environment');
};

function isBlob(source: unknown): source is Blob {
  return typeof Blob !== 'undefined' && source instanceof Blob;
}

function sizeOf(image: unknown): { width: number; height: number } {
  const candidate = image as { naturalWidth?: unknown; naturalHeight?: unknown; width?: unknown; height?: unknown };
  const width = typeof candidate.naturalWidth === 'number' ? candidate.naturalWidth : candidate.width;
  const height = typeof candidate.naturalHeight === 'number' ? candidate.naturalHeight : candidate.height;
  if (typeof width !== 'number' || typeof height !== 'number') {
    throw new Error('Image source has no width and height');
  }
  return { width, height };
}

/**
 * Converts an image source to pixel data using one drawImage and one getImageData call.
 * Rejects if the source cannot be decoded, has zero size, or no 2D context is available.
 */
export async function loadPixelData(
  source: ImageSource,
  createCanvas: CanvasFactory = defaultCreateCanvas,
): Promise<PixelData> {
  let image: ImageSource;
  if (isBlob(source)) {
    try {
      image = await createImageBitmap(source);
    } catch (error) {
      throw new Error(`Could not decode the image: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    image = source;
  }

  const { width, height } = sizeOf(image);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new Error(`Image has no pixels (size ${width} x ${height})`);
  }

  const context = createCanvas(width, height).getContext('2d');
  if (context === null) {
    throw new Error('Could not get a 2D drawing context');
  }
  context.drawImage(image as CanvasImageSource, 0, 0);
  const imageData = context.getImageData(0, 0, width, height);
  return { width, height, data: imageData.data };
}
