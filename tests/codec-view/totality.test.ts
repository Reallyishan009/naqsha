/**
 * Property 10 of the Code view design (task 1.20): the Codec_View_Module is total.
 *
 * R1.8 says the module returns every failure as a value and throws for no input value, and names
 * the shapes it must survive: a card that is not an array, a card with the wrong number of hook
 * rows or hook columns, a hook position that is not a boolean, and a Pattern that is not an array.
 * R6.9 to R6.11 say what `diffPatterns` does with two Line_Sets it cannot compare: it refuses with
 * a reason carrying the values that reason names, and returns no Diff_Entries and no Diff_Counts.
 *
 * So the one property of this file hands each of `cardToBits`, `patternToLines`, `groupBits`,
 * `diffPatterns`, `applyDiff` and `diffToText` a value from `fc.anything()` and from each of those
 * named shapes, and asks of every call only that it come back with a value. Every export is
 * imported from `src/codec-view/index.ts`, so the property also reads the module's public surface
 * (R8.1).
 *
 * The property body catches a throw so that it can report which function threw and what it threw;
 * the property runner itself is not wrapped, and nothing hides a failure message (R12.9). Every card
 * dimension, pick count and pick limit comes from the generated Card_Profile, from a generated
 * Line_Set or from the exported `DIFF_PICK_LIMIT`, and none is written here as a literal (R12.3).
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardProfile } from '../../src/codec/index.ts';
import {
  DIFF_PICK_LIMIT,
  applyDiff,
  cardToBits,
  diffPatterns,
  diffToText,
  groupBits,
  patternToLines,
  type Diff,
  type DiffRefusal,
  type Line,
  type LineSet,
} from '../../src/codec-view/index.ts';
import { diffRefusalArbitrary, lineSetArbitrary } from '../support/lineSets.ts';
import { cardGridArbitrary, profileArbitrary } from '../support/profiles.ts';

/** The seed and run count of this property, written here so a failure can be replayed (R12.4). */
const TOTALITY_SEED = 11_820;
const TOTALITY_RUNS = 200;

/**
 * How many picks the Line_Sets of this property hold. The range includes 0 picks and 1 pick, and
 * the number of picks is a pick count and not a card dimension (R12.3).
 */
const SMALL_PICKS = { minPicks: 0, maxPicks: 4 };

/** Any value at all: R1.8's "any input value". */
const anyValue: fc.Arbitrary<unknown> = fc.anything();

/** Any value that is not an array, the shape R1.8 names for a card and for a Pattern. */
const notAnArray: fc.Arbitrary<unknown> = fc.anything().filter((value) => !Array.isArray(value));

/** Any value that is not a boolean, the shape R1.8 names for a hook position. */
const notABoolean: fc.Arbitrary<unknown> = fc.anything().filter((value) => typeof value !== 'boolean');

/**
 * Hands a value to a function whose declared parameter type it does not satisfy. R1.8 is about what
 * the module does when such a value reaches it while the app runs, which no type can state.
 */
function asGiven<Value>(value: unknown): Value {
  return value as Value;
}

/** What a throw is reported as, without calling a method on the thrown value that might throw too. */
function describeThrown(thrown: unknown): string {
  return thrown instanceof Error
    ? `${thrown.name}: ${thrown.message}`
    : `the value ${Object.prototype.toString.call(thrown)}`;
}

/** Whether a value can be read field by field, so a returned result can be checked for its shape. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Why a returned value is not a result value — one carrying `ok` — or nothing where it is one. */
function resultShape(value: unknown): string | undefined {
  if (!isRecord(value)) return `${typeof value}, which carries no ok field`;
  return typeof value.ok === 'boolean' ? undefined : 'an object carrying no ok field';
}

/** Why a returned value is not text, or nothing where it is text. */
function textShape(value: unknown): string | undefined {
  return typeof value === 'string' ? undefined : `${typeof value}, which is not text`;
}

/**
 * Calls one export and reports what R1.8 forbids: a throw, and a call that comes back with no
 * value. The returned value is the one the call gave, or nothing where the call broke R1.8, so a
 * later check reads only a value the function really returned.
 */
