import type { CardGrid, CardProfile, PointMm } from '../../src/codec/types.ts';
import { renderCard } from '../../scripts/make_fixtures.ts';
import type { RenderInput } from '../../scripts/make_fixtures.ts';
import { cardToImage } from '../../src/reader/pose';
import type { DarkRegion, PixelData, PointPx, Pose } from '../../src/reader/types';

/** A greyscale image as the fixture generator produces it. */
export type GreyPixels = { width: number; height: number; pixels: Uint8Array };

/** Converts a greyscale image to RGBA pixel data with r = g = b = level and alpha 255. */
export function greyToPixelData(grey: GreyPixels): PixelData {
  const data = new Uint8ClampedArray(grey.width * grey.height * 4);
  for (let i = 0; i < grey.pixels.length; i++) {
    const level = grey.pixels[i]!;
    data[4 * i] = level;
    data[4 * i + 1] = level;
    data[4 * i + 2] = level;
    data[4 * i + 3] = 255;
  }
  return { width: grey.width, height: grey.height, data };
}

export type Padding = { left: number; top: number; right: number; bottom: number; level: number };

/** Pads pixel data with a uniform grey level. Negative values are not allowed. */
export function padPixelData(pixels: PixelData, padding: Padding): PixelData {
  const width = pixels.width + padding.left + padding.right;
  const height = pixels.height + padding.top + padding.bottom;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[4 * i] = padding.level;
    data[4 * i + 1] = padding.level;
    data[4 * i + 2] = padding.level;
    data[4 * i + 3] = 255;
  }
  for (let y = 0; y < pixels.height; y++) {
    const source = y * pixels.width * 4;
    const target = ((y + padding.top) * width + padding.left) * 4;
    data.set(pixels.data.subarray(source, source + pixels.width * 4), target);
  }
  return { width, height, data };
}

/** Renders a card in memory with the fixture generator and returns it as pixel data. */
export function renderCardPixels(profile: CardProfile, card: CardGrid, options: RenderInput): PixelData {
  return greyToPixelData(renderCard(profile, card, options));
}

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
