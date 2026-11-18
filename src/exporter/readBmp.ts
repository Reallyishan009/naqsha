import { decodeEnds, parseCardProfile } from '../codec/index.ts';
import type { CardGrid, Pattern } from '../codec/index.ts';
import { bmpLayout } from './layout.ts';
import { parseExportOptions } from './options.ts';
import type { ReadResult } from './types.ts';

/** The file header (14 bytes) plus the info header (40 bytes): every field the reader looks at is inside these. */
const HEADERS_BYTES = 54;

function unsupported(field: string, value: number): ReadResult {
  return { ok: false, failure: { reason: 'unsupported-bmp', field, value } };
}

/**
 * Reads back a BMP written by exportPatternBmp. Checks, in order: profile, options, BM signature and minimum length,
 * unsupported header fields (infoHeaderSize, planes, bitDepth, compression, width, height, coloursUsed), width against
 * the profile, then fileSize, pixelOffset, imageSize and length against bmpLayout. Never throws.
 *
 * The file's own bit depth decides how pixels are read. options.bitDepth is validated but not compared with the
 * file, so the 1-bit and 8-bit variants of one Pattern both read back with the same options (R7.5).
 * Padding bytes and unused bits are ignored.
 */
export function readPatternBmp(bytes: unknown, profile: unknown, options?: unknown): ReadResult {
  const parsedProfile = parseCardProfile(profile);
  if (!parsedProfile.ok) return { ok: false, failure: { reason: 'invalid-profile', violations: parsedProfile.violations } };
  const cardProfile = parsedProfile.value;

  const parsedOptions = parseExportOptions(options);
  if (!parsedOptions.ok) return { ok: false, failure: parsedOptions.failure };
  const exportOptions = parsedOptions.value;

  if (!(bytes instanceof Uint8Array) || bytes.length < HEADERS_BYTES || bytes[0] !== 0x42 || bytes[1] !== 0x4d) {
    return { ok: false, failure: { reason: 'not-a-bmp' } };
  }
  // The length check above makes every header read below stay inside the bytes.
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const infoHeaderSize = view.getUint32(14, true);
  if (infoHeaderSize !== 40) return unsupported('infoHeaderSize', infoHeaderSize);
  const planes = view.getUint16(26, true);
  if (planes !== 1) return unsupported('planes', planes);
  const bitDepth = view.getUint16(28, true);
  if (bitDepth !== 1 && bitDepth !== 8) return unsupported('bitDepth', bitDepth);
  const compression = view.getUint32(30, true);
  if (compression !== 0) return unsupported('compression', compression);
  const width = view.getInt32(18, true);
  if (width <= 0) return unsupported('width', width);
  const height = view.getInt32(22, true);
  if (height <= 0) return unsupported('height', height);
  const coloursUsed = view.getUint32(46, true);
  if (coloursUsed !== (bitDepth === 1 ? 2 : 256)) return unsupported('coloursUsed', coloursUsed);

  const profileWidth = cardProfile.hookRows * cardProfile.hookColumns;
  if (width !== profileWidth) return { ok: false, failure: { reason: 'width-mismatch', fileWidth: width, profileWidth } };

  // Pure arithmetic: a huge width * height gives layout sizes above bytes.length and fails here, before any allocation.
  const layout = bmpLayout(width, height, bitDepth);
  const sizeChecks: [string, number, number][] = [
    ['fileSize', layout.fileSize, view.getUint32(2, true)],
    ['pixelOffset', layout.pixelOffset, view.getUint32(10, true)],
    ['imageSize', layout.imageSize, view.getUint32(34, true)],
    ['length', layout.fileSize, bytes.length],
  ];
  for (const [field, expected, actual] of sizeChecks) {
    if (expected !== actual) return { ok: false, failure: { reason: 'inconsistent-size', field, expected, actual } };
  }

  // Classify each colour table entry once: 1 lifted, 0 down, -1 neither. The table lies inside the bytes: the
  // length check above makes the file at least pixelOffset bytes. Only B, G and R are compared, not the reserved byte.
  const liftValue = exportOptions.liftColour === 'black' ? 0 : 255;
  const downValue = 255 - liftValue;
  const classes = new Int8Array(256).fill(-1);
  for (let entry = 0; entry < layout.colourEntries; entry++) {
    const at = HEADERS_BYTES + 4 * entry;
    const blue = bytes[at]!;
    const green = bytes[at + 1]!;
    const red = bytes[at + 2]!;
    if (blue === green && green === red) {
      if (blue === liftValue) classes[entry] = 1;
      else if (blue === downValue) classes[entry] = 0;
    }
  }

  const pattern: Pattern = new Array<CardGrid>(height);
  for (let imageRow = 0; imageRow < height; imageRow++) {
    const storedRow = height - 1 - imageRow;
    const pick = exportOptions.pickOrder === 'first-at-top' ? imageRow : height - 1 - imageRow;
    const ends = new Array<boolean>(width).fill(false);
    for (let x = 0; x < width; x++) {
      const end = exportOptions.endOrder === 'first-at-left' ? x : width - 1 - x;
      const rowStart = layout.pixelOffset + storedRow * layout.rowStride;
      const byteIndex = rowStart + (bitDepth === 8 ? x : Math.floor(x / 8));
      if (byteIndex >= bytes.length) {
        return { ok: false, failure: { reason: 'inconsistent-size', field: 'length', expected: byteIndex + 1, actual: bytes.length } };
      }
      const value = bytes[byteIndex]!;
      const colourIndex = bitDepth === 8 ? value : (value >> (7 - (x % 8))) & 1;
      const classification = classes[colourIndex]!;
      if (classification < 0) return { ok: false, failure: { reason: 'unknown-colour', pick, end } };
      ends[end] = classification === 1;
    }
    const decoded = decodeEnds(cardProfile, ends);
    // decodeEnds cannot fail here: ends has exactly hookRows * hookColumns booleans. Mapped only to never throw.
    if (!decoded.ok) return { ok: false, failure: { reason: 'inconsistent-size', field: 'ends', expected: width, actual: ends.length } };
    pattern[pick] = decoded.value;
  }
  return { ok: true, pattern };
}
