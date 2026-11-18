import type { CardGrid, Violation } from '../codec/index.ts';

export type PixelData = { width: number; height: number; data: Uint8ClampedArray }; // RGBA, row-major
export type GreyImage = { width: number; height: number; levels: Uint8Array };
export type DarkMap = { width: number; height: number; dark: Uint8Array }; // 1 = dark, 0 = light
/** Continuous coordinates: pixel (x, y) covers [x, x+1) x [y, y+1). */
export type PointPx = { x: number; y: number };

export type DarkRegion = {
  area: number; // pixel count
  centroid: PointPx; // mean of pixel centres
  minX: number;
  minY: number;
  maxX: number;
  maxY: number; // inclusive pixel bounds
  touchesEdge: boolean; // minX == 0 || minY == 0 || maxX == width-1 || maxY == height-1
};

export type Orientation = 'upright' | 'upside-down';

export type Pose = {
  tiltDegrees: number; // -180 < tilt <= 180, positive = clockwise
  pixelsPerMm: number;
  originPx: PointPx; // image position of the card's top-left corner
  orientation: Orientation;
};

export type ReadFailure =
  | { reason: 'invalid-profile'; violations: Violation[] }
  | { reason: 'invalid-image'; detail: string }
  | { reason: 'peg-holes-not-found' }
  | { reason: 'ambiguous-orientation'; separation: number }
  | { reason: 'card-outside-image' };

export type ReadResult =
  | { ok: true; grid: CardGrid; pose: Pose }
  | { ok: false; failure: ReadFailure };
