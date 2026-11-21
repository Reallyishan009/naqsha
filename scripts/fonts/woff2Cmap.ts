/**
 * Reads which code points a font file covers, without a browser and without fontTools
 * (design-and-ux-pass, Requirement 1.5).
 *
 * - `woff2CodePoints` parses the woff2 table directory, inflates the single Brotli stream with
 *   `node:zlib`, slices out the `cmap` table (woff2 never transforms it) and reads it.
 * - `sfntCodePoints` does the same for a plain `.ttf` file, whose tables are not compressed.
 * - `cmapCodePoints` reads the `cmap` table itself: subtable formats 4 and 12 of the Unicode
 *   encodings. A code point counts as covered when it maps to a glyph other than glyph 0.
 *
 * Every function returns a result value and never throws. Dev only, and used by the font test.
 */
import { brotliDecompressSync } from 'node:zlib';

export type CmapResult = { ok: true; codePoints: ReadonlySet<number> } | { ok: false; reason: string };

/** The table tags of the woff2 flags byte, by index (WOFF2 specification, "Known table tags"). */
const KNOWN_TABLE_TAGS: readonly string[] = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
  'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
  'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];
const ARBITRARY_TAG_INDEX = 63;
const WOFF2_HEADER_BYTES = 48;
const SFNT_HEADER_BYTES = 12;
const SFNT_RECORD_BYTES = 16;
/** Format 12: the header size, and the size of one group (start, end, first glyph). */
const FORMAT_12_HEADER_BYTES = 16;
const FORMAT_12_GROUP_BYTES = 12;
const MAX_CODE_POINT = 0x10ffff;
const LAST_BMP_CODE_POINT = 0xffff;

function tagAt(bytes: Uint8Array, at: number): string {
  if (at + 4 > bytes.length) throw new Error('the file ends inside a table tag');
  return String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
}

/** A woff2 UIntBase128: seven bits per byte, high bit set on every byte but the last, at most five bytes. */
function readBase128(bytes: Uint8Array, at: number): { value: number; next: number } {
  let value = 0;
  for (let index = 0; index < 5; index++) {
    const byte = bytes[at + index];
    if (byte === undefined) throw new Error('the file ends inside a table length');
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: at + index + 1 };
  }
  throw new Error('a table length is longer than five bytes');
}

/** Whether the woff2 directory gives a transformLength for this table (WOFF2 specification, section 5.1). */
function isTransformed(tag: string, version: number): boolean {
  return tag === 'glyf' || tag === 'loca' ? version !== 3 : version !== 0;
}

