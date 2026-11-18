# Design Document

## Overview

`src/exporter` writes a Pattern as an uncompressed BMP and reads such files back. Everything except the download helper is pure TypeScript over `Uint8Array` and `DataView`, so it runs and is tested in Node. It reuses `parseCardProfile`, `validateCardGrid`, `encodeCardGrid` and `decodeEnds` from `src/codec`, and adds no dependency.

### Key decisions

| Decision | Choice | Reason |
|---|---|---|
| End order | Each pick's ends come from `encodeCardGrid`; reading back uses `decodeEnds` | The profile's `endOrder` is the only source of end positions (R2.2, R6.6) |
| Byte writing | One `Uint8Array` of the exact file size, written through a `DataView` with little-endian setters | No library, exact size known before writing (R3) |
| Row storage | Positive height, rows stored bottom-up, as plain BMP requires | Widest reader support (R3.2) |
| Colour table | 1-bit: 2 entries; 8-bit: 256 entries, unused ones equal to index 0 | R4 and the review decision |
| Resolution fields | 0 | Accepted by common readers; not specified by R3 |
| Reader scope | Only the variants this exporter writes | Round trip and re-import, not a general BMP reader (R6.2) |
| Browser API | Only `download.ts` (Blob, object URL, anchor click), with injectable dependencies | R8.2; tests run in Node with fakes |
| Imports | `src/exporter` imports only `src/codec`; relative imports use `.ts` | R10.1; the sample script runs the module under plain Node |

## Architecture

```
src/exporter/
  types.ts       ExportOptions, ExportFailure, ReadFailure, ExportResult, ReadResult, BmpLayout
  options.ts     DEFAULT_EXPORT_OPTIONS, parseExportOptions
  layout.ts      bmpLayout (row stride, colour table size, offsets, sizes)
  exportBmp.ts   exportPatternBmp
  readBmp.ts     readPatternBmp
  download.ts    bmpFileName, downloadBmp   (the only browser-API file)
  index.ts       re-exports
scripts/export_sample.ts   writes media/sample-design-1bit.bmp and media/sample-design-8bit.bmp
tests/exporter/            one test file per source file
```

Data flow:

```
profile, pattern, options
   -> parseCardProfile, parseExportOptions        (invalid-profile, invalid-options)
   -> validateCardGrid per pick                   (invalid-card, empty-pattern)
   -> encodeCardGrid per pick -> ends
   -> bmpLayout(width, height, bitDepth)
   -> write headers, colour table, rows           -> Uint8Array

bytes, profile, options
   -> parseCardProfile, parseExportOptions
   -> check headers and sizes                     (not-a-bmp, unsupported-bmp, inconsistent-size, width-mismatch)
   -> colour table entry per pixel -> lifted?     (unknown-colour)
   -> decodeEnds per pick -> Pattern
```

## Components and Interfaces

```ts
// types.ts
export type ExportOptions = {
  bitDepth: 1 | 8;
  liftColour: 'black' | 'white';
  pickOrder: 'first-at-top' | 'first-at-bottom';
  endOrder: 'first-at-left' | 'first-at-right';
};

export type ExportFailure =
  | { reason: 'invalid-profile'; violations: Violation[] }
  | { reason: 'invalid-card'; picks: { pick: number; violations: Violation[] }[] }
  | { reason: 'empty-pattern' }
  | { reason: 'invalid-options'; option: string; message: string };

export type ReadFailure =
  | { reason: 'invalid-profile'; violations: Violation[] }
  | { reason: 'invalid-options'; option: string; message: string }
  | { reason: 'not-a-bmp' }
  | { reason: 'unsupported-bmp'; field: string; value: number }
  | { reason: 'inconsistent-size'; field: string; expected: number; actual: number }
  | { reason: 'width-mismatch'; fileWidth: number; profileWidth: number }
  | { reason: 'unknown-colour'; pick: number; end: number };

export type ExportResult = { ok: true; bytes: Uint8Array } | { ok: false; failure: ExportFailure };
export type ReadResult = { ok: true; pattern: Pattern } | { ok: false; failure: ReadFailure };

export type BmpLayout = {
  width: number; height: number; bitDepth: 1 | 8;
  rowStride: number;          // 4 * ceil(width * bitDepth / 32)
  colourEntries: 2 | 256;
  pixelOffset: number;        // 14 + 40 + 4 * colourEntries
  imageSize: number;          // rowStride * height
  fileSize: number;           // pixelOffset + imageSize
};
```

