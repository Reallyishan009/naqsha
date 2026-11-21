/**
 * A small software canvas for scripts/make_art.ts: anti-aliased shapes through signed distances, a soft shadow
 * and a deterministic grain. No dependency, no browser; every function is pure apart from writing into the canvas.
 */
export type Rgb = readonly [number, number, number];

/** Linear blend of two colours, `amount` 0 gives `from` and 1 gives `to`. */
export function mix(from: Rgb, to: Rgb, amount: number): [number, number, number] {
  const k = Math.min(1, Math.max(0, amount));
  return [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k, from[2] + (to[2] - from[2]) * k];
}

export function hex(value: string): [number, number, number] {
  const match = /^#([0-9a-f]{6})$/i.exec(value);
  if (match === null) throw new Error(`not a #rrggbb colour: ${value}`);
  const n = Number.parseInt(match[1]!, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A hash of two integers and a seed to a number in [0, 1), the same on every machine. */
export function hash01(x: number, y: number, seed: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Coverage of a pixel from the signed distance (in pixels) of its centre to a shape's edge; negative is inside. */
export function coverage(distancePx: number): number {
  return Math.min(1, Math.max(0, 0.5 - distancePx));
}

export type Box = { left: number; top: number; right: number; bottom: number };

/** An RGB float canvas. */
export class Canvas {
  readonly width: number;
  readonly height: number;
  readonly pixels: Float32Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.pixels = new Float32Array(width * height * 3);
  }

  /** Fills every pixel with colourAt(x, y). */
  fill(colourAt: (x: number, y: number) => Rgb): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) this.set(x, y, colourAt(x, y));
    }
  }

  get(x: number, y: number): [number, number, number] {
    const at = (y * this.width + x) * 3;
    return [this.pixels[at]!, this.pixels[at + 1]!, this.pixels[at + 2]!];
  }

  set(x: number, y: number, colour: Rgb): void {
    const at = (y * this.width + x) * 3;
    this.pixels[at] = colour[0];
    this.pixels[at + 1] = colour[1];
    this.pixels[at + 2] = colour[2];
  }

  /** The box clipped to the canvas, in whole pixels. */
  clip(box: Box): Box {
    return {
      left: Math.max(0, Math.floor(box.left)),
      top: Math.max(0, Math.floor(box.top)),
      right: Math.min(this.width - 1, Math.ceil(box.right)),
      bottom: Math.min(this.height - 1, Math.ceil(box.bottom)),
    };
  }

  /**
   * Paints a shape over the canvas inside `box`. `distanceAt` gives the signed distance of a pixel centre to the shape in
   * pixels, `colourAt` the colour there (both get the pixel centre; colourAt also receives what is already painted).
   */
  paint(
    box: Box,
    distanceAt: (px: number, py: number) => number,
    colourAt: (px: number, py: number, under: Rgb) => Rgb,
    opacity = 1,
  ): void {
    const { left, top, right, bottom } = this.clip(box);
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const cover = coverage(distanceAt(x + 0.5, y + 0.5)) * opacity;
        if (cover <= 0) continue;
        const under = this.get(x, y);
        this.set(x, y, mix(under, colourAt(x + 0.5, y + 0.5, under), cover));
      }
    }
  }

  /** The canvas as 8-bit RGBA, with an optional grain of +-`grain` grey levels (deterministic). */
  toRgba(grain = 0, seed = 1): Uint8ClampedArray {
    const out = new Uint8ClampedArray(this.width * this.height * 4);
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const at = (y * this.width + x) * 3;
        const noise = grain === 0 ? 0 : (hash01(x, y, seed) - 0.5) * 2 * grain;
        const o = (y * this.width + x) * 4;
        out[o] = this.pixels[at]! + noise;
        out[o + 1] = this.pixels[at + 1]! + noise;
        out[o + 2] = this.pixels[at + 2]! + noise;
        out[o + 3] = 255;
      }
    }
    return out;
  }
}