/** The `cmap` table of a woff2 file, as stored (it is never transformed). Throws on a malformed file. */
function woff2CmapTable(bytes: Uint8Array): Uint8Array {
  if (bytes.length < WOFF2_HEADER_BYTES) throw new Error('the file is shorter than a woff2 header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (tagAt(bytes, 0) !== 'wOF2') throw new Error('the file does not start with the woff2 signature');
  const tableCount = view.getUint16(12);
  const compressedLength = view.getUint32(20);
  let at = WOFF2_HEADER_BYTES;
  const tables: { tag: string; storedLength: number; transformed: boolean }[] = [];
  for (let index = 0; index < tableCount; index++) {
    const flags = bytes[at];
    if (flags === undefined) throw new Error('the file ends inside the table directory');
    at += 1;
    const tagIndex = flags & 0x3f;
    const version = flags >> 6;
    let tag: string;
    if (tagIndex === ARBITRARY_TAG_INDEX) {
      tag = tagAt(bytes, at);
      at += 4;
    } else {
      tag = KNOWN_TABLE_TAGS[tagIndex]!;
    }
    const original = readBase128(bytes, at);
    at = original.next;
    const transformed = isTransformed(tag, version);
    let storedLength = original.value;
    if (transformed) {
      const transform = readBase128(bytes, at);
      at = transform.next;
      storedLength = transform.value;
    }
    tables.push({ tag, storedLength, transformed });
  }
  if (at + compressedLength > bytes.length) throw new Error('the compressed data runs past the end of the file');
  const stream = brotliDecompressSync(bytes.subarray(at, at + compressedLength));
  let offset = 0;
  for (const table of tables) {
    if (table.tag === 'cmap') {
      if (table.transformed) throw new Error('the cmap table is transformed, which woff2 does not allow');
      if (offset + table.storedLength > stream.length) throw new Error('the cmap table runs past the decompressed data');
      return new Uint8Array(stream.buffer, stream.byteOffset + offset, table.storedLength);
    }
    offset += table.storedLength;
  }
  throw new Error('the font has no cmap table');
}

/** The `cmap` table of a plain sfnt (.ttf or .otf) file. Throws on a malformed file. */
function sfntCmapTable(bytes: Uint8Array): Uint8Array {
  if (bytes.length < SFNT_HEADER_BYTES) throw new Error('the file is shorter than an sfnt header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const version = view.getUint32(0);
  if (version !== 0x00010000 && tagAt(bytes, 0) !== 'OTTO' && tagAt(bytes, 0) !== 'true') {
    throw new Error('the file is not a single sfnt font');
  }
  const tableCount = view.getUint16(4);
  for (let index = 0; index < tableCount; index++) {
    const at = SFNT_HEADER_BYTES + index * SFNT_RECORD_BYTES;
    if (tagAt(bytes, at) !== 'cmap') continue;
    const offset = view.getUint32(at + 8);
    const length = view.getUint32(at + 12);
    if (offset + length > bytes.length) throw new Error('the cmap table runs past the end of the file');
    return bytes.subarray(offset, offset + length);
  }
  throw new Error('the font has no cmap table');
}

/** Format 4: segments of the Basic Multilingual Plane with a delta or a glyph index array. */
function addFormat4(view: DataView, at: number, covered: Set<number>): void {
  const segmentCount = view.getUint16(at + 6) / 2;
  const endAt = at + 14;
  const startAt = endAt + segmentCount * 2 + 2;
  const deltaAt = startAt + segmentCount * 2;
  const rangeAt = deltaAt + segmentCount * 2;
  for (let segment = 0; segment < segmentCount; segment++) {
    const end = view.getUint16(endAt + segment * 2);
    const start = view.getUint16(startAt + segment * 2);
    const delta = view.getUint16(deltaAt + segment * 2);
    const rangeOffset = view.getUint16(rangeAt + segment * 2);
    for (let codePoint = start; codePoint <= end; codePoint++) {
      if (codePoint === LAST_BMP_CODE_POINT) continue;
      let glyph: number;
      if (rangeOffset === 0) {
        glyph = (codePoint + delta) & 0xffff;
      } else {
        const glyphAt = rangeAt + segment * 2 + rangeOffset + (codePoint - start) * 2;
        if (glyphAt + 2 > view.byteLength) continue;
        const indexed = view.getUint16(glyphAt);
        glyph = indexed === 0 ? 0 : (indexed + delta) & 0xffff;
      }
      if (glyph !== 0) covered.add(codePoint);
    }
  }
}

/** Format 12: groups of consecutive code points with consecutive glyphs. */
function addFormat12(view: DataView, at: number, covered: Set<number>): void {
  const groupCount = view.getUint32(at + 12);
  for (let group = 0; group < groupCount; group++) {
    const groupAt = at + FORMAT_12_HEADER_BYTES + group * FORMAT_12_GROUP_BYTES;
    const start = view.getUint32(groupAt);
    const end = Math.min(view.getUint32(groupAt + 4), MAX_CODE_POINT);
    const firstGlyph = view.getUint32(groupAt + 8);
    for (let codePoint = start; codePoint <= end; codePoint++) {
      if (firstGlyph + (codePoint - start) !== 0) covered.add(codePoint);
    }
  }
}

/** True for the Unicode encodings: platform 0, and platform 3 with encoding 1 or 10. */
function isUnicodeEncoding(platformId: number, encodingId: number): boolean {
  return platformId === 0 || (platformId === 3 && (encodingId === 1 || encodingId === 10));
}

function readCmap(cmap: Uint8Array): Set<number> {
  const view = new DataView(cmap.buffer, cmap.byteOffset, cmap.byteLength);
  const subtableCount = view.getUint16(2);
  const covered = new Set<number>();
  let readAny = false;
  for (let index = 0; index < subtableCount; index++) {
    const recordAt = 4 + index * 8;
    if (!isUnicodeEncoding(view.getUint16(recordAt), view.getUint16(recordAt + 2))) continue;
    const at = view.getUint32(recordAt + 4);
    const format = view.getUint16(at);
    if (format === 4) addFormat4(view, at, covered);
    else if (format === 12) addFormat12(view, at, covered);
    else continue;
    readAny = true;
  }
  if (!readAny) throw new Error('the cmap table has no Unicode subtable of format 4 or 12');
  return covered;
}

function guarded(read: () => Set<number>): CmapResult {
  try {
    return { ok: true, codePoints: read() };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

/** The code points a `cmap` table covers. */
export function cmapCodePoints(cmap: Uint8Array): CmapResult {
  return guarded(() => readCmap(cmap));
}

/** The code points a woff2 file covers. */
export function woff2CodePoints(bytes: Uint8Array): CmapResult {
  return guarded(() => readCmap(woff2CmapTable(bytes)));
}

/** The code points a plain .ttf or .otf file covers. */
export function sfntCodePoints(bytes: Uint8Array): CmapResult {
  return guarded(() => readCmap(sfntCmapTable(bytes)));
}
