import type { CardProfile } from '../codec/index.ts';
import { normalizeDegrees } from './pose';
import { equivalentDiameterPx } from './regions';
import type { DarkRegion } from './types';

/** Largest tilt, in degrees, that still counts as the upright hypothesis (R9.5 needs 10; the extra 5 is a margin). */
export const TILT_SEARCH_LIMIT_DEGREES = 15;

/** Largest mean relative diameter error that still counts as a peg hole pair. */
export const FIT_MAX = 0.15;

export type PegHolePair = {
  /** The regions in peg role 0 and role 1 under the upright hypothesis. */
  uprightRegions: readonly [DarkRegion, DarkRegion];
  /** Pixels per millimetre implied by the distance between the two regions. */
  pixelsPerMm: number;
  /** Mean relative diameter error of the pair, in [0, FIT_MAX]. */
  fit: number;
};

/**
 * Finds the two peg hole regions among the candidate regions (R9.2, R9.7).
 *
 * Every unordered pair is tried. The distance between the pair gives a scale, the direction gives a tilt, and the
 * measured diameters are compared with the profile's peg hole diameters at that scale. The pair with the lowest
 * fit (at most FIT_MAX) wins, and ties go to the pair found first. The search assumes no scale, tilt or position.
 * Returns null when no pair fits, including when there are fewer than two regions.
 */
export function findPegHolePair(profile: CardProfile, regions: readonly DarkRegion[]): PegHolePair | null {
  return rankPegHolePairs(profile, regions, 1)[0] ?? null;
}

/**
 * Every accepted peg hole pair (fit <= FIT_MAX), sorted by ascending fit, at most `limit` of them (R9.3, R18.5).
 * Ties keep the order in which the pairs were found. The search is the one findPegHolePair describes. The best
 * `limit` pairs are kept by bounded insertion, so the full list is never sorted.
 */
export function rankPegHolePairs(
  profile: CardProfile,
  regions: readonly DarkRegion[],
  limit: number,
): PegHolePair[] {
  const ranked: PegHolePair[] = [];
  if (!(limit >= 1)) return ranked;
  const [peg0, peg1] = profile.pegHoles;
  const dx = peg1.positionMm.x - peg0.positionMm.x;
  const dy = peg1.positionMm.y - peg0.positionMm.y;
  const pegDistanceMm = Math.hypot(dx, dy);
  if (!(pegDistanceMm > 0)) return ranked;
  const phiDegrees = (Math.atan2(dy, dx) * 180) / Math.PI;

  const diameters = regions.map(equivalentDiameterPx);

  for (let i = 0; i < regions.length; i++) {
    const regionI = regions[i]!;
    for (let j = i + 1; j < regions.length; j++) {
      const regionJ = regions[j]!;
      const vx = regionJ.centroid.x - regionI.centroid.x;
      const vy = regionJ.centroid.y - regionI.centroid.y;
      const distancePx = Math.hypot(vx, vy);
      if (!(distancePx > 0)) continue;
      const pixelsPerMm = distancePx / pegDistanceMm;

      const thetaA = normalizeDegrees((Math.atan2(vy, vx) * 180) / Math.PI - phiDegrees);
      const thetaB = normalizeDegrees(thetaA + 180);
      let iIsRole0: boolean;
      if (Math.abs(thetaA) <= TILT_SEARCH_LIMIT_DEGREES) iIsRole0 = true;
      else if (Math.abs(thetaB) <= TILT_SEARCH_LIMIT_DEGREES) iIsRole0 = false;
      else continue;

      const u0 = iIsRole0 ? diameters[i]! : diameters[j]!;
      const u1 = iIsRole0 ? diameters[j]! : diameters[i]!;
      const e0 = peg0.diameterMm * pixelsPerMm;
      const e1 = peg1.diameterMm * pixelsPerMm;
      const cUp = Math.abs(u0 - e0) + Math.abs(u1 - e1);
      const cDown = Math.abs(u1 - e0) + Math.abs(u0 - e1);
      const fit = Math.min(cUp, cDown) / (e0 + e1);
      if (!(fit <= FIT_MAX)) continue;
      if (ranked.length >= limit && fit >= ranked[ranked.length - 1]!.fit) continue;
      // First index whose fit is greater than this one: equal fits stay ahead (found order).
      let low = 0;
      let high = ranked.length;
      while (low < high) {
        const mid = (low + high) >> 1;
        if (ranked[mid]!.fit <= fit) low = mid + 1;
        else high = mid;
      }
      ranked.splice(low, 0, {
        uprightRegions: iIsRole0 ? [regionI, regionJ] : [regionJ, regionI],
        pixelsPerMm,
        fit,
      });
      if (ranked.length > limit) ranked.pop();
    }
  }
  return ranked;
}
