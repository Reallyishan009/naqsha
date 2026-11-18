import type { CardGrid, CardProfile } from '../codec/index.ts';
import { cardToImage } from './pose.ts';
import type { DarkMap, Pose } from './types.ts';

/** Fraction of the hole radius that is sampled (R10.3). */
export const SAMPLING_RADIUS_FRACTION = 0.6;

/** Radius in pixels of the sampling disc at one hook position. */
export function samplingRadiusPx(profile: CardProfile, pose: Pose): number {
  return SAMPLING_RADIUS_FRACTION * (profile.holeDiameterMm / 2) * pose.pixelsPerMm;
}

/** A hook position is punched when more than half of its sampling pixels are dark. Exactly half is not punched (R11.1). */
export function decidePunched(darkCount: number, sampleCount: number): boolean {
  return darkCount * 2 > sampleCount;
}

/**
 * Reads the card grid from a dark map using the pose (R10, R11).
 * Returns null, before reading any pixel, when any sampling disc leaves the image (R10.4).
 */
export function sampleCardGrid(profile: CardProfile, pose: Pose, map: DarkMap): CardGrid | null {
  const { width, height, dark } = map;
  const radiusPx = samplingRadiusPx(profile, pose);

  const centres: { x: number; y: number }[][] = [];
  for (let hookRow = 0; hookRow < profile.hookRows; hookRow++) {
    const centresInRow: { x: number; y: number }[] = [];
    for (let hookColumn = 0; hookColumn < profile.hookColumns; hookColumn++) {
      const centre = cardToImage(pose, {
        x: profile.firstHoleCentreMm.x + hookColumn * profile.horizontalPitchMm,
        y: profile.firstHoleCentreMm.y + hookRow * profile.verticalPitchMm,
      });
      const inside =
        centre.x - radiusPx >= 0 &&
        centre.x + radiusPx <= width &&
        centre.y - radiusPx >= 0 &&
        centre.y + radiusPx <= height;
      if (!inside) return null;
      centresInRow.push(centre);
    }
    centres.push(centresInRow);
  }

  const radiusSquared = radiusPx * radiusPx;
  return centres.map((centresInRow) =>
    centresInRow.map((centre) => {
      const minX = Math.max(0, Math.floor(centre.x - radiusPx));
      const maxX = Math.min(width - 1, Math.ceil(centre.x + radiusPx));
      const minY = Math.max(0, Math.floor(centre.y - radiusPx));
      const maxY = Math.min(height - 1, Math.ceil(centre.y + radiusPx));
      let darkCount = 0;
      let sampleCount = 0;
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          const dx = x + 0.5 - centre.x;
          const dy = y + 0.5 - centre.y;
          if (dx * dx + dy * dy <= radiusSquared) {
            sampleCount++;
            darkCount += dark[y * width + x];
          }
        }
      }
      if (sampleCount === 0) {
        const x = Math.min(width - 1, Math.max(0, Math.floor(centre.x)));
        const y = Math.min(height - 1, Math.max(0, Math.floor(centre.y)));
        sampleCount = 1;
        darkCount = dark[y * width + x];
      }
      return decidePunched(darkCount, sampleCount);
    }),
  );
}
