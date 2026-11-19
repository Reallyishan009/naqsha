import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { CardProfile } from '../../../src/codec/index.ts';
import { MIN_HOLE_DIAMETER_PX, readCard } from '../../../src/reader/index.ts';
import { DEFAULT_PIXELS_PER_MM, printableRaster } from '../../../src/ui/printable/raster.ts';
import { HOLE_RGB, RING_RGB, STOCK_RGB } from '../../../src/ui/printable/style.ts';
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
  it('R21.4 the raster has manila stock, hole ink at punched hooks, peg holes and lacing holes, and a different ring at unpunched hooks', () => {
    const profile = demoProfile();
    const grid = Array.from({ length: profile.hookRows }, (_, row) =>
      Array.from({ length: profile.hookColumns }, (_, column) => (row + column) % 2 === 0),
    );
    const result = printableRaster(profile, grid, 12);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { width, data } = result.value;
    const pixelAt = (xMm: number, yMm: number): number[] => {
      const offset = (Math.floor(yMm * 12) * width + Math.floor(xMm * 12)) * 4;
      return [data[offset]!, data[offset + 1]!, data[offset + 2]!];
    };
    expect(pixelAt(0.2, 0.2)).toEqual([...STOCK_RGB]);
    const radiusMm = profile.holeDiameterMm / 2;
    for (let hookRow = 0; hookRow < profile.hookRows; hookRow++) {
      for (let hookColumn = 0; hookColumn < profile.hookColumns; hookColumn++) {
        const x = profile.firstHoleCentreMm.x + hookColumn * profile.horizontalPitchMm;
        const y = profile.firstHoleCentreMm.y + hookRow * profile.verticalPitchMm;
        if (grid[hookRow]![hookColumn]) {
          expect(pixelAt(x, y)).toEqual([...HOLE_RGB]);
        } else {
          expect(pixelAt(x, y)).toEqual([...STOCK_RGB]); // the inside of the ring is stock
          expect(pixelAt(x + 0.9 * radiusMm, y)).toEqual([...RING_RGB]);
        }
      }
    }
    for (const peg of profile.pegHoles) expect(pixelAt(peg.positionMm.x, peg.positionMm.y)).toEqual([...HOLE_RGB]);
    for (const lacing of profile.lacingHoles.positionsMm) expect(pixelAt(lacing.x, lacing.y)).toEqual([...HOLE_RGB]);
    expect(RING_RGB).not.toEqual(HOLE_RGB);
    expect(RING_RGB).not.toEqual(STOCK_RGB);
  });

  it('R21.11 the demo card at 12 pixels per millimetre is 720 by 540 pixels', () => {
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

  it('R21.14 R21.15 Property 38 every pick of each Sample_Design reads back (demo profile)', () => {
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
      { seed: 3801, numRuns: 100 },
    );
  }, 300_000);
});
