import type { CardProfile } from '../codec/index.ts';
import { encodeCardGrid, endsPerPick } from '../codec/index.ts';
import type { BitLine, BitsResult, Line, LinesResult } from './types.ts';

/** The character written between each group of hookColumns ends, a reading aid only (R2.2). */
export const GROUP_SEPARATOR = '|';

/** The Bit_Line character of an end whose hook is raised by a punched hole, and of an end left down. */
const LIFTED_END = '1';
const END_DOWN = '0';

/**
 * One card as a Bit_Line of endsPerPick(profile) characters: '1' at every end the ends list from
 * encodeCardGrid lifts, '0' at every other end (R1.1, R1.2). The ends list is the only mapping
 * from a hook position to an end (R1.3). A card that fails validateCardGrid comes back as the
 * violations src/codec returned, with no Bit_Line (R1.4).
 *
 * Neither the profile nor the card is written to (R1.7).
 */
export function cardToBits(profile: CardProfile, card: unknown): BitsResult {
  const ends = encodeCardGrid(profile, card);
  if (!ends.ok) return { ok: false, violations: ends.violations };
  // One character per end, in the end order encodeCardGrid produced; its length is endsPerPick(profile).
  return { ok: true, bits: ends.value.map((lifted) => (lifted ? LIFTED_END : END_DOWN)).join('') };
}

/** Names the kind of a Pattern that is not an array, for the not-a-pattern message (R1.10). */
function describePattern(pattern: unknown): string {
  if (pattern === null) return 'null';
  return typeof pattern;
}

/**
 * A Pattern as a Line_Set: the Card_Profile name, hookRows, hookColumns, Ends_Per_Pick and one
 * Line per card, Line p carrying pick index p, the pick indices ascending from 0 with no gap and
 * no repeat (R1.5, R1.6). A card that fails validateCardGrid becomes a damaged Line holding its
 * violations at that pick, every other pick keeping its Bit_Line (R1.9); a Pattern that is not an
 * array fails as not-a-pattern with the Pattern as the location, and comes back with no Line_Set
 * and no Lines (R1.10).
 *
 * Neither the profile nor the Pattern is written to, and two calls with equal inputs give equal
 * results, because each Line is built only from what cardToBits returned (R1.7).
 */
export function patternToLines(profile: CardProfile, pattern: unknown): LinesResult {
  if (!Array.isArray(pattern)) {
    return {
      ok: false,
      failure: {
        reason: 'not-a-pattern',
        location: 'pattern',
        message: `pattern must be an array of cards, one per pick, got ${describePattern(pattern)}`,
      },
    };
  }
  // Typed back to unknown: Array.isArray widens an unknown to an array of any, and a card stays unknown
  // until cardToBits puts it through validateCardGrid.
  const cards: ReadonlyArray<unknown> = pattern;
  const lines: ReadonlyArray<Line> = cards.map((card, pick) => {
    const read = cardToBits(profile, card);
    return read.ok
      ? { kind: 'bits', pick, bits: read.bits }
      : { kind: 'damaged', pick, violations: read.violations };
  });
  return {
    ok: true,
    lineSet: {
      profileName: profile.name,
      hookRows: profile.hookRows,
      hookColumns: profile.hookColumns,
      endsPerPick: endsPerPick(profile),
      lines,
    },
  };
}

/**
 * The Bit_Line with one GROUP_SEPARATOR between each group of hookColumns ends, none before the
 * first group and none after the last (R2.2).
 *
 * A hookColumns that is not a positive whole number has no groups to cut on, so the Bit_Line comes
 * back ungrouped rather than throwing (R1.8).
 */
export function groupBits(bits: BitLine, hookColumns: number): string {
  if (typeof bits !== 'string') return '';
  if (!Number.isInteger(hookColumns) || hookColumns < 1) return bits;
  const groups: string[] = [];
  for (let endIndex = 0; endIndex < bits.length; endIndex += hookColumns) {
    groups.push(bits.slice(endIndex, endIndex + hookColumns));
  }
  return groups.join(GROUP_SEPARATOR);
}
