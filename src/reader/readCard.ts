import { parseCardProfile } from '../codec/index.ts';
import { toGreyscale } from './greyscale';
import { decideOrientation } from './orientation';
import { findPegHolePair } from './pegHoles';
import { isPixelData } from './pixelData';
import { poseFromPegHoles } from './pose';
import { equivalentDiameterPx, findDarkRegions } from './regions';
import { sampleCardGrid } from './sampling';
import { chooseThreshold, classifyDark } from './threshold';
import type { DarkRegion, Orientation, ReadResult } from './types';

/** Smallest dark region, in pixels, that is kept as a peg hole candidate. */
export const MIN_REGION_AREA_PX = 4;
/** Largest number of candidate regions passed to the peg hole pair search. */
export const MAX_CANDIDATE_REGIONS = 400;

/**
 * Reads one punch card from RGBA pixel data (R12). Never throws and has no browser dependency.
 * The profile is checked before the pixels, and the first failure is returned. Failures carry no grid (R12.4).
 */
export function readCard(profileInput: unknown, pixels: unknown): ReadResult {
  const parsed = parseCardProfile(profileInput);
  if (!parsed.ok) return { ok: false, failure: { reason: 'invalid-profile', violations: parsed.violations } };
  const profile = parsed.value;

  if (!isPixelData(pixels)) {
    return {
      ok: false,
      failure: {
        reason: 'invalid-image',
        detail: 'width and height must be positive integers and data a Uint8ClampedArray of width * height * 4 bytes',
      },
    };
  }

  const grey = toGreyscale(pixels);
  const threshold = chooseThreshold(grey);
  const map = classifyDark(grey, threshold);

  const candidates: DarkRegion[] = findDarkRegions(map)
    .map((region, scanIndex) => ({ region, scanIndex }))
    .filter(({ region }) => !region.touchesEdge && region.area >= MIN_REGION_AREA_PX)
    .sort((a, b) => b.region.area - a.region.area || a.scanIndex - b.scanIndex)
    .slice(0, MAX_CANDIDATE_REGIONS)
    .map(({ region }) => region);

  const pair = findPegHolePair(profile, candidates);
  if (pair === null) return { ok: false, failure: { reason: 'peg-holes-not-found' } };

  const [peg0, peg1] = profile.pegHoles;
  const scale = pair.pixelsPerMm;
  const decision = decideOrientation(
    [peg0.diameterMm * scale, peg1.diameterMm * scale],
    [equivalentDiameterPx(pair.uprightRegions[0]), equivalentDiameterPx(pair.uprightRegions[1])],
  );
  if (decision.kind === 'ambiguous') {
    return { ok: false, failure: { reason: 'ambiguous-orientation', separation: decision.separation } };
  }

  const pose = poseFromPegHoles(profile, pair, decision.kind as Orientation);
  const grid = sampleCardGrid(profile, pose, map);
  if (grid === null) return { ok: false, failure: { reason: 'card-outside-image' } };
  return { ok: true, grid, pose };
}