function totalCall<Value>(
  problems: string[],
  name: string,
  run: () => Value,
  shape: (value: unknown) => string | undefined,
): Value | undefined {
  let returned: Value;
  try {
    returned = run();
  } catch (thrown) {
    problems.push(`${name} threw ${describeThrown(thrown)}`);
    return undefined;
  }
  if (returned === undefined) {
    problems.push(`${name} returned no value`);
    return undefined;
  }
  const wrong = shape(returned);
  if (wrong !== undefined) problems.push(`${name} returned ${wrong}`);
  return returned;
}

/** The same Line at another pick index, built fresh so no Line of a generated Line_Set is written to. */
function atPick(line: Line, pick: number): Line {
  return line.kind === 'bits'
    ? { kind: 'bits', pick, bits: line.bits }
    : { kind: 'damaged', pick, violations: line.violations };
}

/** `count` Lines taken round and round the given Lines, numbered from pick 0 upwards (R1.6). */
function repeatLines(lines: ReadonlyArray<Line>, count: number): Line[] {
  return Array.from({ length: count }, (_, pick) => atPick(lines[pick % lines.length]!, pick));
}

/**
 * One side of a comparison: the value handed to `diffPatterns`, and, where that value is a
 * Line_Set, the Card_Profile name, hook counts and pick count it carries, so that a refusal can be
 * checked against them (R6.9 to R6.11). A side that is not a Line_Set carries none of them.
 */
type Side = {
  given: unknown;
  carried?: { profileName: string; hookRows: number; hookColumns: number; picks: number };
};

function sideOf(lineSet: LineSet): Side {
  return {
    given: lineSet,
    carried: {
      profileName: lineSet.profileName,
      hookRows: lineSet.hookRows,
      hookColumns: lineSet.hookColumns,
      picks: lineSet.lines.length,
    },
  };
}

/**
 * A card for the profile that `validateCardGrid` rejects, over the three shapes R1.8 names: a card
 * that is not an array, a card with the wrong number of hook rows or of hook columns, and a card
 * with a hook position that is not a boolean. Every length comes from the generated card, so no
 * card dimension is written here (R12.3).
 */
function damagedCardArbitrary(profile: CardProfile): fc.Arbitrary<unknown> {
  const valid = cardGridArbitrary(profile);
  const wrongHookRowCount = valid.chain((card) =>
    fc.oneof(
      fc.integer({ min: 0, max: card.length - 1 }).map((kept) => card.slice(0, kept)),
      fc.integer({ min: 1, max: card.length }).map((extra) => [...card, ...card.slice(0, extra)]),
    ),
  );
  const wrongHookColumnCount = valid.chain((card) =>
    fc
      .tuple(
        fc.integer({ min: 0, max: card.length - 1 }),
        fc.integer({ min: 0, max: card[0]!.length - 1 }),
      )
      .map(([hookRow, kept]) =>
        card.map((row, at) => (at === hookRow ? row.slice(0, kept) : row)),
      ),
  );
  const notABooleanHookPosition = valid.chain((card) =>
    fc
      .tuple(
        fc.integer({ min: 0, max: card.length - 1 }),
        fc.integer({ min: 0, max: card[0]!.length - 1 }),
        notABoolean,
      )
      .map(([hookRow, hookColumn, value]) =>
        card.map((row, at) =>
          at === hookRow ? row.map((punchedHole, on) => (on === hookColumn ? value : punchedHole)) : row,
        ),
      ),
  );
  return fc.oneof(notAnArray, wrongHookRowCount, wrongHookColumnCount, notABooleanHookPosition, anyValue);
}

/** A valid card for the profile, read as any value, so a Pattern can mix valid and damaged cards. */
function validCardArbitrary(profile: CardProfile): fc.Arbitrary<unknown> {
  return cardGridArbitrary(profile).map((card): unknown => card);
}

/**
 * A Pattern that is not an array, and an array holding valid cards, damaged cards and junk — the
 * Pattern shapes R1.8 and R1.9 name.
 */
function junkPatternArbitrary(profile: CardProfile): fc.Arbitrary<unknown> {
  const cards = fc.oneof(validCardArbitrary(profile), damagedCardArbitrary(profile), anyValue);
  return fc.oneof(
    notAnArray,
    anyValue,
    fc.array(cards, { minLength: 0, maxLength: SMALL_PICKS.maxPicks }),
  );
}

