import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { validateCardGrid } from '../../../src/codec/index.ts';
import type { CardGrid, CardProfile } from '../../../src/codec/index.ts';
import { cardToImage } from '../../../src/reader/index.ts';
import type { Pose } from '../../../src/reader/index.ts';
import {
  hitSizePx,
  hookMarkers,
  minimumZoom,
  toggleHook,
  undoCorrection,
} from '../../../src/ui/state/corrections.ts';
import type { HookPosition } from '../../../src/ui/types.ts';
import { cardGridArbitrary, cardProfileArbitrary, demoProfile } from '../../support/profiles.ts';

const SEED = 20240614;
const NUM_RUNS = 100;

const poseArbitrary: fc.Arbitrary<Pose> = fc.record({
  tiltDegrees: fc.double({ min: -180, max: 180, noNaN: true }),
  pixelsPerMm: fc.double({ min: 1, max: 40, noNaN: true }),
  originPx: fc.record({
    x: fc.double({ min: -500, max: 500, noNaN: true }),
    y: fc.double({ min: -500, max: 500, noNaN: true }),
  }),
  orientation: fc.constantFrom('upright' as const, 'upside-down' as const),
});

function positionArbitrary(profile: CardProfile): fc.Arbitrary<HookPosition> {
  return fc.record({
    hookRow: fc.integer({ min: 0, max: profile.hookRows - 1 }),
    hookColumn: fc.integer({ min: 0, max: profile.hookColumns - 1 }),
  });
}

describe('corrections examples', () => {
  const grid: CardGrid = [
    [true, false],
    [false, false],
  ];

  it('R10.1 toggleHook flips one position and leaves the input alone', () => {
    expect(toggleHook(grid, { hookRow: 0, hookColumn: 1 })).toEqual([
      [true, true],
      [false, false],
    ]);
    expect(grid[0]![1]).toBe(false);
  });

  it('R10.6 a position outside the grid returns the grid unchanged', () => {
    for (const position of [
      { hookRow: -1, hookColumn: 0 },
      { hookRow: 2, hookColumn: 0 },
      { hookRow: 0, hookColumn: 2 },
      { hookRow: 0.5, hookColumn: 0 },
    ]) {
      expect(toggleHook(grid, position)).toBe(grid);
    }
  });

  it('R10.5 undoCorrection reverts the latest correction and does nothing when none is left', () => {
    const position = { hookRow: 1, hookColumn: 0 };
    const toggled = toggleHook(grid, position);
    expect(undoCorrection(toggled, [position])).toEqual({ grid, corrected: [] });
    expect(undoCorrection(grid, [])).toEqual({ grid, corrected: [] });
  });

  it('R10.4 a position toggled twice shows as uncorrected', () => {
    const profile = demoProfile();
    const pose: Pose = { tiltDegrees: 0, pixelsPerMm: 10, originPx: { x: 0, y: 0 }, orientation: 'upright' };
    const readGrid = Array.from({ length: profile.hookRows }, () => Array<boolean>(profile.hookColumns).fill(false));
    const once = { hookRow: 0, hookColumn: 0 };
    const twice = { hookRow: 1, hookColumn: 1 };
    const markers = hookMarkers(profile, pose, readGrid, [once, twice, twice]);
    expect(markers).toHaveLength(profile.hookRows * profile.hookColumns);
    expect(markers.filter((marker) => marker.corrected).map((m) => [m.hookRow, m.hookColumn])).toEqual([[0, 0]]);
  });

  it('R10.3 minimumZoom is 1 for wide spacing and grows for narrow spacing', () => {
    expect(minimumZoom(100)).toBe(1);
    expect(minimumZoom(24)).toBeGreaterThanOrEqual(2);
    expect(hitSizePx(24, minimumZoom(24))).toBeGreaterThanOrEqual(48);
  });
});

describe('corrections properties', () => {
  it('R8.3 R8.4 markers sit on the hook positions, filled when punched and ring otherwise', () => {
    // Feature: app, Property 22: Markers sit on the hook positions with a shape for each state
    fc.assert(
      fc.property(
        cardProfileArbitrary.chain((profile) =>
          fc.record({ profile: fc.constant(profile), grid: cardGridArbitrary(profile), pose: poseArbitrary }),
        ),
        ({ profile, grid, pose }) => {
          const markers = hookMarkers(profile, pose, grid, []);
          expect(markers).toHaveLength(profile.hookRows * profile.hookColumns);
          for (const marker of markers) {
            // The reader's own formula (src/reader/sampling.ts), written out here so drift in either copy fails.
            const expected = cardToImage(pose, {
              x: profile.firstHoleCentreMm.x + marker.hookColumn * profile.horizontalPitchMm,
              y: profile.firstHoleCentreMm.y + marker.hookRow * profile.verticalPitchMm,
            });
            expect(marker.centrePx.x).toBeCloseTo(expected.x, 9);
            expect(marker.centrePx.y).toBeCloseTo(expected.y, 9);
            expect(marker.shape).toBe(grid[marker.hookRow]![marker.hookColumn] ? 'filled' : 'ring');
          }
        },
      ),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });

  it('R10.1 R10.5 R10.6 R10.7 toggling a hook twice restores the grid, and undoing every correction restores the read grid', () => {
    // Feature: app, Property 24: Toggling a hook twice restores the grid and keeps it valid
    fc.assert(
      fc.property(
        cardProfileArbitrary.chain((profile) =>
          fc.record({
            profile: fc.constant(profile),
            grid: cardGridArbitrary(profile),
            position: positionArbitrary(profile),
            positions: fc.array(positionArbitrary(profile), { maxLength: 20 }),
          }),
        ),
        ({ profile, grid, position, positions }) => {
          const once = toggleHook(grid, position);
          expect(toggleHook(once, position)).toEqual(grid);

          let changedCells = 0;
          grid.forEach((row, hookRow) =>
            row.forEach((punched, hookColumn) => {
              if (once[hookRow]![hookColumn] !== punched) changedCells++;
            }),
          );
          expect(changedCells).toBe(1);
          expect(validateCardGrid(profile, once)).toEqual([]);

          let current = grid;
          for (const entry of positions) current = toggleHook(current, entry);
          expect(validateCardGrid(profile, current)).toEqual([]);
          let state = { grid: current, corrected: positions as ReadonlyArray<HookPosition> };
          while (state.corrected.length > 0) state = undoCorrection(state.grid, state.corrected);
          expect(state.grid).toEqual(grid);
        },
      ),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });

  it('R10.2 R10.3 hit areas reach 48 CSS pixels at or above the minimum zoom', () => {
    // Feature: app, Property 25: Hit areas reach 48 CSS pixels
    fc.assert(
      fc.property(
        fc.double({ min: Number.MIN_VALUE, max: 1e6, noNaN: true }),
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        (spacingPx, extra) => {
          const base = minimumZoom(spacingPx);
          expect(base).toBeGreaterThanOrEqual(1);
          expect(hitSizePx(spacingPx, base + extra)).toBeGreaterThanOrEqual(48);
        },
      ),
      { numRuns: NUM_RUNS, seed: SEED },
    );
  });
});
