import type { DarkMap, DarkRegion } from './types';

/**
 * Labels the 4-connected components of the dark pixels with an explicit-stack flood fill.
 * Works on a copy of `map.dark`. Regions come back in scan order of each region's first pixel.
 */
export function findDarkRegions(map: DarkMap): DarkRegion[] {
  const { width, height } = map;
  const regions: DarkRegion[] = [];
  const total = width * height;
  if (total === 0) return regions;
  const remaining = Uint8Array.from(map.dark.subarray(0, total));
  let darkCount = 0;
  for (let i = 0; i < total; i++) if (remaining[i] !== 0) darkCount++;
  if (darkCount === 0) return regions;
  const stack = new Int32Array(darkCount);
  for (let start = 0; start < total; start++) {
    if (remaining[start] === 0) continue;
    let top = 0;
    stack[top++] = start;
    remaining[start] = 0;
    let area = 0;
    let sumX = 0;
    let sumY = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    while (top > 0) {
      const index = stack[--top];
      const y = (index / width) | 0;
      const x = index - y * width;
      area++;
      sumX += x + 0.5;
      sumY += y + 0.5;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0 && remaining[index - 1] !== 0) {
        remaining[index - 1] = 0;
        stack[top++] = index - 1;
      }
      if (x < width - 1 && remaining[index + 1] !== 0) {
        remaining[index + 1] = 0;
        stack[top++] = index + 1;
      }
      if (y > 0 && remaining[index - width] !== 0) {
        remaining[index - width] = 0;
        stack[top++] = index - width;
      }
      if (y < height - 1 && remaining[index + width] !== 0) {
        remaining[index + width] = 0;
        stack[top++] = index + width;
      }
    }
    regions.push({
      area,
      centroid: { x: sumX / area, y: sumY / area },
      minX,
      minY,
      maxX,
      maxY,
      touchesEdge: minX === 0 || minY === 0 || maxX === width - 1 || maxY === height - 1,
    });
  }
  return regions;
}

/** Diameter of the circle with the same area as the region. */
export function equivalentDiameterPx(region: DarkRegion): number {
  return 2 * Math.sqrt(region.area / Math.PI);
}
