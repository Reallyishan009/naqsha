import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardProfile } from '../../../src/codec/index.ts';
import { parseColour, parseRenderSettings, prepareCloth } from '../../../src/simulator/index.ts';
import type { SimFailure } from '../../../src/simulator/index.ts';
import {
  clothReducer,
  COLOURS,
  gapPickNumbers,
  playbackAfterChoice,
  settingsFromChoices,
  viewportFor,
  weftPlan,
} from '../../../src/ui/state/cloth.ts';
import type { ClothChoices, ClothView, PlaybackState, ReadyCloth } from '../../../src/ui/types.ts';
import { cardProfileArbitrary, demoProfile } from '../../support/profiles.ts';
import { slotListArbitrary } from '../../support/slots.ts';

const SEED = 20240702;
const NUM_RUNS = 100;
const colourArbitrary = fc.constantFrom(...COLOURS.map((colour) => colour.hex));
const zariArbitrary = fc.oneof(
  fc.constant<ClothChoices['zari']>({ on: false }),
  fc.constantFrom<'gold' | 'silver'>('gold', 'silver').map((tone): ClothChoices['zari'] => ({ on: true, tone })),
);
const choicesArbitrary: fc.Arbitrary<ClothChoices> = fc.record({
  warpColour: colourArbitrary,
  weftColour: colourArbitrary,
  zari: zariArbitrary,
  repeat: fc.integer({ min: 1, max: 8 }),
});
const sizeArbitrary = fc.oneof(
  fc.double({ min: -10, max: 10000, noNaN: true }),
  fc.constantFrom(0, 0.4, NaN, Infinity, -Infinity, 4096, 4096.9, 5000),
);
const failureArbitrary: fc.Arbitrary<SimFailure> = fc.oneof(
  fc.constant<SimFailure>({ reason: 'invalid-profile', violations: [] }),
  fc.string().map((setting): SimFailure => ({ reason: 'invalid-settings', setting, message: 'm' })),
  fc.integer().map((pickCount): SimFailure => ({ reason: 'pick-out-of-range', pick: -1, pickCount })),
);

function readyCloth(profile: CardProfile, choices: ClothChoices): ReadyCloth {
  const cloth = prepareCloth(profile, []);
  const settings = parseRenderSettings(settingsFromChoices(choices, 300, 300));
  if (!cloth.ok || !settings.ok) throw new Error('fixture cloth failed');
  return { cloth: cloth.value, settings: settings.value };
}

describe('cloth examples', () => {
  it('R3.2 there are at least six colours, all accepted by parseColour', () => {
    expect(COLOURS.length).toBeGreaterThanOrEqual(6);
    for (const colour of COLOURS) expect(parseColour(colour.hex)).not.toBeNull();
  });
  it('R3.4 the viewport clamps to 1..4096', () => {
    expect(viewportFor(0, 99999)).toEqual({ width: 1, height: 4096 });
    expect(viewportFor(NaN, 12.9)).toEqual({ width: 1, height: 12 });
  });
  it('R2.11 gap picks are one-based', () => {
    expect(gapPickNumbers([{ pick: 0, kind: 'missing', violations: [] }, { pick: 4, kind: 'damaged', violations: [] }])).toEqual([1, 5]);
  });
  it('R2.12 an update before any cloth fails with no previous cloth', () => {
    const view = clothReducer({ status: 'empty' }, { type: 'cloth-updated', result: { ok: false, failure: { reason: 'invalid-profile', violations: [] } } });
    expect(view).toEqual({ status: 'failed', failure: { reason: 'invalid-profile', violations: [] }, previous: null });
  });
});

describe('cloth properties', () => {
  it('R2.11 the gap list names exactly the missing and damaged picks', () => {
    // Feature: app, Property 5: Gap list names the affected picks
    fc.assert(
      fc.property(
        cardProfileArbitrary.chain((profile) => fc.record({ profile: fc.constant(profile), samples: slotListArbitrary(profile) })),
        ({ profile, samples }) => {
          const prepared = prepareCloth(profile, samples.map((sample) => sample.slot));
          expect(prepared.ok).toBe(true);
          if (!prepared.ok) return;
          const expected = samples.flatMap((sample, pick) => (sample.expected === 'woven' ? [] : [pick + 1]));
          expect(gapPickNumbers(prepared.value.gaps)).toEqual(expected);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R2.12 a failed cloth update keeps the previous cloth', () => {
    // Feature: app, Property 7: A failed cloth update keeps the previous cloth
    fc.assert(
      fc.property(cardProfileArbitrary, choicesArbitrary, failureArbitrary, (profile, choices, failure) => {
        const ready = readyCloth(profile, choices);
        const view: ClothView = { status: 'ready', ready };
        const next = clothReducer(view, { type: 'cloth-updated', result: { ok: false, failure } });
        expect(next).toEqual({ status: 'failed', failure, previous: ready });
        // a second failure still keeps the same previous cloth
        const again = clothReducer(next, { type: 'cloth-updated', result: { ok: false, failure } });
        expect(again).toEqual({ status: 'failed', failure, previous: ready });
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R3.3 R3.4 zari lands on every second pick and plain colours are accepted by parseColour', () => {
    // Feature: app, Property 8: Weft plan puts zari on every second pick
    fc.assert(
      fc.property(choicesArbitrary, (choices) => {
        const plan = weftPlan(choices);
        expect(plan[0]).toEqual({ kind: 'plain', colour: choices.weftColour });
        expect(parseColour(choices.weftColour)).not.toBeNull();
        if (choices.zari.on) expect(plan).toEqual([plan[0], { kind: 'zari', tone: choices.zari.tone }]);
        else expect(plan).toHaveLength(1);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R3.1 R3.5 R3.6 chosen settings are accepted by the simulator and a change keeps the current pick', () => {
    // Feature: app, Property 9: Chosen settings are always accepted by the simulator
    const playbackArbitrary: fc.Arbitrary<PlaybackState> = fc.record({
      status: fc.constantFrom<PlaybackState['status']>('idle', 'playing', 'paused', 'finished'),
      pick: fc.integer({ min: 0, max: 200 }),
    }) as fc.Arbitrary<PlaybackState>;
    fc.assert(
      fc.property(choicesArbitrary, choicesArbitrary, sizeArbitrary, sizeArbitrary, playbackArbitrary, (before, after, width, height, playback) => {
        for (const choices of [before, after]) {
          const parsed = parseRenderSettings(settingsFromChoices(choices, width, height));
          expect(parsed.ok).toBe(true);
          if (!parsed.ok) continue;
          const { viewport } = parsed.value;
          for (const side of [viewport.width, viewport.height]) {
            expect(Number.isInteger(side)).toBe(true);
            expect(side).toBeGreaterThanOrEqual(1);
            expect(side).toBeLessThanOrEqual(4096);
          }
        }
        expect(playbackAfterChoice(playback, 200)).toEqual(playback);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R3.2 the demo profile prepares with every colour pair', () => {
    const profile = demoProfile();
    for (const warp of COLOURS) {
      const ready = readyCloth(profile, { warpColour: warp.hex, weftColour: COLOURS[0].hex, zari: { on: false }, repeat: 1 });
      expect(ready.settings.warpColour).toBe(warp.hex);
    }
  });
});
