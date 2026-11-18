import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardProfile } from '../../src/codec/index.ts';
import {
  parseColour,
  prepareCloth,
  renderFrame,
  shadeTable,
  ZARI_GOLD_COLOUR,
  ZARI_GOLD_HIGHLIGHT_COLOUR,
  ZARI_SILVER_COLOUR,
  ZARI_SILVER_HIGHLIGHT_COLOUR,
} from '../../src/simulator/index.ts';
import type { PreparedCloth, RenderSettings, SimImage, Weft } from '../../src/simulator/index.ts';
import { profileArbitrary } from '../support/profiles.ts';
import { renderSettingsArbitrary, slotListArbitrary } from '../support/slots.ts';

// Image properties run 25 times with this pinned seed, so every run sees the same cases.
const IMAGE_SEED = 20240611;
const IMAGE_RUNS = 25;

type Rgb = [number, number, number];

function prepared(profile: CardProfile, slots: unknown[]): PreparedCloth {
  const result = prepareCloth(profile, slots);
  if (!result.ok) throw new Error('test setup: prepareCloth failed');
  return result.value;
}

function rest(cloth: PreparedCloth, settings: RenderSettings, pick: number): SimImage {
  const result = renderFrame(cloth, settings, { pick, phase: 'rest' });
  if (!result.ok) throw new Error(`test setup: renderFrame failed for pick ${pick}`);
  return result.value;
}

function pixelAt(image: SimImage, x: number, y: number): Rgb {
  const o = (y * image.width + x) * 4;
  expect(image.data[o + 3]).toBe(255);
  return [image.data[o], image.data[o + 1], image.data[o + 2]];
}

function shaded(hex: string, shade: number): Rgb {
  const rgb = parseColour(hex)!;
  return [(rgb[0] * shade) >> 8, (rgb[1] * shade) >> 8, (rgb[2] * shade) >> 8];
}

function weftHex(weft: Weft): string {
  if (weft.kind === 'plain') return weft.colour;
  return weft.tone === 'gold' ? ZARI_GOLD_COLOUR : ZARI_SILVER_COLOUR;
}

function highlightHex(weft: Weft): string | undefined {
  if (weft.kind === 'plain') return undefined;
  return weft.tone === 'gold' ? ZARI_GOLD_HIGHLIGHT_COLOUR : ZARI_SILVER_HIGHLIGHT_COLOUR;
}

function sameColour(a: Rgb, b: Rgb): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/** Settings whose warp colour, shaded at a thread centre, differs from every weft colour shaded there. */
const distinctSettingsArbitrary = renderSettingsArbitrary.filter((settings) => {
  const centreShade = shadeTable(settings.threadSizePx)[Math.floor(settings.threadSizePx / 2)];
  const warp = shaded(settings.warpColour, centreShade);
  return settings.weftPlan.every((weft) => !sameColour(warp, shaded(weftHex(weft), centreShade)));
});

const profileAndSlots = profileArbitrary.chain((profile) =>
  fc.record({ profile: fc.constant(profile), samples: slotListArbitrary(profile) }),
);

