import { decodeEnds, endsPerPick } from '../../codec/index.ts';
import type { CardProfile, Ends, Pattern } from '../../codec/index.ts';
import type { SampleDesign } from '../types.ts';

/** Number of times the motif repeats along the picks (R4.5). */
const REPEATS = 3;

/** Half-width of the diamond outline band around |u| + |v| = 0.8. */
const OUTLINE_HALF_WIDTH = 0.04;

/** Whether the end at unit position u lifts on the pick at unit position v. Only reads u and v, never a dimension. */
function lifted(design: SampleDesign, u: number, v: number): boolean {
  const au = Math.abs(u);
  const av = Math.abs(v);
  const sum = au + av;
  switch (design) {
    case 'diamond':
      return sum <= 0.5 || Math.abs(sum - 0.8) <= OUTLINE_HALF_WIDTH;
    case 'border':
      return au >= 0.8 || av >= 0.8;
    case 'floral':
      return (au * av <= 0.08 && sum <= 0.7) || sum <= 0.15;
    default: {
      const unreachable: never = design;
      return unreachable;
    }
  }
}

/**
 * Builds a Sample_Design for the profile: 3 * P picks, P = max(2, hookRows), one card per pick (R4.3, R4.5).
 * The ends list is turned into a card with decodeEnds, so endOrder is applied and no end index is computed here.
 * Pure and deterministic (R4.6). A profile that decodeEnds cannot use gives an empty pattern; the caller loads
 * the profile with parseCardProfile first.
 */
export function generateSample(profile: CardProfile, design: SampleDesign): Pattern {
  const endCount = endsPerPick(profile);
  const period = Math.max(2, profile.hookRows);
  const pattern: Pattern = [];
  for (let pickIndex = 0; pickIndex < REPEATS * period; pickIndex++) {
    const s = pickIndex % period;
    const v = (2 * s + 1 - period) / period;
    const ends: Ends = [];
    for (let end = 0; end < endCount; end++) {
      const u = (2 * end + 1 - endCount) / endCount;
      ends.push(lifted(design, u, v));
    }
    const decoded = decodeEnds(profile, ends);
    if (!decoded.ok) return [];
    pattern.push(decoded.value);
  }
  return pattern;
}
