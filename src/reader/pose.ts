import type { CardProfile, PointMm } from '../codec/index.ts';
import type { PegHolePair } from './pegHoles';
import type { Orientation, PointPx, Pose } from './types.ts';

/**
 * Recovers the pose from the peg hole pair once the orientation is decided (R9.4, R18.3, R18.7).
 * For 'upside-down' the two roles are swapped, so the tilt comes out near 180.
 */
export function poseFromPegHoles(profile: CardProfile, pair: PegHolePair, orientation: Orientation): Pose {
  const [a, b] =
    orientation === 'upright' ? pair.uprightRegions : ([pair.uprightRegions[1], pair.uprightRegions[0]] as const);
  const [peg0, peg1] = profile.pegHoles;
  const p0 = peg0.positionMm;
  const p1 = peg1.positionMm;
  const toDegrees = (radians: number) => (radians * 180) / Math.PI;

  const imageDx = b.centroid.x - a.centroid.x;
  const imageDy = b.centroid.y - a.centroid.y;
  const cardDx = p1.x - p0.x;
  const cardDy = p1.y - p0.y;

  const pixelsPerMm = Math.hypot(imageDx, imageDy) / Math.hypot(cardDx, cardDy);
  const tiltDegrees = normalizeDegrees(toDegrees(Math.atan2(imageDy, imageDx)) - toDegrees(Math.atan2(cardDy, cardDx)));

  const t = (tiltDegrees * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const originPx: PointPx = {
    x: a.centroid.x - pixelsPerMm * (p0.x * cos - p0.y * sin),
    y: a.centroid.y - pixelsPerMm * (p0.x * sin + p0.y * cos),
  };
  return { tiltDegrees, pixelsPerMm, originPx, orientation };
}

/** Maps an angle in degrees to the range (-180, 180]. Non-finite input gives NaN. */
export function normalizeDegrees(angle: number): number {
  if (!Number.isFinite(angle)) return NaN;
  let r = angle % 360; // exact; result in (-360, 360)
  if (r <= -180) r += 360;
  else if (r > 180) r -= 360;
  return r === 0 ? 0 : r; // avoid -0
}

/** Smallest absolute difference between two angles in degrees, in [0, 180]. */
export function angleDifferenceDegrees(a: number, b: number): number {
  return Math.abs(normalizeDegrees(a - b));
}

/** Maps a card position in millimetres to image pixels using the pose (y points down, positive tilt is clockwise). */
export function cardToImage(pose: Pose, pointMm: PointMm): PointPx {
  const t = (pose.tiltDegrees * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const s = pose.pixelsPerMm;
  return {
    x: pose.originPx.x + s * (pointMm.x * cos - pointMm.y * sin),
    y: pose.originPx.y + s * (pointMm.x * sin + pointMm.y * cos),
  };
}