/**
 * One side of a comparison: a Line_Set as `patternToLines` builds it, one carrying a different
 * Card_Profile name (R6.10), one carrying different hook counts (R6.9), one longer than the
 * Diff_Pick_Limit (R6.11), one holding damaged Lines (R1.9), and a value that is no Line_Set at all.
 */
function sideArbitrary(profile: CardProfile): fc.Arbitrary<Side> {
  const small = lineSetArbitrary(profile, SMALL_PICKS);
  const plain = small.map(sideOf);
  const renamed = fc
    .tuple(small, fc.string({ minLength: 1, maxLength: 6 }))
    .map(([lineSet, suffix]) => sideOf({ ...lineSet, profileName: `${lineSet.profileName}-${suffix}` }));
  const spread = fc.integer({ min: 1, max: 4 });
  const resized = fc
    .tuple(small, spread, spread)
    .map(([lineSet, hookRowSpread, hookColumnSpread]) =>
      sideOf({
        ...lineSet,
        hookRows: lineSet.hookRows + hookRowSpread,
        hookColumns: lineSet.hookColumns + hookColumnSpread,
      }),
    );
  const oversized = fc
    .tuple(lineSetArbitrary(profile, { minPicks: 1, maxPicks: 2 }), fc.integer({ min: 1, max: 3 }))
    .map(([lineSet, over]) =>
      sideOf({ ...lineSet, lines: repeatLines(lineSet.lines, DIFF_PICK_LIMIT + over) }),
    );
  const damaged = fc
    .array(fc.oneof(validCardArbitrary(profile), damagedCardArbitrary(profile)), {
      minLength: 1,
      maxLength: SMALL_PICKS.maxPicks,
    })
    .map((pattern) => {
      const lines = patternToLines(profile, pattern);
      return lines.ok ? sideOf(lines.lineSet) : { given: pattern };
    });
  const junk: fc.Arbitrary<Side> = anyValue.map((given) => ({ given }));
  return fc.oneof(plain, renamed, resized, oversized, damaged, junk);
}

/**
 * A value handed to `applyDiff` and `diffToText` in place of a Diff: a Diff `diffPatterns`
 * produced, a refusal over the three reasons, a Diff with one field replaced by junk, and a value
 * that is no Diff at all.
 */
function junkDiffArbitrary(profile: CardProfile): fc.Arbitrary<unknown> {
  const small = lineSetArbitrary(profile, SMALL_PICKS);
  const compared: fc.Arbitrary<Diff> = fc
    .tuple(small, small)
    .map(([first, second]) => diffPatterns(first, second));
  const mangled: fc.Arbitrary<unknown> = fc.oneof(
    anyValue.map((field): unknown => ({ ok: false, refusal: field })),
    anyValue.map((field): unknown => ({ ok: true, entries: field })),
    fc.tuple(compared, anyValue).map(([diff, field]): unknown => ({ ...diff, entries: field })),
    fc.tuple(compared, anyValue).map(([diff, field]): unknown => ({ ...diff, first: field })),
    fc.tuple(compared, anyValue).map(([diff, field]): unknown => ({ ...diff, counts: field })),
    fc
      .tuple(compared, fc.array(anyValue, { maxLength: 3 }))
      .map(([diff, entries]): unknown => ({ ...diff, entries })),
  );
  return fc.oneof(
    compared.map((diff): unknown => diff),
    diffRefusalArbitrary(profile).map((diff): unknown => diff),
    mangled,
    anyValue,
  );
}

/** Every input of one run: a valid Card_Profile, and a junk value for each export that takes one. */
type TotalityInputs = {
  profile: CardProfile;
  card: unknown;
  pattern: unknown;
  bits: unknown;
  hookColumns: unknown;
  first: Side;
  second: Side;
  diff: unknown;
};

