import type { PixelData } from './types';

/** True iff width and height are positive integers and data is a Uint8ClampedArray of length width*height*4. Never throws. */
export function isPixelData(value: unknown): value is PixelData {
  try {
    if (typeof value !== 'object' || value === null) return false;
    const candidate = value as { width?: unknown; height?: unknown; data?: unknown };
    const { width, height, data } = candidate;
    if (typeof width !== 'number' || typeof height !== 'number') return false;
    if (!Number.isInteger(width) || !Number.isInteger(height)) return false;
    if (width <= 0 || height <= 0) return false;
    if (!(data instanceof Uint8ClampedArray)) return false;
    return data.length === width * height * 4;
  } catch {
    return false;
  }
}
