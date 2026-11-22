import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Pattern } from '../../../src/codec/index.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { canvasAltText, displayedPlayback, entryModeFor, entryPlayback, focusAfterSkip, focusTargetAfterSkip, pickLabel, pickPositionText, riseFraction, riseLevel, riseReducer, scrubTo, SPEEDS, stepBack, stepForward } from '../../../src/ui/state/playback.ts';
import type { EntryMode } from '../../../src/ui/state/playback.ts';
import type { Language, PlaybackState } from '../../../src/ui/types.ts';

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
  it('R2.8 there are three speeds', () => {
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

describe('rise from darkness', () => {
  it('R20.2 the level runs from dark to full colour and is 1 once skipped', () => {
    expect(riseLevel(0, false, false)).toBe(0);
    expect(riseLevel(1, false, false)).toBe(1);
    expect(riseLevel(0.5, false, false)).toBeCloseTo(0.5, 10);
    expect(riseLevel(NaN, false, false)).toBe(0);
    expect(riseLevel(0.1, true, false)).toBe(1);
    expect(riseFraction(5, 10)).toBe(0.5);
    expect(riseFraction(3, 0)).toBe(1);
  });
  it('R20.2 it runs once per design: a finish, skip or step ends it and only a loaded design starts it', () => {
    const running = riseReducer('off', { type: 'design-loaded', reducedMotion: false });
    expect(running).toBe('running');
    for (const type of ['finished', 'skip', 'seek', 'cleared'] as const) {
      expect(riseReducer(running, { type })).toBe('off');
      expect(riseReducer('off', { type })).toBe('off');
    }
  });
  it('R20.4 under reduced motion a loaded design never starts the effect', () => {
    expect(riseReducer('off', { type: 'design-loaded', reducedMotion: true })).toBe('off');
  });
  it('R20.2 R20.4 the level is within 0..1, never decreases as the fraction grows, reaches 1, is 1 once skipped and always 1 under reduced motion', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -2, max: 3, noNaN: true }),
        fc.double({ min: -2, max: 3, noNaN: true }),
        fc.boolean(),
        fc.boolean(),
        (a, b, skipped, reducedMotion) => {
          const low = Math.min(a, b);
          const high = Math.max(a, b);
          const lowLevel = riseLevel(low, skipped, reducedMotion);
          const highLevel = riseLevel(high, skipped, reducedMotion);
          expect(lowLevel).toBeGreaterThanOrEqual(0);
          expect(highLevel).toBeLessThanOrEqual(1);
          expect(lowLevel).toBeLessThanOrEqual(highLevel);
          expect(riseLevel(Math.max(1, high), false, false)).toBe(1);
          if (skipped || reducedMotion) expect(lowLevel).toBe(1);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});

describe('focus after the skip control', () => {
  const STATUSES = ['idle', 'playing', 'paused', 'finished'] as const;
  it('R20.2 after skip focus goes to Pause while playing and to Play when paused or finished', () => {
    expect(focusTargetAfterSkip('playing')).toBe('pause');
    expect(focusTargetAfterSkip('paused')).toBe('play');
    expect(focusTargetAfterSkip('finished')).toBe('play');
    expect(focusTargetAfterSkip('idle')).toBe('play');
  });
  it('R20.2 for every playback status the focus target is Pause exactly when playing', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATUSES), (status) => {
        expect(focusTargetAfterSkip(status)).toBe(status === 'playing' ? 'pause' : 'play');
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
  it('R20.2 skip focuses exactly the chosen control and no other, and does nothing when it is missing', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATUSES), (status) => {
        const calls: string[] = [];
        const controls = {
          pause: { focus: () => calls.push('pause') },
          play: { focus: () => calls.push('play') },
        };
        const target = focusAfterSkip(status, controls);
        expect(calls).toEqual([focusTargetAfterSkip(status)]);
        expect(target).toBe(focusTargetAfterSkip(status));
        expect(focusAfterSkip(status, { pause: null, play: null })).toBeNull();
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});

describe('the position shown for a newly shown cloth', () => {
  // Task 8.3: the Weave pick counter used to read the position of the design shown before, for one render,
  // until the mount effect seeked the player. The position shown is now the entry state itself.
  const ENTRY_SEED = 80301;
  const MODES: EntryMode[] = ['show-finished', 'autoplay', 'keep'];
  const stateArbitrary: fc.Arbitrary<PlaybackState> = fc.record({
    status: fc.constantFrom<PlaybackState['status']>('idle', 'playing', 'paused', 'finished'),
  });
  // The pick the previous design was at is now AppState.selectedPick, passed beside the status.
  const selectedPickArbitrary = fc.integer({ min: 0, max: 600 });
  /** A stand-in for a prepared cloth: the position rule only ever compares cloths by identity. */
  const cloth = (picks: number) => ({ picks });

  it('R2.8 R3.6 R14.9 each entry gets its own position: the finished cloth on arrival, the first pick for a chosen design, the current pick for a rebuild', () => {
    const previous = { status: 'paused' } satisfies PlaybackState;
    const selectedPick = 4;
    expect(entryPlayback('show-finished', previous, selectedPick, 9, true)).toEqual({ status: 'finished', pick: 9 });
    expect(entryPlayback('autoplay', previous, selectedPick, 9, true)).toEqual({ status: 'playing', pick: 0 });
    // Reduced motion: a chosen design is shown finished instead of woven (R14.9).
    expect(entryPlayback('autoplay', previous, selectedPick, 9, false)).toEqual({ status: 'finished', pick: 9 });
    expect(entryPlayback('keep', previous, selectedPick, 9, true)).toEqual({ status: 'paused', pick: 4 });
    // A kept position beyond the new cloth becomes its last pick, which is the finished cloth.
    expect(entryPlayback('keep', { status: 'idle' }, 40, 9, true)).toEqual({ status: 'finished', pick: 9 });
    expect(entryPlayback('show-finished', previous, selectedPick, 0, true)).toEqual({ status: 'idle', pick: 0 });
  });

  it('R2.4 the entry is the arrival for the design already loaded, an autoplay for a design just chosen and a keep for a rebuild', () => {
    const arrived: Pattern = [[[true]]];
    const chosen: Pattern = [[[false]]];
    expect(entryModeFor(arrived, null, arrived)).toBe('show-finished');
    expect(entryModeFor(chosen, null, arrived)).toBe('autoplay');
    expect(entryModeFor(chosen, arrived, arrived)).toBe('autoplay');
    expect(entryModeFor(arrived, arrived, arrived)).toBe('keep');
  });

  it('R2.10 the player’s own report is shown while it is about the cloth on screen', () => {
    const shown = cloth(9);
    const reported = { status: 'playing' } satisfies PlaybackState;
    expect(displayedPlayback(shown, { cloth: shown, state: reported }, 'keep', 3, 9, true)).toBe(reported);
    expect(displayedPlayback(null, { cloth: null, state: reported }, 'keep', 0, 0, true)).toBe(reported);
  });

  it('R2.10 R3.6 the position shown for a cloth is one of that cloth’s own positions and carries nothing of the design shown before', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 600 }),
        fc.integer({ min: 1, max: 600 }),
        stateArbitrary,
        stateArbitrary,
        selectedPickArbitrary,
        selectedPickArbitrary,
        fc.constantFrom(...MODES),
        fc.boolean(),
        (pickCount, previousCount, previous, otherPrevious, selectedPick, otherSelectedPick, mode, autoplays) => {
          const shown = cloth(pickCount);
          const before = { cloth: cloth(previousCount), state: previous };
          const displayed = displayedPlayback(shown, before, mode, selectedPick, pickCount, autoplays);
          // The entry holds the position of the cloth now on screen, whatever the design before it was showing.
          const entry = entryPlayback(mode, previous, selectedPick, pickCount, autoplays);
          expect(Number.isInteger(entry.pick)).toBe(true);
          expect(entry.pick).toBeGreaterThanOrEqual(0);
          expect(entry.pick).toBeLessThanOrEqual(pickCount);
          // The player is entered at this very position, so the counter and the player cannot disagree.
          expect(displayed).toEqual(entry);
          if (mode === 'keep') {
            // A rebuild of the same design keeps the pick, clamped to the new cloth (R3.6).
            expect(entry.pick).toBe(Math.min(selectedPick, pickCount));
          } else {
            // A design the screen has not shown before takes nothing from the previous position.
            expect(displayed).toEqual(
              displayedPlayback(shown, { cloth: before.cloth, state: otherPrevious }, mode, otherSelectedPick, pickCount, autoplays),
            );
          }
        },
      ),
      { seed: ENTRY_SEED, numRuns: 200 },
    );
  });

  it('R2.4 every entry of a design the screen has not entered yet is an autoplay, and every rebuild of the entered one a keep', () => {
    fc.assert(
      fc.property(fc.nat({ max: 3 }), fc.nat({ max: 3 }), fc.nat({ max: 3 }), (a, b, c) => {
        const designs: Pattern[] = [[[[true]]], [[[false]]], [[[true], [false]]], [[[false], [true]]]];
        const [pattern, entered, mounted] = [designs[a]!, designs[b]!, designs[c]!];
        expect(entryModeFor(pattern, null, mounted)).toBe(pattern === mounted ? 'show-finished' : 'autoplay');
        expect(entryModeFor(pattern, entered, mounted)).toBe(pattern === entered ? 'keep' : 'autoplay');
      }),
      { seed: ENTRY_SEED, numRuns: NUM_RUNS },
    );
  });
});

