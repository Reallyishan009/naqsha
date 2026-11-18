import { readFileSync } from 'node:fs';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { createPlayer, frameAt, prepareCloth, renderFrame } from '../../src/simulator/index.ts';
import type { Frame, PreparedCloth, RenderSettings, Scheduler, SimImage } from '../../src/simulator/index.ts';
import { profileArbitrary } from '../support/profiles.ts';
import { renderSettingsArbitrary, slotListArbitrary } from '../support/slots.ts';

// Image properties run 25 times with this pinned seed, so every run sees the same cases.
const IMAGE_SEED = 20240611;
const IMAGE_RUNS = 25;

/** A scheduler whose callbacks run only when the test calls run(timeMs). */
function fakeScheduler(): Scheduler & { run(timeMs: number): boolean; pending(): number; requests(): number } {
  const queue = new Map<number, (timeMs: number) => void>();
  let nextId = 1;
  let requested = 0;
  return {
    request(cb) {
      const id = nextId++;
      requested++;
      queue.set(id, cb);
      return id;
    },
    cancel(id) {
      queue.delete(id);
    },
    run(timeMs) {
      const [first] = queue.entries();
      if (first === undefined) return false;
      queue.delete(first[0]);
      first[1](timeMs);
      return true;
    },
    pending: () => queue.size,
    requests: () => requested,
  };
}

function clothFor(profile: unknown, slots: unknown[]): PreparedCloth {
  const prepared = prepareCloth(profile, slots);
  if (!prepared.ok) throw new Error('test setup: prepareCloth failed');
  return prepared.value;
}

function direct(cloth: PreparedCloth, settings: RenderSettings, frame: Frame): SimImage {
  const result = renderFrame(cloth, settings, frame);
  if (!result.ok) throw new Error('test setup: renderFrame failed');
  return result.value;
}

const sameBytes = (a: SimImage, b: SimImage): boolean =>
  a.width === b.width && a.height === b.height && Buffer.compare(Buffer.from(a.data), Buffer.from(b.data)) === 0;

const profileAndSlots = profileArbitrary.chain((profile) =>
  fc.record({ profile: fc.constant(profile), samples: slotListArbitrary(profile) }),
);