describe('renderFrame', () => {
  it('R2.3 a crossing shows the warp on the face exactly when its end is lifted', () => {
    fc.assert(
      fc.property(profileAndSlots, distinctSettingsArbitrary, fc.nat(), ({ profile, samples }, settings, seedPick) => {
        const cloth = prepared(profile, samples.map((sample) => sample.slot));
        const p = seedPick % (cloth.picks.length + 1);
        const image = rest(cloth, settings, p);
        const t = settings.threadSizePx;
        const centre = Math.floor(t / 2);
        const shade = shadeTable(t)[centre];
        const fellY = image.height - Math.min(6 * t, Math.floor(image.height / 3));
        for (let rowIndex = 0; rowIndex * t < fellY; rowIndex++) {
          const pick = p - 1 - rowIndex;
          if (pick < 0) break;
          const row = cloth.picks[pick];
          if (row.kind !== 'woven') continue; // gap cells are skipped until task 2.1
          const y = fellY - (rowIndex + 1) * t + centre;
          if (y < 0) continue;
          const weft = settings.weftPlan[pick % settings.weftPlan.length];
          for (let col = 0; col < cloth.baseEnds * settings.repeat; col++) {
            const x = col * t + centre;
            if (x >= image.width) break;
            const lifted = row.lift[col % cloth.baseEnds] === 1;
            let expected = lifted ? shaded(settings.warpColour, shade) : shaded(weftHex(weft), shade);
            // A zari weft cell has an unshaded highlight on its centre row where x mod 4 = 0 (R5.5).
            const highlight = highlightHex(weft);
            if (!lifted && highlight !== undefined && x % 4 === 0) expected = parseColour(highlight)!;
            expect(pixelAt(image, x, y)).toEqual(expected);
          }
        }
      }),
      { numRuns: IMAGE_RUNS, seed: IMAGE_SEED },
    );
  });

  it('R5.5 zari picks show the zari highlight and plain picks never do', () => {
    fc.assert(
      fc.property(profileAndSlots, renderSettingsArbitrary, fc.nat(), ({ profile, samples }, settings, seedPick) => {
        const cloth = prepared(profile, samples.map((sample) => sample.slot));
        const p = seedPick % (cloth.picks.length + 1);
        const image = rest(cloth, settings, p);
        const t = settings.threadSizePx;
        const centre = Math.floor(t / 2);
        const fellY = image.height - Math.min(6 * t, Math.floor(image.height / 3));
        const clothWidth = Math.min(image.width, cloth.baseEnds * settings.repeat * t);
        for (let rowIndex = 0; rowIndex * t < fellY; rowIndex++) {
          const pick = p - 1 - rowIndex;
          if (pick < 0) break;
          const row = cloth.picks[pick];
          if (row.kind !== 'woven') continue;
          const weft = settings.weftPlan[pick % settings.weftPlan.length];
          const highlight = highlightHex(weft);
          const top = fellY - (rowIndex + 1) * t;
          let wideWeftCell = false;
          let highlightSeen = false;
          for (let cell = 0; cell * t < clothWidth; cell++) {
            if (row.lift[cell % cloth.baseEnds] === 1) continue;
            const x0 = cell * t;
            const xEnd = Math.min(x0 + t, clothWidth);
            wideWeftCell = wideWeftCell || xEnd - x0 >= 4;
            for (let withinRow = 0; withinRow < t; withinRow++) {
              const y = top + withinRow;
              if (y < 0) continue;
              const first = pixelAt(image, x0, y);
              for (let x = x0; x < xEnd; x++) {
                const pixel = pixelAt(image, x, y);
                if (highlight === undefined) {
                  expect(pixel).toEqual(first); // plain weft cell: constant along x
                } else if (sameColour(pixel, parseColour(highlight)!)) {
                  highlightSeen = true;
                }
              }
            }
          }
          if (highlight !== undefined && wideWeftCell && top + centre >= 0) expect(highlightSeen).toBe(true);
        }
      }),
      { numRuns: IMAGE_RUNS, seed: IMAGE_SEED },
    );
  });

  const badPick = fc.oneof(
    fc.integer({ min: -1000, max: -1 }),
    fc.integer({ min: 0, max: 50 }).map((n) => n + 0.5),
    fc.constantFrom<unknown>(NaN, Infinity, -Infinity, '0', '1', null, undefined, true, {}, [], [0]),
  );

  it('R7.5 a frame outside the slot list fails with pick-out-of-range and gives no image', () => {
    fc.assert(
      fc.property(
        profileAndSlots,
        renderSettingsArbitrary,
        fc.nat({ max: 1000 }),
        badPick,
        fc.string().filter((phase) => phase !== 'rest' && phase !== 'lift' && phase !== 'pass'),
        fc.constantFrom<unknown>(undefined, null, 0, 1, 'rest', true, [], () => 0),
        ({ profile, samples }, settings, extra, pick, phase, notAnObject) => {
          const cloth = prepared(profile, samples.map((sample) => sample.slot));
          const count = cloth.picks.length;
          const frames: unknown[] = [
            { pick, phase: 'rest' },
            { pick: count + 1 + extra, phase: 'rest' },
            { pick: 0, phase },
            { pick: 0 },
            { phase: 'rest' },
            notAnObject,
          ];
          for (const frame of frames) {
            const result = renderFrame(cloth, settings, frame);
            expect(result.ok).toBe(false);
            if (result.ok) return;
            expect(result.failure.reason).toBe('pick-out-of-range');
            if (result.failure.reason === 'pick-out-of-range') expect(result.failure.pickCount).toBe(count);
          }
        },
      ),
    );
  });

  it('R8.1 the same input renders identical bytes every time, also with other renders in between', () => {
    fc.assert(
      fc.property(
        profileAndSlots,
        profileAndSlots,
        renderSettingsArbitrary,
        renderSettingsArbitrary,
        fc.nat(),
        fc.nat(),
        (first, second, settings, otherSettings, n1, n2) => {
          const cloth = prepared(first.profile, first.samples.map((sample) => sample.slot));
          const other = prepared(second.profile, second.samples.map((sample) => sample.slot));
          const p = n1 % (cloth.picks.length + 1);
          const before = rest(cloth, settings, p);
          const snapshot = Uint8ClampedArray.from(before.data);
          rest(cloth, otherSettings, n2 % (cloth.picks.length + 1));
          rest(other, settings, n2 % (other.picks.length + 1));
          const after = rest(cloth, settings, p);
          expect(after.width).toBe(before.width);
          expect(after.height).toBe(before.height);
          expect(Array.from(after.data)).toEqual(Array.from(snapshot));
          expect(Array.from(before.data)).toEqual(Array.from(snapshot));
        },
      ),
      { numRuns: IMAGE_RUNS, seed: IMAGE_SEED },
    );
  });

  describe('a tiny hand-made cloth', () => {
    // 2 x 2 hooks, so 4 ends per pick. Pick 0 lifts ends 0 and 2; pick 1 lifts ends 1 and 3.
    const profile: CardProfile = {
      name: 'tiny-2x2',
      cardWidthMm: 60,
      cardHeightMm: 45,
      hookRows: 2,
      hookColumns: 2,
      holeDiameterMm: 2.0,
      horizontalPitchMm: 3.0,
      verticalPitchMm: 3.0,
      firstHoleCentreMm: { x: 7.5, y: 6.0 },
      endOrder: [
        [0, 1],
        [2, 3],
      ],
      pegHoles: [
        { positionMm: { x: 3.0, y: 22.5 }, diameterMm: 2.5 },
        { positionMm: { x: 57.0, y: 22.5 }, diameterMm: 3.0 },
      ],
      lacingHoles: {
        diameterMm: 2.0,
        positionsMm: [
          { x: 15.0, y: 2.0 },
          { x: 45.0, y: 2.0 },
          { x: 15.0, y: 43.0 },
          { x: 45.0, y: 43.0 },
        ],
      },
    };
    const slots = [
      [
        [true, false],
        [true, false],
      ],
      [
        [false, true],
        [false, true],
      ],
    ];
    // t = 4, so the shade table is [160, 244, 244, 160]. Height 24 gives shedHeight 8 and fellY 16.
    const settings: RenderSettings = {
      warpColour: '#a03020',
      weftPlan: [
        { kind: 'plain', colour: '#204080' },
        { kind: 'zari', tone: 'gold' },
      ],
      threadSizePx: 4,
      repeat: 1,
      viewport: { width: 20, height: 24 },
      floatHighlight: null,
    };

    it('draws the fell row, the weft plan, the shed and the background', () => {
      const cloth = prepared(profile, slots);
      expect(shadeTable(4)).toEqual([160, 244, 244, 160]);

      const one = rest(cloth, settings, 1);
      expect(one.width).toBe(20);
      expect(one.height).toBe(24);
      expect(pixelAt(one, 0, 0)).toEqual([0xef, 0xe9, 0xdd]); // above pick 0: loom background
      expect(pixelAt(one, 0, 11)).toEqual([0xef, 0xe9, 0xdd]);
      expect(pixelAt(one, 0, 13)).toEqual([100, 30, 20]); // end 0 lifted: warp, column 0 shade 160
      expect(pixelAt(one, 5, 13)).toEqual([30, 61, 122]); // end 1 down: plain weft, row 1 shade 244
      expect(pixelAt(one, 5, 15)).toEqual([20, 40, 80]); // fell row (last woven pixel row), shade 160
      expect(pixelAt(one, 0, 16)).toEqual([100, 30, 20]); // first shed row: warp thread
      expect(pixelAt(one, 17, 16)).toEqual([0xef, 0xe9, 0xdd]); // right of the cloth

      const two = rest(cloth, settings, 2);
      expect(pixelAt(two, 0, 13)).toEqual([191, 154, 37]); // pick 1, weft 1 (gold), end 0 down
      expect(pixelAt(two, 5, 13)).toEqual([152, 45, 30]); // pick 1, end 1 lifted: warp, column 1 shade 244
      expect(pixelAt(two, 5, 9)).toEqual([30, 61, 122]); // pick 0 moved up one row: end 1 down, plain weft 0
      expect(pixelAt(two, 0, 9)).toEqual([100, 30, 20]); // pick 0, end 0 lifted
    });
  });
});
