import * as fc from 'fast-check';
import type { CardProfile } from '../../src/codec/types.ts';
import type { RenderSettings, Weft } from '../../src/simulator/types.ts';
import { cardGridArbitrary } from './profiles.ts';

/** One generated slot and the kind it was built to be. */
export type SlotSample = { expected: 'woven' | 'missing' | 'damaged'; slot: unknown };

/** A valid card grid made invalid by construction: wrong row count, wrong row length, a non-boolean cell, or a non-array. */
export function damagedSlotArbitrary(profile: CardProfile): fc.Arbitrary<unknown> {
  const { hookRows, hookColumns } = profile;
  const booleanRow = fc.array(fc.boolean(), { minLength: hookColumns, maxLength: hookColumns });
  const hookRow = fc.integer({ min: 0, max: hookRows - 1 });
  return cardGridArbitrary(profile).chain((grid): fc.Arbitrary<unknown> =>
    fc.oneof(
      fc.array(booleanRow, { minLength: 1, maxLength: 3 }).map((extraRows) => [...grid, ...extraRows]),
      fc.integer({ min: 1, max: hookRows }).map((removed) => grid.slice(0, hookRows - removed)),
      fc
        .record({ hookRow, extra: fc.array(fc.boolean(), { minLength: 1, maxLength: 3 }) })
        .map((change) => grid.map((row, i) => (i === change.hookRow ? [...row, ...change.extra] : row))),
      fc
        .record({ hookRow, removed: fc.integer({ min: 1, max: hookColumns }) })
        .map((change) =>
          grid.map((row, i) => (i === change.hookRow ? row.slice(0, hookColumns - change.removed) : row)),
        ),
      fc
        .record({
          hookRow,
          hookColumn: fc.integer({ min: 0, max: hookColumns - 1 }),
          value: fc.constantFrom<unknown>(0, 1, 'true', null, undefined, {}, [], NaN),
        })
        .map((change) =>
          grid.map((row, i) =>
            i === change.hookRow ? row.map((cell, j) => (j === change.hookColumn ? change.value : cell)) : row,
          ),
        ),
      fc.constantFrom<unknown>(0, 1, 'card', true, {}, 42.5, 'true'),
    ),
  );
}

/** Slot lists for the profile with valid, missing (null or undefined) and damaged slots, each tagged with its kind. */
export function slotListArbitrary(profile: CardProfile): fc.Arbitrary<SlotSample[]> {
  const sample: fc.Arbitrary<SlotSample> = fc.oneof(
    { weight: 3, arbitrary: cardGridArbitrary(profile).map((slot): SlotSample => ({ expected: 'woven', slot })) },
    { weight: 1, arbitrary: fc.constantFrom<unknown>(null, undefined).map((slot): SlotSample => ({ expected: 'missing', slot })) },
    { weight: 1, arbitrary: damagedSlotArbitrary(profile).map((slot): SlotSample => ({ expected: 'damaged', slot })) },
  );
  return fc.array(sample, { maxLength: 12 });
}

/** A '#rrggbb' colour, written in lower or upper case. */
export const colourArbitrary: fc.Arbitrary<string> = fc
  .tuple(fc.integer({ min: 0, max: 0xffffff }), fc.boolean())
  .map(([rgb, upper]) => {
    const hex = rgb.toString(16).padStart(6, '0');
    return `#${upper ? hex.toUpperCase() : hex}`;
  });

/** A weft: a plain colour or a zari tone. */
export const weftArbitrary: fc.Arbitrary<Weft> = fc.oneof(
  colourArbitrary.map((colour): Weft => ({ kind: 'plain', colour })),
  fc.constantFrom<'gold' | 'silver'>('gold', 'silver').map((tone): Weft => ({ kind: 'zari', tone })),
);

/** A weft plan of 1 to 4 wefts mixing plain and zari. */
export const weftPlanArbitrary: fc.Arbitrary<Weft[]> = fc.array(weftArbitrary, { minLength: 1, maxLength: 4 });

/** Valid render settings with small viewports so frame properties stay fast. */
export const renderSettingsArbitrary: fc.Arbitrary<RenderSettings> = fc.record({
  warpColour: colourArbitrary,
  weftPlan: weftPlanArbitrary,
  threadSizePx: fc.integer({ min: 3, max: 8 }),
  repeat: fc.integer({ min: 1, max: 4 }),
  viewport: fc.record({ width: fc.integer({ min: 8, max: 64 }), height: fc.integer({ min: 8, max: 64 }) }),
  floatHighlight: fc.option(fc.record({ maxLength: fc.integer({ min: 1, max: 8 }) }), { nil: null }),
});