/** A coverage mask the size of a canvas, for a soft shadow. */
export class Mask {
  readonly width: number;
  readonly height: number;
  data: Float32Array<ArrayBufferLike>;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.data = new Float32Array(width * height);
  }

  /** Adds a shape's coverage (the larger of what is there and the new coverage). */
  add(canvas: Canvas, box: Box, distanceAt: (px: number, py: number) => number): void {
    const { left, top, right, bottom } = canvas.clip(box);
    for (let y = top; y <= bottom; y++) {
      for (let x = left; x <= right; x++) {
        const cover = coverage(distanceAt(x + 0.5, y + 0.5));
        const at = y * this.width + x;
        if (cover > this.data[at]!) this.data[at] = cover;
      }
    }
  }

  /** Three box blurs of `radius` pixels in each direction, which is close to a gaussian. */
  blur(radius: number): void {
    const r = Math.max(1, Math.round(radius));
    const { width, height } = this;
    let source: Float32Array<ArrayBufferLike> = this.data;
    let target: Float32Array<ArrayBufferLike> = new Float32Array(source.length);
    for (let pass = 0; pass < 3; pass++) {
      for (let y = 0; y < height; y++) {
        let sum = 0;
        for (let x = -r; x <= r; x++) sum += source[y * width + Math.min(width - 1, Math.max(0, x))]!;
        for (let x = 0; x < width; x++) {
          target[y * width + x] = sum / (2 * r + 1);
          sum += source[y * width + Math.min(width - 1, x + r + 1)]! - source[y * width + Math.max(0, x - r)]!;
        }
      }
      [source, target] = [target, source];
      for (let x = 0; x < width; x++) {
        let sum = 0;
        for (let y = -r; y <= r; y++) sum += source[Math.min(height - 1, Math.max(0, y)) * width + x]!;
        for (let y = 0; y < height; y++) {
          target[y * width + x] = sum / (2 * r + 1);
          sum += source[Math.min(height - 1, y + r + 1) * width + x]! - source[Math.max(0, y - r) * width + x]!;
        }
      }
      [source, target] = [target, source];
    }
    this.data = source;
  }

  /** Darkens the canvas toward `colour` where the mask is set, shifted by (dx, dy) pixels. */
  castOn(canvas: Canvas, colour: Rgb, opacity: number, dx: number, dy: number): void {
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const sx = x - Math.round(dx);
        const sy = y - Math.round(dy);
        if (sx < 0 || sy < 0 || sx >= this.width || sy >= this.height) continue;
        const cover = this.data[sy * this.width + sx]! * opacity;
        if (cover <= 0) continue;
        canvas.set(x, y, mix(canvas.get(x, y), colour, cover));
      }
    }
  }
}

/** Signed distance (same unit as the arguments) from (x, y) to a rounded rectangle centred on (cx, cy). */
export function roundRectDistance(x: number, y: number, cx: number, cy: number, halfWidth: number, halfHeight: number, radius: number): number {
  const qx = Math.abs(x - cx) - (halfWidth - radius);
  const qy = Math.abs(y - cy) - (halfHeight - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Signed distance from (x, y) to a line segment of the given half thickness, rounded at both ends. */
export function segmentDistance(x: number, y: number, ax: number, ay: number, bx: number, by: number, halfThickness: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSquared = abx * abx + aby * aby;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((x - ax) * abx + (y - ay) * aby) / lengthSquared));
  return Math.hypot(x - (ax + t * abx), y - (ay + t * aby)) - halfThickness;
}

/** A card-to-pixel transform: scale `pxPerMm`, rotation `angle` (radians, clockwise on screen) and the pixel of the card's origin. */
export type Placement = { pxPerMm: number; angle: number; originX: number; originY: number };

export function toPixel(placement: Placement, xMm: number, yMm: number): { x: number; y: number } {
  const cos = Math.cos(placement.angle);
  const sin = Math.sin(placement.angle);
  return {
    x: placement.originX + placement.pxPerMm * (xMm * cos - yMm * sin),
    y: placement.originY + placement.pxPerMm * (xMm * sin + yMm * cos),
  };
}

export function toMm(placement: Placement, px: number, py: number): { x: number; y: number } {
  const cos = Math.cos(placement.angle);
  const sin = Math.sin(placement.angle);
  const dx = (px - placement.originX) / placement.pxPerMm;
  const dy = (py - placement.originY) / placement.pxPerMm;
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

/** The pixel box that holds a rectangle of `widthMm` by `heightMm` placed with `placement`, grown by `pad` pixels. */
export function rectBox(placement: Placement, widthMm: number, heightMm: number, pad: number): Box {
  const corners = [toPixel(placement, 0, 0), toPixel(placement, widthMm, 0), toPixel(placement, 0, heightMm), toPixel(placement, widthMm, heightMm)];
  return {
    left: Math.min(...corners.map((c) => c.x)) - pad,
    top: Math.min(...corners.map((c) => c.y)) - pad,
    right: Math.max(...corners.map((c) => c.x)) + pad,
    bottom: Math.max(...corners.map((c) => c.y)) + pad,
  };
}
