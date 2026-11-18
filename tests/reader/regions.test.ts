import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { equivalentDiameterPx, findDarkRegions } from '../../src/reader/regions';
import type { DarkMap } from '../../src/reader/types';

const darkMapArb: fc.Arbitrary<DarkMap> = fc
  .tuple(fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 40 }), fc.double({ min: 0, max: 1, noNaN: true }))
  .chain(([width, height, density]) =>
    fc
      .array(fc.double({ min: 0, max: 1, noNaN: true }), { minLength: width * height, maxLength: width * height })
      .map((u) => ({ width, height, dark: Uint8Array.from(u, (v) => (v < density ? 1 : 0)) })),
  );

/** Independent union-find labelling; returns components as sorted pixel index lists, in scan order of first pixel. */
function unionFindComponents(map: DarkMap): number[][] {
  const { width, height, dark } = map;
  const parent = Array.from({ length: width * height }, (_, i) => i);
  const find = (a: number): number => {
    while (parent[a] !== a) {
      parent[a] = parent[parent[a]];
      a = parent[a];
    }
    return a;
  };
  const union = (a: number, b: number) => {
    parent[find(a)] = find(b);
  };
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (!dark[i]) continue;
      if (x + 1 < width && dark[i + 1]) union(i, i + 1);
      if (y + 1 < height && dark[i + width]) union(i, i + width);
    }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < width * height; i++) {
    if (!dark[i]) continue;
    const root = find(i);
    const g = groups.get(root);
    if (g) g.push(i);
    else groups.set(root, [i]);
  }
  return [...groups.values()].sort((a, b) => a[0] - b[0]);
}

describe('findDarkRegions', () => {
  it('R9.1 dark regions are the 4-connected components of the dark pixels', () => {
    fc.assert(
      fc.property(darkMapArb, (map) => {
        const before = Uint8Array.from(map.dark);
        const regions = findDarkRegions(map);
        const expected = unionFindComponents(map);
        expect(map.dark).toEqual(before);
        expect(regions.length).toBe(expected.length);
        expected.forEach((pixels, k) => {
          const r = regions[k]; // scan order of first pixel
          const xs = pixels.map((i) => i % map.width);
          const ys = pixels.map((i) => Math.floor(i / map.width));
          expect(r.area).toBe(pixels.length);
          expect(r.minX).toBe(Math.min(...xs));
          expect(r.maxX).toBe(Math.max(...xs));
          expect(r.minY).toBe(Math.min(...ys));
          expect(r.maxY).toBe(Math.max(...ys));
          const cx = xs.reduce((s, x) => s + x + 0.5, 0) / pixels.length;
          const cy = ys.reduce((s, y) => s + y + 0.5, 0) / pixels.length;
          expect(Math.abs(r.centroid.x - cx)).toBeLessThan(1e-9);
          expect(Math.abs(r.centroid.y - cy)).toBeLessThan(1e-9);
          // membership: the region's bounds contain exactly its pixels' bounds, and the first pixel is the scan-order first
          expect(r.minY * map.width + xs[0]).toBeLessThanOrEqual(pixels[0]);
        });
        expect(regions.reduce((s, r) => s + r.area, 0)).toBe(expected.reduce((s, p) => s + p.length, 0));
      }),
    );
  });

  it('R9.2 the equivalent diameter of a filled disc is within 1 px of its true diameter, and within 5% from 12 px', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 6, max: 40, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (diameter, fx, fy) => {
          const radius = diameter / 2;
          const size = Math.ceil(diameter) + 4;
          const spare = size - diameter;
          const cx = radius + fx * spare;
          const cy = radius + fy * spare;
          const dark = new Uint8Array(size * size);
          for (let y = 0; y < size; y++)
            for (let x = 0; x < size; x++) {
              const dx = x + 0.5 - cx;
              const dy = y + 0.5 - cy;
              if (dx * dx + dy * dy <= radius * radius) dark[y * size + x] = 1;
            }
          const regions = findDarkRegions({ width: size, height: size, dark });
          expect(regions.length).toBe(1);
          const absoluteError = Math.abs(equivalentDiameterPx(regions[0]) - diameter);
          expect(absoluteError).toBeLessThanOrEqual(1);
          if (diameter >= 12) expect(absoluteError / diameter).toBeLessThanOrEqual(0.05);
        },
      ),
      // Regression: a 6 px disc centred on a pixel corner measures 6.38 px.
      { examples: [[6, 0, 0]] },
    );
  });

  it('R9.1 two pixels touching only at a corner are two regions', () => {
    const map: DarkMap = { width: 2, height: 2, dark: Uint8Array.from([1, 0, 0, 1]) };
    const regions = findDarkRegions(map);
    expect(regions.map((r) => r.area)).toEqual([1, 1]);
    expect(regions[0].centroid).toEqual({ x: 0.5, y: 0.5 });
    expect(regions[1].centroid).toEqual({ x: 1.5, y: 1.5 });
  });

  it('R9.1 a region on the image edge touches the edge and an interior region does not', () => {
    const dark = new Uint8Array(25);
    dark[0] = 1; // corner
    dark[12] = 1; // centre of 5 x 5
    const regions = findDarkRegions({ width: 5, height: 5, dark });
    expect(regions.map((r) => r.touchesEdge)).toEqual([true, false]);
  });

  it('R9.1 an empty map and a map with no dark pixels have no regions', () => {
    expect(findDarkRegions({ width: 0, height: 0, dark: new Uint8Array(0) })).toEqual([]);
    expect(findDarkRegions({ width: 3, height: 3, dark: new Uint8Array(9) })).toEqual([]);
  });

  it('R9.2 equivalentDiameterPx of a 100 pixel region is 2 * sqrt(100 / PI)', () => {
    const region = { area: 100, centroid: { x: 0, y: 0 }, minX: 0, minY: 0, maxX: 9, maxY: 9, touchesEdge: true };
    expect(equivalentDiameterPx(region)).toBeCloseTo(11.2838, 4);
  });
});
