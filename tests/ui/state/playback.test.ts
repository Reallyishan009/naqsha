import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { canvasAltText, pickLabel, pickPositionText, scrubTo, SPEEDS, stepBack, stepForward } from '../../../src/ui/state/playback.ts';
import type { Language } from '../../../src/ui/types.ts';

const SEED = 20240701;
const NUM_RUNS = 100;
const pickCountArbitrary = fc.integer({ min: 0, max: 5000 });
const anyNumber = fc.oneof(
  fc.double({ noNaN: false }),
  fc.integer({ min: -10, max: 6000 }),
  fc.constantFrom(NaN, Infinity, -Infinity, 0.5, -0.5),
);

describe('playback examples', () => {
  it('R2.5 steps stay inside the pick range', () => {
    expect(stepForward(3, 4)).toBe(4);
    expect(stepForward(4, 4)).toBe(4);
    expect(stepBack(0, 4)).toBe(0);
    expect(stepBack(4, 4)).toBe(3);
  });
  it('R2.7 the scrubber value is rounded and clamped', () => {
    expect(scrubTo(NaN, 10)).toBe(0);
    expect(scrubTo(-3, 10)).toBe(0);
    expect(scrubTo(99, 10)).toBe(10);
    expect(scrubTo(4.4, 10)).toBe(4);
  });
  it('R2.10 the position text names the pick and the total in both languages', () => {
    expect(pickPositionText(translator(DICTIONARIES, 'en'), 2, 36)).toBe('Pick 3 of 36');
    expect(pickLabel(36, 36)).toEqual({ current: 36, total: 36 });
    expect(pickLabel(0, 0)).toEqual({ current: 0, total: 0 });
  });
  it('R2.6 there are three speeds', () => {
    expect(SPEEDS).toHaveLength(3);
  });
});

describe('playback properties', () => {
  it('R2.5 R2.6 R2.7 scrubbing and stepping return integers in range and step back undoes step forward', () => {
    // Feature: app, Property 3: Playback positions stay in range and step back undoes step forward
    fc.assert(
      fc.property(pickCountArbitrary, anyNumber, (pickCount, value) => {
        for (const result of [scrubTo(value, pickCount), stepForward(value, pickCount), stepBack(value, pickCount)]) {
          expect(Number.isInteger(result)).toBe(true);
          expect(result).toBeGreaterThanOrEqual(0);
          expect(result).toBeLessThanOrEqual(pickCount);
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
    fc.assert(
      fc.property(
        pickCountArbitrary.filter((n) => n > 0).chain((n) => fc.record({ n: fc.constant(n), p: fc.integer({ min: 0, max: n - 1 }) })),
        ({ n, p }) => {
          expect(stepBack(stepForward(p, n), n)).toBe(p);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R2.10 R14.5 the position text and canvas alternative text contain the pick and the total in both languages', () => {
    // Feature: app, Property 4: Position text contains the pick and the total
    fc.assert(
      fc.property(
        pickCountArbitrary.filter((n) => n > 0).chain((n) => fc.record({ n: fc.constant(n), p: fc.integer({ min: 0, max: n }) })),
        fc.constantFrom<Language>('hi', 'en'),
        ({ n, p }, language) => {
          const t = translator(DICTIONARIES, language);
          const shown = p === n ? n : p + 1;
          for (const text of [pickPositionText(t, p, n), canvasAltText(t, p, n)]) {
            expect(text).toContain(String(shown));
            expect(text).toContain(String(n));
          }
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