```ts
// options.ts
export const DEFAULT_EXPORT_OPTIONS: ExportOptions;   // 1, 'black', 'first-at-top', 'first-at-left'
export function parseExportOptions(input: unknown):
  { ok: true; value: ExportOptions } | { ok: false; failure: { reason: 'invalid-options'; option: string; message: string } };
// layout.ts
export function bmpLayout(width: number, height: number, bitDepth: 1 | 8): BmpLayout;
// exportBmp.ts
export function exportPatternBmp(profile: unknown, pattern: unknown, options?: unknown): ExportResult;
// readBmp.ts
export function readPatternBmp(bytes: unknown, profile: unknown, options?: unknown): ReadResult;
// download.ts
export function bmpFileName(baseName: string, bitDepth: 1 | 8): string;
export type DownloadDeps = {
  createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void;
  createAnchor(): { href: string; download: string; click(): void };
  makeBlob(bytes: Uint8Array, type: string): Blob;
};
export function downloadBmp(bytes: Uint8Array, fileName: string, deps?: DownloadDeps): void;
```

`parseExportOptions(undefined)` returns the defaults; a partial object fills missing fields from the defaults. Options are checked in the order `bitDepth`, `liftColour`, `pickOrder`, `endOrder`, and the first bad one is reported.

## Algorithms

### Pixel placement

With `width = hookRows * hookColumns` and `height = pattern.length`:

- Image row `r` (counted from the top as a viewer shows it) holds pick `p = r` for `first-at-top`, or `p = height - 1 - r` for `first-at-bottom`.
- Stored row `s` (counted from the start of the pixel data) is image row `r = height - 1 - s`, because rows are stored bottom-up.
- Pixel column `x` holds end `e = x` for `first-at-left`, or `e = width - 1 - x` for `first-at-right`.
- The colour index is 1 when `ends[e]` of pick `p` is `true`, else 0 (R2.3).
- 1-bit: pixel `x` of stored row `s` is bit `7 - (x mod 8)` of byte `pixelOffset + s * rowStride + floor(x / 8)`. 8-bit: it is byte `pixelOffset + s * rowStride + x`. Padding bytes and unused bits stay 0 (R3.3, R3.4).

### Header fields (all little-endian)

| Offset | Size | Field | Value |
|---|---|---|---|
| 0 | 2 | type | `42 4D` (`BM`) |
| 2 | 4 | file size | `fileSize` |
| 6 | 4 | reserved | 0 |
| 10 | 4 | pixel offset | `pixelOffset` |
| 14 | 4 | info header size | 40 |
| 18 | 4 | width | `width` |
| 22 | 4 | height | `height` (positive) |
| 26 | 2 | planes | 1 |
| 28 | 2 | bit depth | 1 or 8 |
| 30 | 4 | compression | 0 (`BI_RGB`) |
| 34 | 4 | image size | `imageSize` |
| 38, 42 | 4 each | pixels per metre (x, y) | 0 |
| 46 | 4 | colours used | 2 or 256 |
| 50 | 4 | important colours | 2 |

The colour table starts at offset 54, 4 bytes per entry in the order blue, green, red, 0. With lift colour `black`, entry 0 is white and entry 1 black; with `white`, the reverse. In the 8-bit table, entries 2 to 255 equal entry 0 (R4).

### Size limit

The file size must fit the 32-bit field. Real designs are far below that limit: 10,000 picks of 2,688 ends at 8 bits is about 27 MB. A design whose `fileSize` would exceed `2^31 - 1` is refused as `invalid-options` with option `bitDepth` and a message that the file would be too large. This is the closest reason in R9.2; see "Decisions to confirm".

### Reading back

`readPatternBmp` checks in this order and returns the first failure:

1. Profile (`parseCardProfile`) and options (`parseExportOptions`).
2. `bytes` is a `Uint8Array` of at least 54 bytes starting with `BM`, otherwise `not-a-bmp`.
3. Info header size 40, planes 1, bit depth 1 or 8, compression 0, height above 0, width above 0, colours used equal to 2 (1-bit) or 256 (8-bit). Otherwise `unsupported-bmp` with the field and value.
4. Width equal to `hookRows * hookColumns`, otherwise `width-mismatch`.
5. With `bmpLayout(width, height, bitDepth)`: the header file size, the pixel offset, the image size and `bytes.length` must all equal the layout values. Otherwise `inconsistent-size` with the first field that differs, the expected value and the actual value.
6. For each pixel, the colour table entry it uses must equal the lift colour (lifted) or the down colour (not lifted). Otherwise `unknown-colour` with the pick and end.
7. Each pick's ends become a CardGrid through `decodeEnds`.