describe('createPlayer', () => {
  it('R7.3 the player reaches the same pixels as rendering the pick directly', () => {
    fc.assert(
      fc.property(
        profileAndSlots,
        renderSettingsArbitrary,
        fc.nat(),
        fc.integer({ min: 20, max: 50 }),
        fc.integer({ min: 5, max: 80 }),
        ({ profile, samples }, settings, seedPick, rate, stepMs) => {
          const cloth = clothFor(profile, samples.map((sample) => sample.slot));
          const p = seedPick % (cloth.picks.length + 1);
          const expected = direct(cloth, settings, { pick: p, phase: 'rest' });

          // (a) play from 0 to p, driven to the end
          const painted: SimImage[] = [];
          const scheduler = fakeScheduler();
          const player = createPlayer({ cloth, settings, paint: (image) => painted.push(image), scheduler });
          player.play(0, p, rate);
          let now = 1000;
          for (let guard = 0; scheduler.run(now) && guard < 100000; guard++) now += stepMs;
          expect(scheduler.pending()).toBe(0);
          expect(painted.length).toBeGreaterThan(0);
          expect(sameBytes(painted[painted.length - 1], expected)).toBe(true);
          expect(player.current()).toEqual({ pick: p, phase: 'rest' });

          // (b) seek straight to p
          const seeked: SimImage[] = [];
          const other = createPlayer({ cloth, settings, paint: (image) => seeked.push(image), scheduler: fakeScheduler() });
          other.seek(p);
          expect(seeked).toHaveLength(1);
          expect(sameBytes(seeked[0], expected)).toBe(true);
        },
      ),
      { numRuns: IMAGE_RUNS, seed: IMAGE_SEED },
    );
  });

  describe('examples', () => {
    const profile: unknown = JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8'));
    const grid = Array.from({ length: 12 }, (_, row) => Array.from({ length: 16 }, (_, column) => (row + column) % 2 === 0));
    const cloth = clothFor(profile, [grid, grid, grid, grid]);
    const settings: RenderSettings = {
      warpColour: '#223344',
      weftPlan: [{ kind: 'plain', colour: '#aa5533' }],
      threadSizePx: 4,
      repeat: 1,
      viewport: { width: 32, height: 32 },
      floatHighlight: null,
    };

    function setup() {
      const scheduler = fakeScheduler();
      const painted: SimImage[] = [];
      const player = createPlayer({ cloth, settings, paint: (image) => painted.push(image), scheduler });
      return { scheduler, painted, player };
    }

    it('pause then resume keeps the elapsed time, so the frame does not jump', () => {
      const { scheduler, painted, player } = setup();
      player.play(0, 4, 10); // 100 ms per pick
      scheduler.run(1000);
      scheduler.run(1150);
      expect(player.current()).toEqual(frameAt(cloth, 0, 4, 10, 150));
      player.pause();
      expect(scheduler.pending()).toBe(0);
      const paintsBefore = painted.length;
      player.resume();
      scheduler.run(90000); // a long pause: elapsed is still 150 ms
      expect(painted).toHaveLength(paintsBefore);
      expect(player.current()).toEqual(frameAt(cloth, 0, 4, 10, 150));
      scheduler.run(90100);
      expect(player.current()).toEqual(frameAt(cloth, 0, 4, 10, 250));
    });

    it('makes no further request after the end pick is reached', () => {
      const { scheduler, player } = setup();
      player.play(0, 2, 10);
      scheduler.run(0);
      scheduler.run(500);
      expect(player.current()).toEqual({ pick: 2, phase: 'rest' });
      expect(scheduler.pending()).toBe(0);
      const requests = scheduler.requests();
      expect(scheduler.run(600)).toBe(false);
      player.resume();
      expect(scheduler.requests()).toBe(requests);
    });

    it('keeps at most one request pending', () => {
      const { scheduler, player } = setup();
      player.play(0, 4, 10);
      expect(scheduler.pending()).toBe(1);
      player.play(1, 3, 10);
      expect(scheduler.pending()).toBe(1);
      scheduler.run(0);
      expect(scheduler.pending()).toBe(1);
      player.resume();
      player.resume();
      expect(scheduler.pending()).toBe(1);
      player.pause();
      player.pause();
      expect(scheduler.pending()).toBe(0);
      player.resume();
      player.resume();
      expect(scheduler.pending()).toBe(1);
      player.seek(2);
      expect(scheduler.pending()).toBe(0);
    });

    it('R10.3 a large time jump skips frames instead of painting each one', () => {
      const { scheduler, painted, player } = setup();
      player.play(0, 4, 10);
      scheduler.run(0);
      scheduler.run(250); // 2.5 picks in one step
      scheduler.run(10000);
      expect(painted).toHaveLength(3);
      expect(player.current()).toEqual({ pick: 4, phase: 'rest' });
    });

    it('does not paint a frame that equals the last painted frame', () => {
      const { scheduler, painted, player } = setup();
      player.play(0, 4, 10);
      scheduler.run(0);
      scheduler.run(1);
      scheduler.run(2);
      expect(painted).toHaveLength(1);
    });

    it('seek floors and clamps the pick, paints at once, and resume plays on from there', () => {
      const { scheduler, painted, player } = setup();
      player.play(0, 4, 10);
      player.seek(2.9);
      expect(player.current()).toEqual({ pick: 2, phase: 'rest' });
      expect(painted).toHaveLength(1);
      expect(scheduler.pending()).toBe(0);
      player.resume();
      scheduler.run(500);
      scheduler.run(600); // 100 ms after start: pick 3
      expect(player.current()).toEqual(frameAt(cloth, 2, 4, 10, 100));
      player.seek(99);
      expect(player.current()).toEqual({ pick: 4, phase: 'rest' });
      player.seek(-5);
      expect(player.current()).toEqual({ pick: 0, phase: 'rest' });
    });

    it('stops without painting when renderFrame fails, and never throws', () => {
      const scheduler = fakeScheduler();
      const painted: SimImage[] = [];
      const broken = { ...cloth, picks: [...cloth.picks] };
      const player = createPlayer({ cloth: broken, settings: { ...settings, weftPlan: [] }, paint: (i) => painted.push(i), scheduler });
      expect(() => {
        player.play(0, 4, 10);
        scheduler.run(0);
        scheduler.run(150);
      }).not.toThrow();
      expect(scheduler.pending()).toBe(0);
      expect(player.current()).toEqual({ pick: 0, phase: 'rest' });
    });
  });
});
