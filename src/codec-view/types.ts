import type { Violation } from '../codec/index.ts';

/**
 * The text of one card: Ends_Per_Pick characters of '0' or '1', character e being end e (R1.1).
 * No Group_Separator and no other character.
 */
export type BitLine = string;

/** One card as a line of bits, with its pick index. */
export type BitsLine = { kind: 'bits'; pick: number; bits: BitLine };

/** One card that failed validateCardGrid: its pick index and the violations, in place of a Bit_Line (R1.9). */
export type DamagedLine = { kind: 'damaged'; pick: number; violations: ReadonlyArray<Violation> };

export type Line = BitsLine | DamagedLine;

/** The card geometry a Line_Set was built with. Two Line_Sets compare only when their headers agree (R6.9, R6.10). */
export type LineSetHeader = {
  profileName: string;
  hookRows: number;
  hookColumns: number;
  endsPerPick: number;
};

export type LineSet = LineSetHeader & { lines: ReadonlyArray<Line> };

export type BitsResult =
  | { ok: true; bits: BitLine }
  | { ok: false; violations: ReadonlyArray<Violation> };

export type LinesFailure = { reason: 'not-a-pattern'; location: string; message: string };

export type LinesResult = { ok: true; lineSet: LineSet } | { ok: false; failure: LinesFailure };

export type DiffEntry =
  | { kind: 'unchanged'; first: Line; second: Line }
  | { kind: 'changed'; first: BitsLine; second: BitsLine; changedHoles: ReadonlyArray<number> }
  | { kind: 'added'; second: Line }
  | { kind: 'removed'; first: Line };

export type DiffCounts = { changedHoles: number; addedCards: number; removedCards: number };

export type DiffRefusal =
  | {
      reason: 'dimension-mismatch';
      first: { hookRows: number; hookColumns: number };
      second: { hookRows: number; hookColumns: number };
    }
  | { reason: 'profile-mismatch'; firstProfileName: string; secondProfileName: string }
  | { reason: 'too-many-picks'; limit: number; firstPicks: number; secondPicks: number };

export type Diff =
  | { ok: false; refusal: DiffRefusal }
  | {
      ok: true;
      first: LineSetHeader;
      second: LineSetHeader;
      entries: ReadonlyArray<DiffEntry>;
      counts: DiffCounts;
    };

export type ApplyFailure =
  | { reason: 'refused-diff'; refusal: DiffRefusal }
  | { reason: 'header-mismatch'; expected: LineSetHeader; actual: LineSetHeader }
  | { reason: 'lines-mismatch'; pick: number; message: string };

export type ApplyResult = { ok: true; lineSet: LineSet } | { ok: false; failure: ApplyFailure };

/** The pairing the Alignment produced: matched pick index pairs, ascending on both sides. */
export type Alignment = ReadonlyArray<{ firstPick: number; secondPick: number }>;
