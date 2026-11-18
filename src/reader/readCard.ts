import { parseCardProfile } from '../codec/index.ts';
import { toGreyscale } from './greyscale';
import { isPixelData } from './pixelData';
import { findDarkRegions } from './regions';
import { selectPegHolePair } from './selectPegHoles';
import { sampleCardGrid } from './sampling';
import { chooseThreshold, classifyDark } from './threshold';
import type { DarkRegion, ReadResult } from './types';

/** Smallest dark region, in pixels, that is kept as a peg hole candidate. */
export const MIN_REGION_AREA_PX = 4;
/** Largest number of candidate regions passed to the peg hole pair search. */
export const MAX_CANDIDATE_REGIONS = 400;

/**
 * Smallest punched hole diameter, in pixels, at which a read is accepted (R12.5).
 * This is a safety floor for a known defect: on a sparse card (one punched hole) the peg hole pair selection can pick
 * the wrong pair and return a wrong grid. Measured with one punched hole, tilt within 10 of 0 or 180, no noise, 3000
 * cases per 1 px bin, fast-check seeds 7000 to 7009: the highest bin with a wrong grid was 9 to 10 px (1 case); bins
 * 10 to 16 px were clean, and earlier runs (3000 cases per 0.5 px bin, seed 555) found wrong grids up to 6 px.
 * The floor is that bin's upper edge (10 px) plus 1 px.
 */
export const MIN_HOLE_DIAMETER_PX = 11;
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

  const selection = selectPegHolePair(profile, candidates, { width: pixels.width, height: pixels.height });
  if (selection.kind === 'none') return { ok: false, failure: { reason: 'peg-holes-not-found' } };
  if (selection.kind === 'ambiguous') {
    return { ok: false, failure: { reason: 'ambiguous-orientation', separation: selection.separation } };
  }
  const { pose } = selection;
  const holeDiameterPx = profile.holeDiameterMm * pose.pixelsPerMm;
  if (holeDiameterPx < MIN_HOLE_DIAMETER_PX) {
    return { ok: false, failure: { reason: 'resolution-too-low', holeDiameterPx, minimumPx: MIN_HOLE_DIAMETER_PX } };
  }
  const grid = sampleCardGrid(profile, pose, map);
  if (grid === null) return { ok: false, failure: { reason: 'card-outside-image' } };
  return { ok: true, grid, pose };
}
