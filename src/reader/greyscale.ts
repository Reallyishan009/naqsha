import type { GreyImage, PixelData } from './types';

/** level = floor((299 r + 587 g + 114 b + 500) / 1000). Alpha is ignored. Integer arithmetic only. */
export function toGreyscale(pixels: PixelData): GreyImage {
  const { width, height, data } = pixels;
  const levels = new Uint8Array(width * height);
  for (let i = 0; i < levels.length; i++) {
    const o = i * 4;
    levels[i] = Math.floor((299 * data[o] + 587 * data[o + 1] + 114 * data[o + 2] + 500) / 1000);
  }
  return { width, height, levels };
}