Every read is bounds-checked against `bytes.length` before it happens, so the reader never reads outside the bytes and never throws (R6.7). Padding bits are ignored.

### Download

`downloadBmp(bytes, name, deps)` makes one Blob of type `image/bmp`, creates an object URL, sets `href` and `download` on an anchor, clicks it, and revokes the URL. The default `deps` use `Blob`, `URL` and `document.createElement('a')`, looked up at call time. `bmpFileName(base, depth)` keeps only letters, digits, `-` and `_` from `base` (falling back to `design` when nothing is left) and returns `<base>-<depth>bit.bmp` (R8.3).

## Data Models

The file layout is the one in "Header fields". `ExportOptions` are not stored in the file beyond what the headers and colour table express (R5.3), so reading back needs the same options.

## Error Handling

| Situation | Result |
|---|---|
| Profile fails `parseCardProfile` | `invalid-profile` with the violations |
| A card fails `validateCardGrid` | `invalid-card` listing every bad pick with its violations |
| Pattern is not an array, or is empty | `invalid-card` for a non-array, with pick -1; `empty-pattern` for an empty array |
| An option is out of range | `invalid-options` naming the option |
| Reader failures | as listed in "Reading back" |
| Any other input | never throws (R9.1) |

## Testing Strategy

- Properties use fast-check through `fc.assert`, with titles that start with the criterion ID. They reuse `profileArbitrary` and `cardGridArbitrary` from `tests/support/profiles.ts`, plus a new `patternArbitrary(profile)` and `exportOptionsArbitrary`. Default `numRuns`.
- **Known bytes.** `tests/exporter/exportBmp.test.ts` builds a small valid profile with 2 hook rows and 2 hook columns, a row-major `endOrder`, and two picks: pick 0 punched at `[0][0]` and `[1][1]` (ends 1 0 0 1), pick 1 punched at `[1][0]` (ends 0 0 1 0). With default options, the 1-bit export must equal these 70 bytes, written out in the test:

  ```
  42 4D 46 00 00 00 00 00 00 00 3E 00 00 00 28 00 00 00 04 00 00 00 02 00 00 00 01 00 01 00
  00 00 00 00 08 00 00 00 00 00 00 00 00 00 00 00 02 00 00 00 02 00 00 00 FF FF FF 00 00 00
  00 00 20 00 00 00 90 00 00 00
  ```

  The 8-bit export of the same Pattern must be 1,086 bytes. Its first 54 bytes must be:

  ```
  42 4D 3E 04 00 00 00 00 00 00 36 04 00 00 28 00 00 00 04 00 00 00 02 00 00 00 01 00 08 00
  00 00 00 00 08 00 00 00 00 00 00 00 00 00 00 00 00 01 00 00 02 00 00 00
  ```

  Its colour table must be entry 0 `FF FF FF 00`, entry 1 `00 00 00 00`, and entries 2 to 255 `FF FF FF 00`. It must end with the pixel bytes `00 00 01 00 01 00 00 01`.
- `tests/exporter/download.test.ts` checks `downloadBmp` with fakes: one Blob of type `image/bmp`, one click, the URL revoked.
- `scripts/export_sample.ts` writes the sample files in `media/` for viewing; a test checks that two runs give identical bytes.
- `tests/structure/` scans gain `src/exporter`: imports only from `src/exporter` and `src/codec`, browser APIs only in `download.ts`, no `any`, no demo literals, every exported function covered by a property.

## Correctness Properties

Each entry is a fast-check property. The test title is the heading text after `Property N:`, without the final full stop. **Demo** marks properties needed for the demo. **Cut last** marks the ones that may be dropped last if time runs short, which is reported, never silent. No failure-path or round-trip property is cut last.

### Property 1: R1.2 an invalid profile fails with invalid-profile and no bytes.

**Demo.** For any profile mutated to fail `parseCardProfile`, `exportPatternBmp` returns `invalid-profile` with the same violations.

**Validates: Requirements 1.2**

### Property 2: R1.3 any damaged card fails the export and every bad pick is listed.

**Demo.** For any Pattern with one or more damaged cards, the failure is `invalid-card` and lists exactly those picks, each with the violations from `validateCardGrid`.

**Validates: Requirements 1.3**

### Property 3: R1.4 an empty Pattern fails with empty-pattern.

**Demo.** For any valid profile and options, `[]` gives `empty-pattern` and no bytes.

**Validates: Requirements 1.4**

### Property 4: R1.6 exporting and reading do not change their inputs.

