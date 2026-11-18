import type { DarkMap, GreyImage } from './types';

/**
 * Otsu's method on the grey-level histogram, with exact BigInt score comparison.
 * The first best split wins, then the split moves to the middle of the empty-bin gap.
 * Returns 0 when no split leaves both classes non-empty. A pixel is dark when its level < threshold.
 */
export function chooseThreshold(grey: GreyImage): number {
  const hist = new Array<number>(256).fill(0);
  for (let i = 0; i < grey.levels.length; i++) hist[grey.levels[i]]++;
  const total = grey.width * grey.height;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];

  let bestNum = 0n;
  let bestDen = 1n;
  let bestT = -1;
  let n0 = 0;
  let s0 = 0;
  for (let t = 0; t <= 254; t++) {
    n0 += hist[t];
    s0 += t * hist[t];
    const n1 = total - n0;
    if (n0 === 0 || n1 === 0) continue;
    const s1 = sum - s0;
    const diff = BigInt(s0) * BigInt(n1) - BigInt(s1) * BigInt(n0);
    const num = diff * diff;
    const den = BigInt(n0) * BigInt(n1);
    if (bestT < 0 || num * bestDen > bestNum * den) {
      bestNum = num;
      bestDen = den;
      bestT = t;
    }
  }
  if (bestT < 0) return 0;
  let tEnd = bestT;
  while (tEnd < 254 && hist[tEnd + 1] === 0) tEnd++;
  return Math.floor((bestT + tEnd) / 2) + 1;
}

/** dark = 1 where level < threshold, else 0. */
export function classifyDark(grey: GreyImage, threshold: number): DarkMap {
  const dark = new Uint8Array(grey.levels.length);
  for (let i = 0; i < dark.length; i++) dark[i] = grey.levels[i] < threshold ? 1 : 0;
  return { width: grey.width, height: grey.height, dark };
}