const totalityInputsArbitrary: fc.Arbitrary<TotalityInputs> = profileArbitrary.chain((profile) =>
  fc.record({
    profile: fc.constant(profile),
    card: fc.oneof(validCardArbitrary(profile), damagedCardArbitrary(profile), anyValue),
    pattern: junkPatternArbitrary(profile),
    bits: fc.oneof(
      validCardArbitrary(profile).map((card): unknown => {
        const read = cardToBits(profile, card);
        return read.ok ? read.bits : undefined;
      }),
      fc.string(),
      anyValue,
    ),
    // The hookColumns groupBits is asked to cut on: the profile's own count, and junk counts that
    // have no groups in them — zero, negative, fractional, not a number at all.
    hookColumns: fc.oneof(
      fc.constant<unknown>(profile.hookColumns),
      fc.constant<unknown>(0),
      fc.constant<unknown>(Number.NaN),
      fc.constant<unknown>(Number.POSITIVE_INFINITY),
      fc.integer().map((count): unknown => count),
      fc.double().map((count): unknown => count),
      anyValue,
    ),
    first: sideArbitrary(profile),
    second: sideArbitrary(profile),
    diff: junkDiffArbitrary(profile),
  }),
);

/** Whether the two sides are a pair `diffPatterns` has no reason to refuse (R6.9 to R6.11). */
function comparable(first: Side, second: Side): boolean {
  if (first.carried === undefined || second.carried === undefined) return false;
  return (
    first.carried.profileName === second.carried.profileName &&
    first.carried.hookRows === second.carried.hookRows &&
    first.carried.hookColumns === second.carried.hookColumns &&
    first.carried.picks <= DIFF_PICK_LIMIT &&
    second.carried.picks <= DIFF_PICK_LIMIT
  );
}

/** Why a hook count a refusal carries is not the number that side carries, or nothing where it is. */
function dimensionProblems(
  carried: { hookRows: number; hookColumns: number },
  side: Side,
  which: string,
): string[] {
  const problems: string[] = [];
  if (typeof carried.hookRows !== 'number' || typeof carried.hookColumns !== 'number') {
    problems.push(`a dimension-mismatch refusal carries no hook counts for the ${which} side (R6.9)`);
    return problems;
  }
  if (side.carried === undefined) return problems;
  if (carried.hookRows !== side.carried.hookRows || carried.hookColumns !== side.carried.hookColumns) {
    problems.push(
      `a dimension-mismatch refusal carries ${carried.hookRows} hook rows and ${carried.hookColumns} hook columns for the ${which} side, which carries ${side.carried.hookRows} and ${side.carried.hookColumns} (R6.9)`,
    );
  }
  return problems;
}

/**
 * Why a refusal does not carry the values its reason names (R6.9 to R6.11), or nothing where it
 * does. The values of a side that is no Line_Set are only checked for their kind, because such a
 * side carries no Card_Profile name, no hook counts and no picks of its own.
 */
function refusalProblems(refusal: DiffRefusal, first: Side, second: Side): string[] {
  const problems: string[] = [];
  switch (refusal.reason) {
    case 'profile-mismatch': {
      if (
        typeof refusal.firstProfileName !== 'string' ||
        typeof refusal.secondProfileName !== 'string'
      ) {
        problems.push('a profile-mismatch refusal does not carry both Card_Profile names as text (R6.10)');
        break;
      }
      if (refusal.firstProfileName === refusal.secondProfileName) {
        problems.push(
          `a profile-mismatch refusal carries '${refusal.firstProfileName}' on both sides, so it names no mismatch (R6.10)`,
        );
      }
      if (first.carried !== undefined && refusal.firstProfileName !== first.carried.profileName) {
        problems.push(
          `a profile-mismatch refusal carries '${refusal.firstProfileName}' where the first Line_Set carries '${first.carried.profileName}' (R6.10)`,
        );
      }
      if (second.carried !== undefined && refusal.secondProfileName !== second.carried.profileName) {
        problems.push(
          `a profile-mismatch refusal carries '${refusal.secondProfileName}' where the second Line_Set carries '${second.carried.profileName}' (R6.10)`,
        );
      }
      break;
    }
    case 'dimension-mismatch': {
      problems.push(...dimensionProblems(refusal.first, first, 'first'));
      problems.push(...dimensionProblems(refusal.second, second, 'second'));
      if (
        refusal.first.hookRows === refusal.second.hookRows &&
        refusal.first.hookColumns === refusal.second.hookColumns
      ) {
        problems.push('a dimension-mismatch refusal carries the same hook counts twice, so it names no mismatch (R6.9)');
      }
      break;
    }
    case 'too-many-picks': {
      if (refusal.limit !== DIFF_PICK_LIMIT) {
        problems.push(
          `a too-many-picks refusal carries the limit ${String(refusal.limit)}, not the Diff_Pick_Limit (R6.11)`,
        );
      }
      if (typeof refusal.firstPicks !== 'number' || typeof refusal.secondPicks !== 'number') {
        problems.push('a too-many-picks refusal does not carry the pick count of both Line_Sets (R6.11)');
        break;
      }
      if (refusal.firstPicks <= DIFF_PICK_LIMIT && refusal.secondPicks <= DIFF_PICK_LIMIT) {
        problems.push(
          `a too-many-picks refusal carries ${refusal.firstPicks} and ${refusal.secondPicks} picks, neither over the limit (R6.11)`,
        );
      }
      if (first.carried !== undefined && refusal.firstPicks !== first.carried.picks) {
        problems.push(
          `a too-many-picks refusal carries ${refusal.firstPicks} picks where the first Line_Set holds ${first.carried.picks} (R6.11)`,
        );
      }
      if (second.carried !== undefined && refusal.secondPicks !== second.carried.picks) {
        problems.push(
          `a too-many-picks refusal carries ${refusal.secondPicks} picks where the second Line_Set holds ${second.carried.picks} (R6.11)`,
        );
      }
      break;
    }
  }
  return problems;
}

