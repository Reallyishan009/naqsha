import { encodeCardGrid, parseCardProfile, validateCardGrid } from '../codec/index.ts';
import type { Violation } from '../codec/index.ts';
import { bmpLayout } from './layout.ts';
import { parseExportOptions } from './options.ts';
import type { ExportOptions, ExportResult } from './types.ts';

/** The BMP file size field is 32 bits; files above 2^31 - 1 bytes are refused. */
const MAX_FILE_SIZE = 2 ** 31 - 1;

const WHITE = [0xff, 0xff, 0xff, 0x00] as const;
const BLACK = [0x00, 0x00, 0x00, 0x00] as const;

/**
 * Writes a Pattern as an uncompressed BMP, one pixel per end and one row per pick.
 * Checks, in order: profile, options, Pattern (non-array, empty, damaged cards), size limit. Never throws.
 */
export function exportPatternBmp(profile: unknown, pattern: unknown, options?: unknown): ExportResult {
  const parsedProfile = parseCardProfile(profile);
  if (!parsedProfile.ok) return { ok: false, failure: { reason: 'invalid-profile', violations: parsedProfile.violations } };
  const cardProfile = parsedProfile.value;

  const parsedOptions = parseExportOptions(options);
  if (!parsedOptions.ok) return { ok: false, failure: parsedOptions.failure };
  const exportOptions = parsedOptions.value;

  if (!Array.isArray(pattern)) {
    const violation: Violation = {
      kind: 'not-an-array',
      location: 'pattern',
      message: 'pattern must be an array of card grids',
    };
    return { ok: false, failure: { reason: 'invalid-card', picks: [{ pick: -1, violations: [violation] }] } };
  }
  if (pattern.length === 0) return { ok: false, failure: { reason: 'empty-pattern' } };

  const damaged: { pick: number; violations: Violation[] }[] = [];
  for (let pick = 0; pick < pattern.length; pick++) {
    const violations = validateCardGrid(cardProfile, pattern[pick]);
    if (violations.length > 0) damaged.push({ pick, violations });
  }
  if (damaged.length > 0) return { ok: false, failure: { reason: 'invalid-card', picks: damaged } };

  const width = cardProfile.hookRows * cardProfile.hookColumns;
  const height = pattern.length;
  const layout = bmpLayout(width, height, exportOptions.bitDepth);
  if (layout.fileSize > MAX_FILE_SIZE) {
    return {
      ok: false,
      failure: { reason: 'invalid-options', option: 'bitDepth', message: `the file would be too large (${layout.fileSize} bytes)` },
    };
  }

  const bytes = new Uint8Array(layout.fileSize);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, 0x42);
  view.setUint8(1, 0x4d);
  view.setUint32(2, layout.fileSize, true);
  view.setUint32(6, 0, true);
  view.setUint32(10, layout.pixelOffset, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, layout.bitDepth, true);
  view.setUint32(30, 0, true);
  view.setUint32(34, layout.imageSize, true);
  view.setInt32(38, 0, true);
  view.setInt32(42, 0, true);
  view.setUint32(46, layout.colourEntries, true);
  view.setUint32(50, 2, true);

  writeColourTable(bytes, exportOptions, layout.colourEntries);
  writeRows(bytes, layout.pixelOffset, layout.rowStride, width, height, exportOptions, (pick) => {
    const encoded = encodeCardGrid(cardProfile, pattern[pick]);
    // Every card was validated above, so encoding cannot fail.
    return encoded.ok ? encoded.value : [];
  });
  return { ok: true, bytes };
}

/** Entry 0 is the down colour and entry 1 the lift colour. In the 8-bit table, entries 2 to 255 repeat entry 0. */
function writeColourTable(bytes: Uint8Array, options: ExportOptions, colourEntries: number): void {
  const down = options.liftColour === 'black' ? WHITE : BLACK;
  const lifted = options.liftColour === 'black' ? BLACK : WHITE;
  bytes.set(down, 54);
  bytes.set(lifted, 58);
  for (let entry = 2; entry < colourEntries; entry++) bytes.set(down, 54 + 4 * entry);
}

function writeRows(
  bytes: Uint8Array,
  pixelOffset: number,
  rowStride: number,
  width: number,
  height: number,
  options: ExportOptions,
  endsOfPick: (pick: number) => boolean[],
): void {
  for (let storedRow = 0; storedRow < height; storedRow++) {
    const imageRow = height - 1 - storedRow;
    const pick = options.pickOrder === 'first-at-top' ? imageRow : height - 1 - imageRow;
    const ends = endsOfPick(pick);
    for (let x = 0; x < width; x++) {
      const end = options.endOrder === 'first-at-left' ? x : width - 1 - x;
      if (ends[end] !== true) continue;
      if (options.bitDepth === 8) bytes[pixelOffset + storedRow * rowStride + x] = 1;
      else bytes[pixelOffset + storedRow * rowStride + Math.floor(x / 8)]! |= 1 << (7 - (x % 8));
    }
  }
}
