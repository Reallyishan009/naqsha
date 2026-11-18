import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { encodeCardGrid } from '../../src/codec/index.ts';
import type { CardProfile } from '../../src/codec/index.ts';
import { computeFloats, prepareCloth } from '../../src/simulator/index.ts';
import type { Float, PreparedCloth } from '../../src/simulator/index.ts';
import { profileArbitrary } from '../support/profiles.ts';
import { slotListArbitrary } from '../support/slots.ts';
import type { SlotSample } from '../support/slots.ts';

const key = (float: Float): string => `${float.set}:${float.pick}:${float.end}:${float.length}`;
const sortedKeys = (floats: readonly Float[]): string[] => floats.map(key).sort();

/**
 * Reference scan over a dense matrix of face threads, written without computeFloats or PreparedCloth.
 * face[pick][end] is 'weft' (lift 0), 'warp' (lift 1) or 'gap' for a missing or damaged pick, over the tiled width.
 */
function referenceFloats(profile: CardProfile, samples: SlotSample[], repeat: number): Float[] {
  const baseEnds = profile.hookRows * profile.hookColumns;
  const width = baseEnds * repeat;
  const face: ('weft' | 'warp' | 'gap')[][] = samples.map((sample) => {
    if (sample.expected !== 'woven') return Array.from({ length: width }, () => 'gap');
    const encoded = encodeCardGrid(profile, sample.slot as boolean[][]);
    if (!encoded.ok) throw new Error('a woven sample must encode');
    return Array.from({ length: width }, (_, end) => (encoded.value[end % baseEnds] ? 'warp' : 'weft'));
  });
  const found: Float[] = [];
  face.forEach((row, pick) => {
    for (let end = 0; end < width; end++) {
      if (row[end] !== 'weft') continue;
      let stop = end;
      while (stop < width && row[stop] === 'weft') stop++;
      if (stop - end >= 2) found.push({ set: 'weft', pick, end, length: stop - end });
      end = stop - 1;
    }
  });
  for (let end = 0; end < width; end++) {
    for (let pick = 0; pick < face.length; pick++) {
      if (face[pick]![end] !== 'warp') continue;
      let stop = pick;
      while (stop < face.length && face[stop]![end] === 'warp') stop++;
      if (stop - pick >= 2) found.push({ set: 'warp', pick, end, length: stop - pick });
      pick = stop - 1;
    }
  }
  return found;
}

describe('computeFloats', () => {
  // Property 8 (R3.2, no float crosses a gap pick) was skipped as cut-last. The reference scan above still treats
  // gap picks as run breaks, so the gap rule is exercised by the property below.
  it('R3.1 computeFloats finds exactly the runs a direct scan finds', () => {
    const input = profileArbitrary.chain((profile) =>
      fc.record({
        profile: fc.constant(profile),
        samples: slotListArbitrary(profile),
        repeat: fc.integer({ min: 1, max: 3 }),
      }),
    );
    fc.assert(
      fc.property(input, ({ profile, samples, repeat }) => {
        const prepared = prepareCloth(profile, samples.map((sample) => sample.slot));
        expect(prepared.ok).toBe(true);
        if (!prepared.ok) return;
        expect(sortedKeys(computeFloats(prepared.value, repeat))).toEqual(
          sortedKeys(referenceFloats(profile, samples, repeat)),
        );
      }),
    );
  });

  it('a 4-end cloth of three woven picks and a gap gives the known floats, in the documented order', () => {
    const [profile] = fc.sample(profileArbitrary, { numRuns: 1, seed: 7 });
    const woven = (lift: number[]) => ({ kind: 'woven' as const, lift: Uint8Array.from(lift) });
    const cloth: PreparedCloth = {
      profile: profile!,
      baseEnds: 4,
      picks: [woven([1, 0, 0, 1]), woven([1, 0, 0, 0]), { kind: 'missing' }, woven([1, 1, 0, 0])],
      gaps: [{ pick: 2, kind: 'missing', violations: [] }],
    };
    // repeat 1. Weft: pick 0 ends 1-2; pick 1 ends 1-3; pick 3 ends 2-3. Warp: end 0 picks 0-1 (gap stops it).
    expect(computeFloats(cloth)).toEqual([
      { set: 'weft', pick: 0, end: 1, length: 2 },
      { set: 'weft', pick: 1, end: 1, length: 3 },
      { set: 'weft', pick: 3, end: 2, length: 2 },
      { set: 'warp', pick: 0, end: 0, length: 2 },
    ]);
    // repeat 2: each weft run appears twice (the lift 1 at end 0 and end 4 keeps runs from joining). Warp floats repeat at end 4.
    expect(computeFloats(cloth, 2)).toEqual([
      { set: 'weft', pick: 0, end: 1, length: 2 },
      { set: 'weft', pick: 0, end: 5, length: 2 },
      { set: 'weft', pick: 1, end: 1, length: 3 },
      { set: 'weft', pick: 1, end: 5, length: 3 },
      { set: 'weft', pick: 3, end: 2, length: 2 },
      { set: 'weft', pick: 3, end: 6, length: 2 },
      { set: 'warp', pick: 0, end: 0, length: 2 },
      { set: 'warp', pick: 0, end: 4, length: 2 },
    ]);
  });
});
