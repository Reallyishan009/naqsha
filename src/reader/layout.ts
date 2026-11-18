import type { CardProfile, PointMm } from '../codec/index.ts';
import { cardToImage } from './pose';
import { equivalentDiameterPx } from './regions';
import type { DarkRegion, Pose } from './types';

/** Fraction of the smaller pitch that a region centroid may be from its predicted hole. */
export const LAYOUT_POSITION_TOLERANCE = 0.35;
/** Relative diameter error allowed between a region and its predicted hole. */
export const LAYOUT_DIAMETER_TOLERANCE = 0.3;
/** Fraction of the in-card regions that must be explained for the layout to match. */
export const LAYOUT_MATCH_MIN = 0.9;

export type ImageSize = { width: number; height: number };

export type LayoutResult = {
  matches: boolean;
  /** Regions whose centroid lies inside the card under the pose. */
  inCard: number;
  /** In-card regions that sit on a predicted hole of about the predicted diameter. */
  explained: number;
  /** Lacing holes with no explained region at their position. */
  missingLacingHoles: number;
};

/**
 * Checks whether the whole card agrees with a pose (R9.3, R18.5).
 * Every in-card region should sit on a hook position, peg hole or lacing hole of about the right size, and every
 * lacing hole (always punched) whose predicted disc lies fully inside the image must have such a region. Pure; no browser API.
 */
export function layoutMatches(
  profile: CardProfile,
  pose: Pose,
  regions: readonly DarkRegion[],
  imageSize: ImageSize,
): LayoutResult {
  const s = pose.pixelsPerMm;
  const t = (pose.tiltDegrees * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const tolerancePx = Math.max(
    1,
    LAYOUT_POSITION_TOLERANCE * Math.min(profile.horizontalPitchMm, profile.verticalPitchMm) * s,
  );

  const fixedHoles: { centre: PointMm; diameterMm: number }[] = [
    ...profile.pegHoles.map((peg) => ({ centre: peg.positionMm, diameterMm: peg.diameterMm })),
    ...profile.lacingHoles.positionsMm.map((centre) => ({ centre, diameterMm: profile.lacingHoles.diameterMm })),
  ];
  const fixedCentresPx = fixedHoles.map((hole) => cardToImage(pose, hole.centre));
  const lacingStart = profile.pegHoles.length;
  const lacingExplained = profile.lacingHoles.positionsMm.map(() => false);
  // A lacing hole the pose places partly or fully outside the image cannot be required (R10.4).
  const lacingRadiusPx = (profile.lacingHoles.diameterMm * s) / 2;
  const lacingRequired = profile.lacingHoles.positionsMm.map((_, index) => {
    const centre = fixedCentresPx[lacingStart + index]!;
    return (
      centre.x - lacingRadiusPx >= 0 &&
      centre.x + lacingRadiusPx <= imageSize.width &&
      centre.y - lacingRadiusPx >= 0 &&
      centre.y + lacingRadiusPx <= imageSize.height
    );
  });

  const closeEnough = (region: DarkRegion, centrePx: { x: number; y: number }, diameterMm: number): boolean => {
    if (Math.hypot(region.centroid.x - centrePx.x, region.centroid.y - centrePx.y) > tolerancePx) return false;
    const expectedPx = diameterMm * s;
    return Math.abs(equivalentDiameterPx(region) - expectedPx) <= LAYOUT_DIAMETER_TOLERANCE * expectedPx;
  };

  let inCard = 0;
  let explained = 0;
  for (const region of regions) {
    // Inverse pose: image pixels to card millimetres.
    const dx = region.centroid.x - pose.originPx.x;
    const dy = region.centroid.y - pose.originPx.y;
    const xMm = (dx * cos + dy * sin) / s;
    const yMm = (-dx * sin + dy * cos) / s;
    if (!(xMm >= 0 && xMm <= profile.cardWidthMm && yMm >= 0 && yMm <= profile.cardHeightMm)) continue;
    inCard++;

    let isExplained = false;
    // Nearest hook position by rounding in card millimetres.
    const hookColumn = Math.round((xMm - profile.firstHoleCentreMm.x) / profile.horizontalPitchMm);
    const hookRow = Math.round((yMm - profile.firstHoleCentreMm.y) / profile.verticalPitchMm);
    if (hookColumn >= 0 && hookColumn < profile.hookColumns && hookRow >= 0 && hookRow < profile.hookRows) {
      const centrePx = cardToImage(pose, {
        x: profile.firstHoleCentreMm.x + hookColumn * profile.horizontalPitchMm,
        y: profile.firstHoleCentreMm.y + hookRow * profile.verticalPitchMm,
      });
      isExplained = closeEnough(region, centrePx, profile.holeDiameterMm);
    }
    for (let k = 0; k < fixedHoles.length; k++) {
      if (closeEnough(region, fixedCentresPx[k]!, fixedHoles[k]!.diameterMm)) {
        isExplained = true;
        if (k >= lacingStart) lacingExplained[k - lacingStart] = true;
      }
    }
    if (isExplained) explained++;
  }

  const missingLacingHoles = lacingExplained.filter((found, index) => lacingRequired[index]! && !found).length;
  return {
    matches: inCard > 0 && explained / inCard >= LAYOUT_MATCH_MIN && missingLacingHoles === 0,
    inCard,
    explained,
    missingLacingHoles,
  };
}
