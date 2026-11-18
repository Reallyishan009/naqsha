import type { CardProfile } from '../codec/index.ts';
import { layoutMatches, type ImageSize, type LayoutResult } from './layout';
import { decideOrientation } from './orientation';
import { rankPegHolePairs, type PegHolePair } from './pegHoles';
import { poseFromPegHoles } from './pose';
import { equivalentDiameterPx } from './regions';
import type { DarkRegion, Pose } from './types';

/** Largest number of ranked peg hole pairs checked against the card layout. */
export const MAX_PAIRS_TO_VERIFY = 50;

export type PegHoleSelection =
  | { kind: 'selected'; pair: PegHolePair; pose: Pose; layout: LayoutResult }
  /** No pair matches the layout, or two pairs tie: peg-holes-not-found. */
  | { kind: 'none' }
  /** The chosen pair's peg diameters and layout disagree or cannot decide: ambiguous-orientation. */
  | { kind: 'ambiguous'; separation: number };

type Verified = {
  score: number;
  pair: PegHolePair;
  decision: ReturnType<typeof decideOrientation>;
  uprightPose: Pose;
  upsideDownPose: Pose;
  upright: LayoutResult;
  upsideDown: LayoutResult;
};

/**
 * Chooses the peg hole pair and pose that best explain the whole card: the best explanation wins (R9.3, R18.5).
 * Pure; no browser API.
 */
export function selectPegHolePair(
  profile: CardProfile,
  regions: readonly DarkRegion[],
  imageSize: ImageSize,
): PegHoleSelection {
  const [peg0, peg1] = profile.pegHoles;
  let best: Verified | null = null;
  let bestIsTied = false;
  for (const pair of rankPegHolePairs(profile, regions, MAX_PAIRS_TO_VERIFY)) {
    const uprightPose = poseFromPegHoles(profile, pair, 'upright');
    const upsideDownPose = poseFromPegHoles(profile, pair, 'upside-down');
    const upright = layoutMatches(profile, uprightPose, regions, imageSize);
    const upsideDown = layoutMatches(profile, upsideDownPose, regions, imageSize);
    if (!upright.matches && !upsideDown.matches) continue;
    const score = Math.max(upright.matches ? upright.explained : -1, upsideDown.matches ? upsideDown.explained : -1);
    if (best !== null && score < best.score) continue;
    if (best !== null && score === best.score) {
      bestIsTied = true;
      continue;
    }
    bestIsTied = false;
    const scale = pair.pixelsPerMm;
    best = {
      score,
      pair,
      decision: decideOrientation(
        [peg0.diameterMm * scale, peg1.diameterMm * scale],
        [equivalentDiameterPx(pair.uprightRegions[0]), equivalentDiameterPx(pair.uprightRegions[1])],
      ),
      uprightPose,
      upsideDownPose,
      upright,
      upsideDown,
    };
  }
  if (best === null || bestIsTied) return { kind: 'none' };
  const { decision } = best;
  if (decision.kind === 'ambiguous') return { kind: 'ambiguous', separation: decision.separation };
  const layout = decision.kind === 'upright' ? best.upright : best.upsideDown;
  if (!layout.matches) return { kind: 'ambiguous', separation: decision.separation };
  const pose = decision.kind === 'upright' ? best.uprightPose : best.upsideDownPose;
  return { kind: 'selected', pair: best.pair, pose, layout };
}
