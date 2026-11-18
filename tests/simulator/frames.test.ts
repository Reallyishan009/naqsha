import { readFileSync } from 'node:fs';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { PASS_STEPS, frameAt, framesForPick, prepareCloth } from '../../src/simulator/index.ts';
import type { Frame, PreparedCloth } from '../../src/simulator/index.ts';
import { profileArbitrary } from '../support/profiles.ts';
import { slotListArbitrary } from '../support/slots.ts';

function clothFor(profile: unknown, slots: unknown[]): PreparedCloth {
  const prepared = prepareCloth(profile, slots);
  if (!prepared.ok) throw new Error('a generated profile and slot list must prepare');
  return prepared.value;
}

const clothArbitrary = profileArbitrary.chain((profile) =>
  slotListArbitrary(profile).map((samples) => clothFor(profile, samples.map((sample) => sample.slot))),
);

/** Total order on frames: (pick, phase index) with rest = 0, lift = 1, pass s = 2 + s. */
function order(frame: Frame): [number, number] {
  if (frame.phase === 'rest') return [frame.pick, 0];
  if (frame.phase === 'lift') return [frame.pick, 1];
  return [frame.pick, 2 + frame.step];
}

function compare(a: Frame, b: Frame): number {
  const [pickA, phaseA] = order(a);
  const [pickB, phaseB] = order(b);
  return pickA !== pickB ? pickA - pickB : phaseA - phaseB;
}

const isWoven = (cloth: PreparedCloth, pick: number): boolean => cloth.picks[pick]?.kind === 'woven';

describe('framesForPick', () => {
  it('R9.1 each woven pick animates as lift, the weft pass, then the next rest frame, and a gap pick has no lift or pass', () => {
    fc.assert(
      fc.property(clothArbitrary, (cloth) => {
        for (let pick = 0; pick < cloth.picks.length; pick++) {
          const frames = framesForPick(cloth, pick);
          if (isWoven(cloth, pick)) {
            const expected: Frame[] = [{ pick, phase: 'lift' }];
            for (let step = 0; step < PASS_STEPS; step++) expected.push({ pick, phase: 'pass', step });
            expect(frames).toEqual(expected);
          } else {
            expect(frames).toEqual([]);
          }
        }
        expect(framesForPick(cloth, -1)).toEqual([]);
        expect(framesForPick(cloth, cloth.picks.length)).toEqual([]);
      }),
    );
  });

  it('PASS_STEPS is 8', () => {
    expect(PASS_STEPS).toBe(8);
  });
});

describe('frameAt', () => {
  const profile: unknown = JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8'));
  const wovenGrid = Array.from({ length: 12 }, (_, row) => Array.from({ length: 16 }, (_, column) => (row + column) % 2 === 0));

  it('splits a woven slot over rest, lift and the pass steps, and gives a gap pick rest', () => {
    const cloth = clothFor(profile, [wovenGrid, null]);
    expect(frameAt(cloth, 0, 2, 1, 0)).toEqual({ pick: 0, phase: 'rest' });
    expect(frameAt(cloth, 0, 2, 1, 99)).toEqual({ pick: 0, phase: 'rest' });
    expect(frameAt(cloth, 0, 2, 1, 150)).toEqual({ pick: 0, phase: 'lift' });
    expect(frameAt(cloth, 0, 2, 1, 999)).toEqual({ pick: 0, phase: 'pass', step: PASS_STEPS - 1 });
    expect(frameAt(cloth, 0, 2, 1, 1500)).toEqual({ pick: 1, phase: 'rest' });
    expect(frameAt(cloth, 0, 2, 1, 5000)).toEqual({ pick: 2, phase: 'rest' });
  });

  it('returns rest(startPick) for bad time or rate, clamps picks, and never throws', () => {
    const cloth = clothFor(profile, [wovenGrid, wovenGrid]);
    for (const bad of [-1, NaN, Infinity, -Infinity]) {
      expect(frameAt(cloth, 1, 2, 1, bad)).toEqual({ pick: 1, phase: 'rest' });
      expect(frameAt(cloth, 1, 2, bad, 100)).toEqual({ pick: 1, phase: 'rest' });
    }
    expect(frameAt(cloth, 1, 2, 0, 100)).toEqual({ pick: 1, phase: 'rest' });
    expect(frameAt(cloth, 2, 0, 1, 5000)).toEqual({ pick: 2, phase: 'rest' });
    expect(frameAt(cloth, 0, 99, 1, 99999)).toEqual({ pick: 2, phase: 'rest' });
  });

  it('R10.3 frameAt moves forward with time, skips rather than slows, and stops at the end pick', () => {
    const input = clothArbitrary.chain((cloth) =>
      fc.record({
        cloth: fc.constant(cloth),
        start: fc.integer({ min: 0, max: cloth.picks.length }),
        end: fc.integer({ min: 0, max: cloth.picks.length }),
        rate: fc.double({ min: 0.25, max: 60, noNaN: true }),
        times: fc.array(
          fc.oneof(
            fc.double({ min: 0, max: 5000, noNaN: true }),
            fc.double({ min: 0, max: 1e7, noNaN: true }),
            fc.integer({ min: 0, max: 100000 }),
          ),
          { minLength: 1, maxLength: 30 },
        ),
      }),
    );
    fc.assert(
      fc.property(input, ({ cloth, start, end, rate, times }) => {
        const last = Math.max(start, end);
        const sorted = [...times].sort((a, b) => a - b);
        let previous: Frame | null = null;
        for (const elapsed of sorted) {
          const frame = frameAt(cloth, start, end, rate, elapsed);
          if (previous !== null) expect(compare(previous, frame)).toBeLessThanOrEqual(0);
          previous = frame;
          const whole = Math.floor((elapsed * rate) / 1000);
          if (start + whole < last) {
            expect(frame.pick).toBe(start + whole);
          } else {
            expect(frame).toEqual({ pick: last, phase: 'rest' });
          }
          if (frame.phase !== 'rest') expect(isWoven(cloth, frame.pick)).toBe(true);
        }
      }),
    );
  });
});
