import type { CardProfile, PointMm } from '../../src/codec/types.ts';
import { cardToImage } from '../../src/reader/pose';
import type { DarkRegion, PointPx, Pose } from '../../src/reader/types';

/**
 * Analytic region builders. They produce DarkRegion lists directly from a profile and a pose, with no image.
 * All functions are pure.
 */

/** A round dark region of the given diameter (pixels) centred on a point; touchesEdge is false. */
export function roundRegion(centroid: PointPx, diameterPx: number): DarkRegion {
  const radius = diameterPx / 2;
  return {
    area: Math.round(Math.PI * radius * radius),
    centroid: { x: centroid.x, y: centroid.y },
    minX: Math.floor(centroid.x - radius),
    minY: Math.floor(centroid.y - radius),
    maxX: Math.ceil(centroid.x + radius),
    maxY: Math.ceil(centroid.y + radius),
    touchesEdge: false,
  };
}

/** One region for a card position, placed with cardToImage; diameter in mm is scaled by the pose. */
export function regionAtCardPosition(pose: Pose, positionMm: PointMm, diameterMm: number): DarkRegion {
  return roundRegion(cardToImage(pose, positionMm), pose.pixelsPerMm * diameterMm);
}

/** The two peg hole regions, in profile role order (index 0 = role 0). */
export function pegHoleRegions(profile: CardProfile, pose: Pose): [DarkRegion, DarkRegion] {
  const [peg0, peg1] = profile.pegHoles;
  return [
    regionAtCardPosition(pose, peg0.positionMm, peg0.diameterMm),
    regionAtCardPosition(pose, peg1.positionMm, peg1.diameterMm),
  ];
}

/** One region per hook position (hookRows * hookColumns), at the punched hole diameter, in row-major order. */
export function hookPositionRegions(profile: CardProfile, pose: Pose): DarkRegion[] {
  const regions: DarkRegion[] = [];
  for (let hookRow = 0; hookRow < profile.hookRows; hookRow++) {
    for (let hookColumn = 0; hookColumn < profile.hookColumns; hookColumn++) {
      regions.push(
        regionAtCardPosition(
          pose,
          {
            x: profile.firstHoleCentreMm.x + hookColumn * profile.horizontalPitchMm,
            y: profile.firstHoleCentreMm.y + hookRow * profile.verticalPitchMm,
          },
          profile.holeDiameterMm,
        ),
      );
    }
  }
  return regions;
}

/** One region per lacing hole. */
export function lacingHoleRegions(profile: CardProfile, pose: Pose): DarkRegion[] {
  return profile.lacingHoles.positionsMm.map((positionMm) =>
    regionAtCardPosition(pose, positionMm, profile.lacingHoles.diameterMm),
  );
}

/** Small speckle regions (default area 3 pixels) at the given image positions. */
export function speckleRegions(centres: readonly PointPx[], area = 3): DarkRegion[] {
  return centres.map((centre) => ({
    area,
    centroid: { x: centre.x, y: centre.y },
    minX: Math.floor(centre.x),
    minY: Math.floor(centre.y),
    maxX: Math.floor(centre.x),
    maxY: Math.floor(centre.y),
    touchesEdge: false,
  }));
}
