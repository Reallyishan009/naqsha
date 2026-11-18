import type { PreparedCloth } from './types.ts';

/**
 * A float: a run of at least 2 adjacent threads of one set that pass over the other set without interlacing.
 * `pick` and `end` give the start of the run. A weft float starts at its pick and its first end. A warp float
 * starts at its end and its first pick. `length` is the number of ends (weft) or picks (warp) in the run.
 */
export type Float = { set: 'warp' | 'weft'; pick: number; end: number; length: number };

/**
 * Length of the float that the woven cell at (`pick`, tiled end `end`) belongs to, scanning at most
 * `maxLength + 1` cells in each direction, so the cost depends on `maxLength` only, never on the pick index (R3.3).
 *
 * The cell is warp-on-face when its end is lifted. Then the run is of warp-on-face picks at the same end, going down
 * to pick 0 and up to `lastPick`; a gap pick or a weft-on-face pick ends the run. Otherwise the run is of weft-on-face
 * ends in the same pick across the tiled width `baseEnds * repeat` (repeat boundaries join, R14.4); the run stops at
 * the first and last tiled end.
 *
 * The result is exact when it is at most `maxLength`, and larger than `maxLength` exactly when the true length is.
 * A run of 1 is not a float but is returned as 1. Returns 0 when the cell is not a woven cell in range.
 */
export function floatLengthAt(
  cloth: PreparedCloth,
  pick: number,
  end: number,
  repeat: number,
  maxLength: number,
  lastPick: number,
): number {
  const { baseEnds, picks } = cloth;
  const row = picks[pick];
  const tiledEnds = baseEnds * repeat;
  if (row === undefined || row.kind !== 'woven' || pick > lastPick || end < 0 || end >= tiledEnds) return 0;
  const reach = maxLength + 1;
  const warpOnFace = row.lift[end % baseEnds] === 1;
  let length = 1;

  if (warpOnFace) {
    const baseEnd = end % baseEnds;
    const isWarp = (q: number): boolean => {
      const other = picks[q];
      return other !== undefined && other.kind === 'woven' && other.lift[baseEnd] === 1;
    };
    for (let q = pick - 1, n = 0; q >= 0 && n < reach && isWarp(q); q--, n++) length++;
    for (let q = pick + 1, n = 0; q <= lastPick && q < picks.length && n < reach && isWarp(q); q++, n++) length++;
  } else {
    for (let e = end - 1, n = 0; e >= 0 && n < reach && row.lift[e % baseEnds] === 0; e--, n++) length++;
    for (let e = end + 1, n = 0; e < tiledEnds && n < reach && row.lift[e % baseEnds] === 0; e++, n++) length++;
  }
  return length;
}

/**
 * Finds every float in the cloth (R3.1, R3.2). Pure: the cloth is not changed.
 *
 * A weft float is a run of 2 or more adjacent ends with the weft on the face (lift 0) in one woven pick.
 * With repeat k the runs are measured across the full tiled width of k * baseEnds ends, so a run can cross a
 * repeat boundary. `end` is then a tiled end index.
 *
 * A warp float is a run of 2 or more adjacent picks with the warp on the face (lift 1) at one end. A missing or
 * damaged pick (a gap pick) ends the run, so no float covers a gap pick. The repeat does not change the runs, but
 * each warp float is listed once per repeat, at end `end + r * baseEnds` for r in 0..k-1, so that the end indices
 * agree with the tiled width used for weft floats.
 *
 * `repeat` must be a positive integer. A value that is not (zero, negative, fractional, NaN) is treated as 1.
 *
 * Output order: weft floats by pick, then by end; then warp floats by end (tiled), then by pick.
 */
export function computeFloats(cloth: PreparedCloth, repeat = 1): Float[] {
  const repeatCount = Number.isInteger(repeat) && repeat >= 1 ? repeat : 1;
  const { baseEnds, picks } = cloth;
  const tiledEnds = baseEnds * repeatCount;
  const floats: Float[] = [];

  for (let pick = 0; pick < picks.length; pick++) {
    const row = picks[pick]!;
    if (row.kind !== 'woven') continue;
    let runStart = -1;
    for (let end = 0; end <= tiledEnds; end++) {
      const weftOnFace = end < tiledEnds && row.lift[end % baseEnds] === 0;
      if (weftOnFace) {
        if (runStart < 0) runStart = end;
      } else if (runStart >= 0) {
        if (end - runStart >= 2) floats.push({ set: 'weft', pick, end: runStart, length: end - runStart });
        runStart = -1;
      }
    }
  }

  for (let end = 0; end < tiledEnds; end++) {
    const baseEnd = end % baseEnds;
    let runStart = -1;
    for (let pick = 0; pick <= picks.length; pick++) {
      const row = pick < picks.length ? picks[pick]! : undefined;
      const warpOnFace = row !== undefined && row.kind === 'woven' && row.lift[baseEnd] === 1;
      if (warpOnFace) {
        if (runStart < 0) runStart = pick;
      } else if (runStart >= 0) {
        if (pick - runStart >= 2) floats.push({ set: 'warp', pick: runStart, end, length: pick - runStart });
        runStart = -1;
      }
    }
  }

  return floats;
}