/** Why the Diff of two sides is not what R6.9 to R6.11 allow, or nothing where it is. */
function diffProblems(diff: Diff, first: Side, second: Side): string[] {
  if (!diff.ok) {
    const problems = refusalProblems(diff.refusal, first, second);
    // A refusal returns no Diff_Entries and no Diff_Counts (R6.9, R6.10, R6.11).
    if ('entries' in diff) problems.push(`a ${diff.refusal.reason} refusal carries Diff_Entries (R6.9 to R6.11)`);
    if ('counts' in diff) problems.push(`a ${diff.refusal.reason} refusal carries Diff_Counts (R6.9 to R6.11)`);
    if (comparable(first, second)) {
      problems.push(
        `two Line_Sets of one Card_Profile name, one card geometry and no more than ${DIFF_PICK_LIMIT} picks were refused with ${diff.refusal.reason} (R6.9 to R6.11)`,
      );
    }
    return problems;
  }
  const problems: string[] = [];
  if (!Array.isArray(diff.entries)) problems.push('a Diff that is no refusal carries no Diff_Entries (R5.1)');
  if (!isRecord(diff.counts)) problems.push('a Diff that is no refusal carries no Diff_Counts (R5.1)');
  return problems;
}

describe('the Codec_View_Module is total', () => {
  it('R1.8 every exported function returns a value and throws nothing', () => {
    // **Validates: Requirements R1.8, R6.9, R6.10, R6.11**
    fc.assert(
      fc.property(totalityInputsArbitrary, (inputs) => {
        const problems: string[] = [];

        totalCall(problems, 'cardToBits', () => cardToBits(inputs.profile, inputs.card), resultShape);
        totalCall(
          problems,
          'patternToLines',
          () => patternToLines(inputs.profile, inputs.pattern),
          resultShape,
        );
        totalCall(
          problems,
          'groupBits',
          () => groupBits(asGiven(inputs.bits), asGiven(inputs.hookColumns)),
          textShape,
        );

        const compared = totalCall(
          problems,
          'diffPatterns',
          () => diffPatterns(asGiven(inputs.first.given), asGiven(inputs.second.given)),
          resultShape,
        );
        if (compared !== undefined) {
          problems.push(...diffProblems(compared, inputs.first, inputs.second));
          totalCall(
            problems,
            'applyDiff on the Diff of these two sides',
            () => applyDiff(asGiven(inputs.first.given), compared),
            resultShape,
          );
          totalCall(
            problems,
            'diffToText on the Diff of these two sides',
            () => diffToText(compared),
            textShape,
          );
        }

        totalCall(
          problems,
          'applyDiff on the given Diff',
          () => applyDiff(asGiven(inputs.first.given), asGiven(inputs.diff)),
          resultShape,
        );
        totalCall(
          problems,
          'diffToText on the given Diff',
          () => diffToText(asGiven(inputs.diff)),
          textShape,
        );

        expect(problems).toEqual([]);
      }),
      { seed: TOTALITY_SEED, numRuns: TOTALITY_RUNS },
    );
  });
});
