import type { Pattern, Violation } from '../codec/index.ts';

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
  width: number;
  height: number;
  bitDepth: 1 | 8;
  rowStride: number; // 4 * ceil(width * bitDepth / 32)
  colourEntries: 2 | 256;
  pixelOffset: number; // 14 + 40 + 4 * colourEntries
  imageSize: number; // rowStride * height
  fileSize: number; // pixelOffset + imageSize
};
