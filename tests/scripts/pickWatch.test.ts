import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { newPickWatch, stepPickWatch } from '../../scripts/checks/pickWatch.ts';
import type { PickReading } from '../../scripts/checks/pickWatch.ts';

const SEED = 71101;
const NUM_RUNS = 200;

function run(readings: (PickReading | null)[], total: number): { done: boolean; seen: number[] } {
  let watch = newPickWatch();
  for (const reading of readings) {
    const step = stepPickWatch(watch, reading, total);
    watch = step.watch;
    if (step.done) return { done: true, seen: watch.seen };
  }
  return { done: false, seen: watch.seen };
}

describe('stepPickWatch', () => {
  it('R16.7 a counter that jumps from the first pick to the last between two reads is finished (the step 11 flake)', () => {
    const result = run([{ pick: 1, total: 36 }, { pick: 36, total: 36 }, { pick: 36, total: 36 }], 36);
    expect(result.done).toBe(true);
  });

  it('R16.7 a counter first read at the last pick is finished, not waited for forever', () => {
    expect(run([{ pick: 36, total: 36 }], 36).done).toBe(true);
  });

  it('R16.7 a counter that has not reached the last pick is not finished', () => {
    expect(run([{ pick: 1, total: 36 }, { pick: 2, total: 36 }, null], 36).done).toBe(false);
  });

  it('R16.7 whatever the readings, the watch is finished as soon as a reading with the right total is at its last pick', () => {
    const reading = fc.record({ total: fc.constantFrom(5, 36), pick: fc.integer({ min: 1, max: 36 }) });
    fc.assert(
      fc.property(fc.array(fc.option(reading, { nil: null }), { maxLength: 30 }), (readings) => {
        const total = 36;
        const atEnd = readings.some((r) => r !== null && r.total === total && r.pick === total);
        expect(run(readings, total).done).toBe(atEnd);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
