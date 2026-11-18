import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardProfile } from '../../../src/codec/index.ts';
import { MIN_HOLE_DIAMETER_PX, readCard } from '../../../src/reader/index.ts';
import { DEFAULT_PIXELS_PER_MM, printableRaster } from '../../../src/ui/printable/raster.ts';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import type { SampleDesign } from '../../../src/ui/types.ts';
import { cardGridArbitrary, cardProfileArbitrary, demoProfile } from '../../support/profiles.ts';

const DESIGNS: SampleDesign[] = ['diamond', 'border', 'floral'];

/** Resolutions that give a hole diameter above the reader minimum, with 10% to spare. */
function pixelsPerMmArbitrary(profile: CardProfile): fc.Arbitrary<number> {
  const lowest = (MIN_HOLE_DIAMETER_PX / profile.holeDiameterMm) * 1.1;
  return fc.oneof(
    fc.constant(DEFAULT_PIXELS_PER_MM),
    fc.integer({ min: 0, max: 100 }).map((step) => lowest + ((16 - lowest) * step) / 100),
  );
}

describe('printable raster', () => {
  it('the demo card at 12 pixels per millimetre is 720 by 540 pixels', () => {
    const profile = demoProfile();
    const grid = Array.from({ length: profile.hookRows }, () => Array<boolean>(profile.hookColumns).fill(false));
    const result = printableRaster(profile, grid, 12);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.width).toBe(720);
    expect(result.value.height).toBe(540);
    expect(result.value.data).toHaveLength(720 * 540 * 4);
  });

  it('an invalid grid or resolution gives violations and no pixels', () => {
    const profile = demoProfile();
    expect(printableRaster(profile, [], 12).ok).toBe(false);
    const grid = Array.from({ length: profile.hookRows }, () => Array<boolean>(profile.hookColumns).fill(true));
    expect(printableRaster(profile, grid, 0).ok).toBe(false);
  });

  it('R21.13 Property 37 reading a drawn card returns the same grid', () => {
    fc.assert(
      fc.property(
        cardProfileArbitrary.chain((profile) =>
          fc
            .tuple(cardGridArbitrary(profile), pixelsPerMmArbitrary(profile))
            .map(([grid, pixelsPerMm]) => ({ profile, grid, pixelsPerMm })),
        ),
        ({ profile, grid, pixelsPerMm }) => {
          const raster = printableRaster(profile, grid, pixelsPerMm);
          expect(raster.ok).toBe(true);
          if (!raster.ok) return;
          const read = readCard(profile, raster.value);
          expect(read.ok).toBe(true);
          if (read.ok) expect(read.grid).toEqual(grid);
        },
      ),
      { seed: 3701, numRuns: 100 },
    );
  }, 120_000);

  it('R21.14 Property 38 every pick of each Sample_Design reads back (demo profile)', () => {
    const profile = demoProfile();
    for (const design of DESIGNS) {
      generateSample(profile, design).forEach((grid, pickIndex) => {
        const raster = printableRaster(profile, grid, DEFAULT_PIXELS_PER_MM);
        expect(raster.ok, `${design} pick ${pickIndex}`).toBe(true);
        if (!raster.ok) return;
        const read = readCard(profile, raster.value);
        expect(read.ok, `${design} pick ${pickIndex}`).toBe(true);
        if (read.ok) expect(read.grid, `${design} pick ${pickIndex}`).toEqual(grid);
      });
    }
  }, 120_000);

  it('R21.14 Property 38 every pick of each Sample_Design reads back (generated profiles)', () => {
    fc.assert(
      fc.property(cardProfileArbitrary, (profile) => {
        for (const design of DESIGNS) {
          generateSample(profile, design).forEach((grid, pickIndex) => {
            const raster = printableRaster(profile, grid, DEFAULT_PIXELS_PER_MM);
            expect(raster.ok).toBe(true);
            if (!raster.ok) return;
            const read = readCard(profile, raster.value);
            expect(read.ok, `${design} pick ${pickIndex}`).toBe(true);
            if (read.ok) expect(read.grid, `${design} pick ${pickIndex}`).toEqual(grid);
          });
        }
      }),
      { seed: 3801, numRuns: 20 },
    );
  }, 300_000);
});