describe('arriving on Weave after Code view moved the Selected_Pick', () => {
  const idle = { status: 'idle' } satisfies PlaybackState;
  const arrived: Pattern = [[[true]]];
  const other: Pattern = [[[false]]];

  it('R4.2 pick 0 arrives on the finished cloth', () => {
    expect(entryModeFor(arrived, null, arrived, 0)).toBe('show-finished');
    expect(entryPlayback('show-finished', idle, 0, 10, true)).toEqual({ status: 'finished', pick: 10 });
  });

  it('R4.2 pick 7 of 10 arrives paused at pick 7, with no autoplay and no replay from pick 0', () => {
    const mode = entryModeFor(arrived, null, arrived, 7);
    expect(mode).toBe('show-selected');
    for (const autoplays of [true, false]) {
      expect(entryPlayback(mode, idle, 7, 10, autoplays)).toEqual({ status: 'paused', pick: 7 });
    }
    // The state the screen shows for the new cloth is that same entry.
    expect(displayedPlayback({ picks: 10 }, { cloth: { picks: 4 }, state: idle }, mode, 7, 10, true)).toEqual({ status: 'paused', pick: 7 });
  });

  it('R4.2 a pick above the last pick arrives paused at the last pick', () => {
    expect(entryPlayback('show-selected', idle, 40, 10, true)).toEqual({ status: 'paused', pick: 9 });
  });

  it('R4.2 a design with one pick arrives finished at pick 0 and paused at its only pick otherwise', () => {
    expect(entryPlayback('show-finished', idle, 0, 1, true)).toEqual({ status: 'finished', pick: 1 });
    expect(entryPlayback('show-selected', idle, 5, 1, true)).toEqual({ status: 'paused', pick: 0 });
  });

  it('R4.2 only the arrival with a design already loaded shows the selected pick', () => {
    expect(entryModeFor(other, null, arrived, 7)).toBe('autoplay');
    expect(entryModeFor(arrived, arrived, arrived, 7)).toBe('keep');
    expect(entryPlayback('show-selected', idle, 7, 0, true)).toEqual({ status: 'idle', pick: 0 });
  });
});
