import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { hookCentreMm, printableLayout } from '../../../src/ui/printable/layout.ts';
import { cardGridArbitrary, cardProfileArbitrary, demoProfile, mutateProfile, REMOVE } from '../../support/profiles.ts';

const SEED = 3401;

const profileAndGrid = cardProfileArbitrary.chain((profile) =>
  cardGridArbitrary(profile).map((grid) => ({ profile, grid })),
);

describe('printable layout', () => {
  it('hookCentreMm of the demo profile follows the first hole centre and the pitches', () => {
    const profile = demoProfile();
    expect(hookCentreMm(profile, 0, 0)).toEqual(profile.firstHoleCentreMm);
    const centre = hookCentreMm(profile, 2, 3);
    expect(centre.x).toBeCloseTo(profile.firstHoleCentreMm.x + 3 * profile.horizontalPitchMm);
    expect(centre.y).toBeCloseTo(profile.firstHoleCentreMm.y + 2 * profile.verticalPitchMm);
  });

  it('a demo grid gives one mark per hook position with the grid value', () => {
    const profile = demoProfile();
    const grid = Array.from({ length: profile.hookRows }, (_, row) =>
      Array.from({ length: profile.hookColumns }, (_, column) => (row + column) % 2 === 0),
    );
    const result = printableLayout(profile, grid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.hookMarks).toHaveLength(profile.hookRows * profile.hookColumns);
    expect(result.value.hookMarks.filter((mark) => mark.punched)).toHaveLength(
      (profile.hookRows * profile.hookColumns) / 2,
    );
  });

  it('an invalid grid gives violations and no layout', () => {
    const result = printableLayout(demoProfile(), [[true]]);
    expect(result.ok).toBe(false);
    expect('value' in result).toBe(false);
  });

  it('R21.17 Property 34 a layout is complete and inside the card; invalid input gives violations and no layout', () => {
    fc.assert(
      fc.property(profileAndGrid, ({ profile, grid }) => {
        const result = printableLayout(profile, grid);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const layout = result.value;
        expect(layout.hookMarks).toHaveLength(profile.hookRows * profile.hookColumns);
        for (const mark of layout.hookMarks) {
          expect(mark.punched).toBe(grid[mark.hookRow]![mark.hookColumn]);
          expect(mark.diameterMm).toBe(profile.holeDiameterMm);
          expect(mark.centreMm).toEqual(hookCentreMm(profile, mark.hookRow, mark.hookColumn));
        }
        expect(layout.pegHoles.map((peg) => peg.diameterMm)).toEqual(profile.pegHoles.map((peg) => peg.diameterMm));
        expect(layout.lacingHoles).toHaveLength(profile.lacingHoles.positionsMm.length);
        for (const lacing of layout.lacingHoles) expect(lacing.diameterMm).toBe(profile.lacingHoles.diameterMm);
        const discs = [...layout.hookMarks, ...layout.pegHoles, ...layout.lacingHoles];
        for (const disc of discs) {
          const radius = disc.diameterMm / 2;
          expect(disc.centreMm.x - radius).toBeGreaterThanOrEqual(0);
          expect(disc.centreMm.y - radius).toBeGreaterThanOrEqual(0);
          expect(disc.centreMm.x + radius).toBeLessThanOrEqual(profile.cardWidthMm);
          expect(disc.centreMm.y + radius).toBeLessThanOrEqual(profile.cardHeightMm);
        }

        // Invalid grid: one row too few.
        const shortGrid = grid.slice(1);
        const badGrid = printableLayout(profile, shortGrid);
        expect(badGrid.ok).toBe(false);
        if (!badGrid.ok) expect(badGrid.violations.length).toBeGreaterThan(0);
        // Invalid profile: a missing field.
        const badProfile = printableLayout(mutateProfile(profile, ['hookRows'], REMOVE), grid);
        expect(badProfile.ok).toBe(false);
        if (!badProfile.ok) expect(badProfile.violations.length).toBeGreaterThan(0);
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
