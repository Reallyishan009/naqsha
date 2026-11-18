import type { BmpLayout } from './types.ts';

const FILE_HEADER_BYTES = 14;
const INFO_HEADER_BYTES = 40;
const COLOUR_TABLE_ENTRY_BYTES = 4;

/** Row stride, colour table size, offsets and sizes of an uncompressed BMP. Pure arithmetic; nothing is allocated. */
export function bmpLayout(width: number, height: number, bitDepth: 1 | 8): BmpLayout {
  const rowStride = 4 * Math.ceil((width * bitDepth) / 32);
  const colourEntries = bitDepth === 1 ? 2 : 256;
  const pixelOffset = FILE_HEADER_BYTES + INFO_HEADER_BYTES + COLOUR_TABLE_ENTRY_BYTES * colourEntries;
  const imageSize = rowStride * height;
  return {
    width,
    height,
    bitDepth,
    rowStride,
    colourEntries,
    pixelOffset,
    imageSize,
    fileSize: pixelOffset + imageSize,
  };
}
