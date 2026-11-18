import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseCardProfile } from '../../src/codec/index.ts';
import type { CardProfile } from '../../src/codec/types.ts';
import { findPegHolePair } from '../../src/reader/pegHoles';
import type { DarkRegion, Pose } from '../../src/reader/types';
import {
  hookPositionRegions,
  lacingHoleRegions,
  pegHoleRegions,
  roundRegion,
  speckleRegions,
} from '../support/images';
import { profileArbitrary } from '../support/profiles';

function loadDemoProfile(): CardProfile {
  const parsed = parseCardProfile(JSON.parse(readFileSync('public/profiles/demo-12x16.json', 'utf8')));
  if (!parsed.ok) throw new Error('demo profile is invalid');
  return parsed.value;
}

const demo = loadDemoProfile();

describe('findPegHolePair', () => {
  it('R9.2 finds the pegs among punched holes and lacing holes at 6 px/mm and tilt 0, with the scale within 1%', () => {
    const pose: Pose = { tiltDegrees: 0, pixelsPerMm: 6, originPx: { x: 120, y: 90 }, orientation: 'upright' };
    const [peg0, peg1] = pegHoleRegions(demo, pose);
    const candidates = [
      ...hookPositionRegions(demo, pose),
      ...lacingHoleRegions(demo, pose),
      ...speckleRegions([{ x: 130.5, y: 95.5 }]),
      peg0,
      peg1,
    ];
    const pair = findPegHolePair(demo, candidates);
    expect(pair).not.toBeNull();
    expect(pair!.uprightRegions[0]).toBe(peg0);
    expect(pair!.uprightRegions[1]).toBe(peg1);
    expect(Math.abs(pair!.pixelsPerMm / 6 - 1)).toBeLessThan(0.01);
    expect(pair!.fit).toBeLessThan(0.01);
  });

  it('R9.2 finds the pegs in an upside-down card; uprightRegions holds the regions that would be role 0 and role 1 if the card were upright', () => {
    // At tilt 180 the role 0 peg is imaged to the right of the role 1 peg. The upright hypothesis is the one
    // that makes the pair point along the profile's peg direction, which assigns role 0 to the region imaged
    // at the role 1 peg. So we expect [region of peg 1, region of peg 0].
    const pose: Pose = { tiltDegrees: 180, pixelsPerMm: 6, originPx: { x: 500, y: 400 }, orientation: 'upside-down' };
    const [peg0, peg1] = pegHoleRegions(demo, pose);
    const candidates = [...hookPositionRegions(demo, pose), ...lacingHoleRegions(demo, pose), peg0, peg1];
    const pair = findPegHolePair(demo, candidates);
    expect(pair).not.toBeNull();
    expect(pair!.uprightRegions[0]).toBe(peg1);
    expect(pair!.uprightRegions[1]).toBe(peg0);
    expect(Math.abs(pair!.pixelsPerMm / 6 - 1)).toBeLessThan(0.01);
  });

  it('R9.7 returns null for an empty list and for one region', () => {
    expect(findPegHolePair(demo, [])).toBeNull();
    expect(findPegHolePair(demo, [roundRegion({ x: 10, y: 10 }, 12)])).toBeNull();
  });

  it('R9.7 regions that do not fit the peg holes give no pair', () => {
    // Construction. The pair test accepts only fit <= 0.15, and fit >= 0.4 when every measured diameter u is at
    // least 40% away from both expected diameters e0, e1 (|u - ek| >= 0.4 ek for every region and k). We build
    // lists where that holds for EVERY pair, whatever the implied scale s = distance / L, by controlling the
    // distances between centroids (no filtering):
    //  - "small": every region has diameter <= umax. Centroids sit on a lattice with spacing g = 2 L umax /
    //    (0.6 dmin), so every pair has s >= 2 umax / (0.6 dmin), and each ek >= umax / 0.3 > umax / 0.6. Then
    //    ek - u >= 0.4 ek.
    //  - "large": every region has diameter >= umin. Centroids lie in a square of side B = L umin / (1.5 * 1.4
    //    dmax), so every pair is closer than 1.5 B (the diagonal is B * sqrt 2), giving s <= umin / (1.4 dmax),
    //    so ek <= u / 1.4 and u - ek >= 0.4 ek.
    //  - fewer than two regions.
    const smallList = (profile: CardProfile) =>
      fc
        .tuple(
          fc.integer({ min: 1, max: 200 }),
          fc.uniqueArray(fc.tuple(fc.integer({ min: 0, max: 5 }), fc.integer({ min: 0, max: 5 })), {
            minLength: 2,
            maxLength: 12,
            selector: ([ix, iy]) => `${ix},${iy}`,
          }),
          fc.array(fc.double({ min: 0.05, max: 1, noNaN: true }), { minLength: 12, maxLength: 12 }),
        )
        .map(([maxArea, lattice, areaFractions]) => {
          const [peg0, peg1] = profile.pegHoles;
          const pegDistanceMm = Math.hypot(
            peg1.positionMm.x - peg0.positionMm.x,
            peg1.positionMm.y - peg0.positionMm.y,
          );
          const dmin = Math.min(peg0.diameterMm, peg1.diameterMm);
          const umax = 2 * Math.sqrt(maxArea / Math.PI);
          const spacing = (2 * pegDistanceMm * umax) / (0.6 * dmin);
          return lattice.map(([ix, iy], k): DarkRegion => {
            const area = Math.max(1, Math.round(maxArea * areaFractions[k]!));
            return { ...roundRegion({ x: ix * spacing, y: iy * spacing }, 1), area };
          });
        });
    const largeList = (profile: CardProfile) =>
      fc
        .tuple(
          fc.integer({ min: 100, max: 10000 }),
          fc.array(
            fc.tuple(
              fc.double({ min: 0, max: 1, noNaN: true }),
              fc.double({ min: 0, max: 1, noNaN: true }),
              fc.double({ min: 1, max: 4, noNaN: true }),
            ),
            { minLength: 2, maxLength: 12 },
          ),
        )
        .map(([minArea, items]) => {
          const [peg0, peg1] = profile.pegHoles;
          const pegDistanceMm = Math.hypot(
            peg1.positionMm.x - peg0.positionMm.x,
            peg1.positionMm.y - peg0.positionMm.y,
          );
          const dmax = Math.max(peg0.diameterMm, peg1.diameterMm);
          const umin = 2 * Math.sqrt(minArea / Math.PI);
          const side = (pegDistanceMm * umin) / (1.5 * 1.4 * dmax);
          return items.map(
            ([fx, fy, growth]): DarkRegion => ({
              ...roundRegion({ x: fx * side, y: fy * side }, 1),
              area: Math.round(minArea * growth),
            }),
          );
        });
    const fewList = fc.array(
      fc
        .tuple(fc.double({ min: 0, max: 500, noNaN: true }), fc.double({ min: 0, max: 500, noNaN: true }), fc.integer({ min: 1, max: 5000 }))
        .map(([x, y, area]): DarkRegion => ({ ...roundRegion({ x, y }, 1), area })),
      { maxLength: 1 },
    );
    fc.assert(
      fc.property(
        profileArbitrary.chain((profile) =>
          fc.tuple(fc.constant(profile), fc.oneof(smallList(profile), largeList(profile), fewList)),
        ),
        ([profile, regions]) => findPegHolePair(profile, regions) === null,
      ),
    );
  });
});
