import type { PointMm } from '../codec/index.ts';
import type { PointPx, Pose } from './types.ts';

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