**Cut last.** The profile, Pattern, options and bytes are deep-equal to clones taken before the calls.

**Validates: Requirements 1.6**

### Property 5: R2.3 each pixel holds the lift of the end and pick the options place there.

**Demo.** For any profile, Pattern and options, an independent pixel reader written in the test (bit or byte at the stored row and column) gives colour index 1 exactly where `encodeCardGrid` lifts that end in that pick, with the pick and end found from the orientation options as in "Pixel placement".

**Validates: Requirements 2.3**

### Property 6: R7.2 the file size in the header equals the byte length and the layout formula.

**Demo.** For any export, the header file size equals `bytes.length` and `14 + 40 + 4 * colourEntries + rowStride * height`, the pixel offset equals `14 + 40 + 4 * colourEntries`, the image size equals `rowStride * height`, and `rowStride` is the smallest multiple of 4 that holds `width * bitDepth` bits.

**Validates: Requirements 7.2**

### Property 7: R3.3 padding bytes and unused bits are zero.

**Cut last.** For any export, every byte after the last pixel of a stored row, and every unused bit of the last pixel byte in the 1-bit variant, is 0.

**Validates: Requirements 3.3**

### Property 8: R7.3 the colour table is present and matches the lift colour.

**Demo.** For any export, the colour table holds 2 entries (1-bit) or 256 (8-bit), entry 1 is the lift colour, entry 0 the down colour, every reserved byte is 0, and 8-bit entries 2 to 255 equal entry 0.

**Validates: Requirements 7.3**

### Property 9: R5.2 an invalid option fails with invalid-options naming it.

**Demo.** For valid options with one field replaced by an invalid value, export and read both return `invalid-options` naming that field.

**Validates: Requirements 5.2**

### Property 10: R7.1 reading back an exported file returns the original Pattern.

**Demo.** For any valid profile, Pattern and options, `readPatternBmp(exportPatternBmp(...).bytes, profile, options)` returns a Pattern deep-equal to the original.

**Validates: Requirements 7.1**

### Property 11: R7.4 the same input exports identical bytes.

**Demo.** Two exports of the same input are byte-identical, also with other exports in between.

**Validates: Requirements 7.4**

### Property 12: R7.5 the 1-bit and 8-bit files read back to the same Pattern.

**Demo.** For any profile, Pattern and the other options, both variants read back to the same Pattern.

**Validates: Requirements 7.5**

### Property 13: R6.4 a file of the wrong width fails with width-mismatch.

**Demo.** A file exported with one profile and read with a profile of a different end count gives `width-mismatch` with both widths.

**Validates: Requirements 6.4**

### Property 14: R6.5 inconsistent sizes fail with inconsistent-size naming the field.

**Demo.** For any export, changing the header file size, the pixel offset or the image size, or adding or removing bytes at the end, gives `inconsistent-size` naming the first field that differs, or `not-a-bmp` when fewer than 54 bytes remain.

**Validates: Requirements 6.5**

### Property 15: R6.3 a pixel whose colour is neither the lifted nor the down colour fails with unknown-colour.

**Demo.** For any export, changing a colour table entry that some pixel uses to a third colour gives `unknown-colour` at a pick and end that use it.

**Validates: Requirements 6.3**

### Property 16: R6.2 unsupported BMP variants fail with unsupported-bmp naming the field.

**Demo.** For any export, setting the info header size, planes, bit depth (to 4 or 24), compression, height (to 0 or negative) or colours used to another value gives `unsupported-bmp` with that field.

**Validates: Requirements 6.2**

### Property 17: R6.7 reading any bytes never throws.

**Demo.** For any `Uint8Array` (random, truncated exports and exports with random byte changes) and for `fc.anything()`, `readPatternBmp` returns a result.

**Validates: Requirements 6.7**

### Property 18: R9.1 exporting never throws for any input.

**Demo.** `exportPatternBmp` with `fc.anything()` arguments returns a result.

**Validates: Requirements 9.1**

### Property 19: R8.3 file names hold only safe characters and the bit depth.

**Demo.** For any base string and bit depth, `bmpFileName` matches `^[A-Za-z0-9_-]+-(1|8)bit\.bmp$`.

**Validates: Requirements 8.3**

## Decisions

Settled in the design review:

1. **Too-large files.** A file over 2 GB is refused as `invalid-options` with option `bitDepth`. No new reason is added to R9.2.
2. **Non-array Pattern.** Reported as `invalid-card` with pick -1.
3. **Padding on read.** The reader ignores padding bytes and bits.
