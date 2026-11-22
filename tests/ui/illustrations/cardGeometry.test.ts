import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { cardGeometry, punchedHooks } from '../../../src/ui/illustrations/cardGeometry.ts';
import type { CardGeometry } from '../../../src/ui/illustrations/cardGeometry.ts';
import { hookCentreMm } from '../../../src/ui/printable/layout.ts';
import type { CardProfile } from '../../../src/codec/index.ts';
import { REMOVE, cardProfileArbitrary, demoProfile, mutateProfile } from '../../support/profiles.ts';

function geometryOf(profile: CardProfile): CardGeometry {
  const result = cardGeometry(profile);
  if (!result.ok) throw new Error('the profile should give a geometry');
  return result.geometry;
}

/** A valid profile other than the demo profile, fixed by seed so every run sees the same one. */
function otherProfile(): CardProfile {
  const demo = demoProfile();
  const [other] = fc
    .sample(cardProfileArbitrary, { seed: 41201, numRuns: 20 })
    .filter((candidate) => candidate.cardWidthMm !== demo.cardWidthMm && candidate.hookRows !== demo.hookRows);
  if (other === undefined) throw new Error('no second profile');
  return other;
}

describe('cardGeometry', () => {
  it('R12.2 the size, hook centres and hole diameter come from the demo profile', () => {
    const profile = demoProfile();
    const geometry = geometryOf(profile);
    expect(geometry.widthMm).toBe(profile.cardWidthMm);
    expect(geometry.heightMm).toBe(profile.cardHeightMm);
    expect(geometry.holeDiameterMm).toBe(profile.holeDiameterMm);
    expect(geometry.hookCentres).toHaveLength(profile.hookRows);
    for (let hookRow = 0; hookRow < profile.hookRows; hookRow++) {
      expect(geometry.hookCentres[hookRow]).toHaveLength(profile.hookColumns);
      for (let hookColumn = 0; hookColumn < profile.hookColumns; hookColumn++) {
        expect(geometry.hookCentres[hookRow]![hookColumn]).toEqual(hookCentreMm(profile, hookRow, hookColumn));
      }
    }
  });

  it('R12.2 the two peg holes keep their own positions and diameters, and the lacing holes come from the profile', () => {
    const profile = demoProfile();
    const geometry = geometryOf(profile);
    expect(geometry.pegHoles[0]).toEqual({ centreMm: profile.pegHoles[0].positionMm, diameterMm: profile.pegHoles[0].diameterMm });
    expect(geometry.pegHoles[1]).toEqual({ centreMm: profile.pegHoles[1].positionMm, diameterMm: profile.pegHoles[1].diameterMm });
    expect(geometry.pegHoles[0].diameterMm).not.toBe(geometry.pegHoles[1].diameterMm);
    expect(geometry.lacingHoles).toEqual(
      profile.lacingHoles.positionsMm.map((centreMm) => ({ centreMm, diameterMm: profile.lacingHoles.diameterMm })),
    );
  });

  it('R12.2 a second profile with other values gives other numbers, all of them its own', () => {
    const demo = demoProfile();
    const other = otherProfile();
    const geometry = geometryOf(other);
    expect(geometry.widthMm).toBe(other.cardWidthMm);
    expect(geometry.heightMm).toBe(other.cardHeightMm);
    expect(geometry.holeDiameterMm).toBe(other.holeDiameterMm);
    expect(geometry.hookCentres).toHaveLength(other.hookRows);
    expect(geometry.hookCentres[0]).toHaveLength(other.hookColumns);
    expect(geometry.hookCentres[other.hookRows - 1]![other.hookColumns - 1]).toEqual(
      hookCentreMm(other, other.hookRows - 1, other.hookColumns - 1),
    );
    expect(geometry.pegHoles.map((peg) => peg.diameterMm)).toEqual(other.pegHoles.map((peg) => peg.diameterMm));
    expect(geometry.lacingHoles.map((hole) => hole.centreMm)).toEqual(other.lacingHoles.positionsMm);
    expect(geometry).not.toEqual(geometryOf(demo));
    expect(geometry.hookCentres.length).not.toBe(demo.hookRows);
  });

  it('R12.12 an invalid profile gives { ok: false } and does not throw', () => {
    const demo = demoProfile();
    const invalid: unknown[] = [
      null,
      undefined,
      42,
      'profile',
      [],
      {},
      mutateProfile(demo, ['cardWidthMm'], REMOVE),
      mutateProfile(demo, ['hookRows'], 0),
      mutateProfile(demo, ['pegHoles'], []),
    ];
    for (const profile of invalid) expect(cardGeometry(profile)).toEqual({ ok: false });
  });

  it('R12.2 the result does not share the profile objects, so changing it leaves the profile alone', () => {
    const profile = demoProfile();
    const before = structuredClone(profile);
    const geometry = geometryOf(profile);
    geometry.pegHoles[0].centreMm.x += 1;
    geometry.lacingHoles[0]!.centreMm.y += 1;
    expect(profile).toEqual(before);
  });
});

describe('punchedHooks', () => {
  it('R12.3 gives one entry for each punched hook position, at the centre the profile gives it', () => {
    const profile = demoProfile();
    const geometry = geometryOf(profile);
    const grid = Array.from({ length: profile.hookRows }, (_, hookRow) =>
      Array.from({ length: profile.hookColumns }, (_, hookColumn) => (hookRow + hookColumn) % 3 === 0),
    );
    const punched = punchedHooks(profile, geometry, grid);
    expect(punched).not.toBeNull();
    expect(punched!.length).toBe(grid.flat().filter(Boolean).length);
    for (const hook of punched!) {
      expect(grid[hook.hookRow]![hook.hookColumn]).toBe(true);
      expect(hook.centreMm).toEqual(hookCentreMm(profile, hook.hookRow, hook.hookColumn));
    }
  });

  it('R12.5 returns null for a grid that does not match the profile, and does not throw', () => {
    const profile = demoProfile();
    const geometry = geometryOf(profile);
    const tooFewRows = Array.from({ length: profile.hookRows - 1 }, () => Array.from({ length: profile.hookColumns }, () => true));
    for (const grid of [null, 'grid', [], tooFewRows, [[true]]]) expect(punchedHooks(profile, geometry, grid)).toBeNull();
  });
});
