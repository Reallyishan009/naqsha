import { PASS_STEPS } from './frames.ts';
import { isPreparedCloth } from './prepare.ts';
import { parseColour, parseRenderSettings } from './settings.ts';
import {
  BACKGROUND_COLOUR,
  blendHalfway,
  FLOAT_HIGHLIGHT_COLOUR,
  GAP_DAMAGED_COLOUR,
  GAP_MISSING_COLOUR,
  GAP_WHITE_COLOUR,
  isCrossInk,
  isSlashInk,
  ZARI_GOLD_COLOUR,
  ZARI_GOLD_HIGHLIGHT_COLOUR,
  ZARI_HIGHLIGHT_COLUMN_STEP,
  ZARI_SILVER_COLOUR,
  ZARI_SILVER_HIGHLIGHT_COLOUR,
  packRaised,
  packRgb,
  packShaded,
  shadeTable,
} from './style.ts';
import type { PreparedCloth, RenderSettings, SimImage, SimResult, Weft } from './types.ts';

type Rgb = [number, number, number];

type FrameRead =
  | { valid: true; pick: number; phase: 'rest' | 'lift' | 'pass'; step: number }
  | { valid: false; pick: unknown };

/**
 * Accepts { pick, phase: 'rest' } with an integer pick 0..slotCount, { pick, phase: 'lift' } and
 * { pick, phase: 'pass', step } with an integer pick 0..slotCount-1 that is a woven pick (R9.3) and an integer step
 * 0..PASS_STEPS-1. Every other value, including lift/pass on a gap pick or on pick = slotCount, gives pick-out-of-range
 * (R7.5): such a frame does not exist.
 */
function readFrame(frame: unknown, cloth: PreparedCloth): FrameRead {
  try {
    if (typeof frame !== 'object' || frame === null) return { valid: false, pick: frame };
    const record = frame as Record<string, unknown>;
    const pick = record.pick;
    if (typeof pick !== 'number' || !Number.isInteger(pick) || pick < 0 || pick > cloth.picks.length) {
      return { valid: false, pick };
    }
    if (record.phase === 'rest') return { valid: true, pick, phase: 'rest', step: 0 };
    const woven = pick < cloth.picks.length && cloth.picks[pick].kind === 'woven';
    if (record.phase === 'lift' && woven) return { valid: true, pick, phase: 'lift', step: 0 };
    if (record.phase === 'pass' && woven) {
      const step = record.step;
      if (typeof step === 'number' && Number.isInteger(step) && step >= 0 && step < PASS_STEPS) {
        return { valid: true, pick, phase: 'pass', step };
      }
    }
    return { valid: false, pick };
  } catch {
    return { valid: false, pick: undefined };
  }
}

function weftBaseColour(weft: Weft): Rgb {
  const hex = weft.kind === 'plain' ? weft.colour : weft.tone === 'gold' ? ZARI_GOLD_COLOUR : ZARI_SILVER_COLOUR;
  return parseColour(hex) ?? [0, 0, 0];
}

/** The unshaded highlight colour of a zari weft, packed; undefined for a plain weft. */
function zariHighlight(weft: Weft): number | undefined {
  if (weft.kind !== 'zari') return undefined;
  const hex = weft.tone === 'gold' ? ZARI_GOLD_HIGHLIGHT_COLOUR : ZARI_SILVER_HIGHLIGHT_COLOUR;
  return packRgb(...(parseColour(hex) ?? [0, 0, 0]));
}

/**
 * Marks the cells of one woven pick that belong to a weft float longer than `limit` (R3.3): one left-to-right pass over
 * the tiled width `mask.length`, which is `baseEnds * repeat`. A run of weft-on-face cells (lift 0) that is longer than
 * `limit` sets `mask[end]` to 1 for each of its ends; every other end is set to 0. Repeat boundaries join runs (R14.4).
 * The result equals `floatLengthAt(...) > limit` for every end of the pick, with no per-cell scan.
 */
function markWeftFloats(lift: ArrayLike<number>, baseEnds: number, limit: number, mask: Uint8Array): void {
  const tiledEnds = mask.length;
  let runStart = 0;
  for (let end = 0; end <= tiledEnds; end++) {
    if (end < tiledEnds && lift[end % baseEnds] === 0) continue;
    mask.fill(end - runStart > limit ? 1 : 0, runStart, end);
    if (end < tiledEnds) mask[end] = 0;
    runStart = end + 1;
  }
}

/**
 * Marks the cells of the picks `firstPick..lastPick` that belong to a warp float longer than `limit` (R3.3), one pass
 * per base end. `mask` has one row of `baseEnds` entries per pick, row 0 being `firstPick`; a cell is set to 1 when its
 * run of warp-on-face woven picks (lift 1, counted down to pick 0 and up to `lastPick`, ended by a gap pick or a
 * weft-on-face pick) is longer than `limit`, and to 0 otherwise. The pass starts `limit` picks below `firstPick`, which
 * is enough to know whether a run reaching into the first row is longer than `limit`. The cost is
 * `baseEnds * (lastPick - firstPick + 1 + limit)`, whatever the pick index. The warp floats repeat identically across
 * repeats, so a base end serves every tiled end that maps onto it.
 */
function markWarpFloats(
  cloth: PreparedCloth,
  firstPick: number,
  lastPick: number,
  limit: number,
  mask: Uint8Array,
): void {
  const { baseEnds, picks } = cloth;
  mask.fill(0);
  if (lastPick < firstPick) return;
  const startPick = Math.max(0, firstPick - limit);
  for (let baseEnd = 0; baseEnd < baseEnds; baseEnd++) {
    let runStart = startPick;
    for (let pick = startPick; pick <= lastPick + 1; pick++) {
      if (pick <= lastPick) {
        const row = picks[pick]!;
        if (row.kind === 'woven' && row.lift[baseEnd] === 1) continue;
      }
      if (pick - runStart > limit) {
        for (let q = Math.max(runStart, firstPick); q < pick; q++) mask[(q - firstPick) * baseEnds + baseEnd] = 1;
      }
      runStart = pick + 1;
    }
  }
}

/**
 * Draws one frame as RGBA bytes (R8.1: same input, same bytes): rest, lift and pass frames, see readFrame.
 * Never throws for a bad frame (R7.5). Settings and cloth are expected to come from parseRenderSettings and prepareCloth.
 */
export function renderFrame(clothInput: PreparedCloth, settingsInput: RenderSettings, frame: unknown): SimResult<SimImage> {
  // Callers can pass values the types forbid, so the cloth must be one prepareCloth made (a check that costs O(1), so the
  // frame stays O(viewport), R7.2) and the settings are parsed again on every call (R7.5, R11.1: never throw).
  if (!isPreparedCloth(clothInput)) {
    return {
      ok: false,
      failure: { reason: 'invalid-settings', setting: 'cloth', message: 'cloth must be the result of prepareCloth' },
    };
  }
  const cloth = clothInput;
  const parsedSettings = parseRenderSettings(settingsInput);
  if (!parsedSettings.ok) return parsedSettings;
  const settings = parsedSettings.value;
  const pickCount = cloth.picks.length;
  const read = readFrame(frame, cloth);
  if (!read.valid) return { ok: false, failure: { reason: 'pick-out-of-range', pick: read.pick, pickCount } };
  const p = read.pick;

  const { width, height } = settings.viewport;
  const t = settings.threadSizePx;
  const shade = shadeTable(t);
  const data = new Uint8ClampedArray(width * height * 4);
  const pixels = new Uint32Array(data.buffer);

  const background = packRgb(...(parseColour(BACKGROUND_COLOUR) ?? [0, 0, 0]));
  pixels.fill(background);

  const warpRgb: Rgb = parseColour(settings.warpColour) ?? [0, 0, 0];
  const warpByColumn = shade.map((s) => packShaded(warpRgb, s));
  const raisedByColumn = shade.map((s) => packRaised(warpRgb, s));
  const weftByRow = settings.weftPlan.map((weft) => {
    const rgb = weftBaseColour(weft);
    return shade.map((s) => packShaded(rgb, s));
  });

  const gapWhite = packRgb(...(parseColour(GAP_WHITE_COLOUR) ?? [255, 255, 255]));
  const missingInk = packRgb(...(parseColour(GAP_MISSING_COLOUR) ?? [0, 0, 0]));
  const damagedInk = packRgb(...(parseColour(GAP_DAMAGED_COLOUR) ?? [0, 0, 0]));

  const highlightByWeft = settings.weftPlan.map(zariHighlight);
  const centreRow = Math.floor(t / 2);

  const baseEnds = cloth.baseEnds;
  const limit = settings.floatHighlight === null ? 0 : settings.floatHighlight.maxLength;
  const highlightTarget = parseColour(FLOAT_HIGHLIGHT_COLOUR) ?? [255, 0, 200];
  const clothWidth = Math.min(width, baseEnds * settings.repeat * t);
  const shedHeight = Math.min(6 * t, Math.floor(height / 3));
  const fellY = height - shedHeight;

  // Repeat (R14.2): with float highlighting off a pixel row is drawn for one base width and copied across the cloth.
  // With highlighting on, floats join across repeats (R14.4), so every cell is drawn and measured on its own.
  const copyRepeats = settings.floatHighlight === null;
  const baseWidth = baseEnds * t;
  const drawnWidth = copyRepeats ? Math.min(baseWidth, clothWidth) : clothWidth;
  // Fills the rest of the cloth width of one pixel row from its first drawnWidth pixels, doubling the copied span.
  const copyAcross = (rowStart: number): void => {
    for (let filled = drawnWidth; filled < clothWidth; filled *= 2) {
      pixels.copyWithin(rowStart + filled, rowStart, rowStart + Math.min(filled, clothWidth - filled));
    }
  };

  // In lift(p) and pass(p, s) the ends in pick p's lift set are drawn raised (R9.2).
  const shedRow = read.phase === 'rest' ? undefined : cloth.picks[p];
  const raisedLift = shedRow !== undefined && shedRow.kind === 'woven' ? shedRow.lift : undefined;

  // Draws every end of one pixel row as a vertical warp thread, raised ends lighter.
  const drawWarpRow = (rowStart: number): void => {
    for (let cell = 0, x0 = 0; x0 < drawnWidth; cell++, x0 += t) {
      const xEnd = Math.min(x0 + t, drawnWidth);
      const columns = raisedLift !== undefined && raisedLift[cell % baseEnds] === 1 ? raisedByColumn : warpByColumn;
      for (let x = x0; x < xEnd; x++) pixels[rowStart + x] = columns[x - x0];
    }
    if (copyRepeats) copyAcross(rowStart);
  };

  // The shed: the first row is drawn and the rest are copies of it.
  if (shedHeight > 0) {
    drawWarpRow(fellY * width);
    for (let y = fellY + 1; y < height; y++) pixels.copyWithin(y * width, fellY * width, (fellY + 1) * width);
  }

  // pass(p, s): pick p's weft is a band of t rows centred in the shed, from x = 0 to floor((s + 1) * clothWidthPx / PASS_STEPS) - 1,
  // cropped at the viewport and clipped to the shed rows. It is drawn directly over the warp, after the tiling,
  // because its right end is not periodic.
  if (read.phase === 'pass' && shedHeight > 0) {
    const clothWidthPx = baseEnds * settings.repeat * t;
    const bandEnd = Math.min(width, Math.floor(((read.step + 1) * clothWidthPx) / PASS_STEPS));
    const weftIndex = p % weftByRow.length;
    const bandTop = fellY + Math.floor((shedHeight - t) / 2);
    for (let i = 0; i < t; i++) {
      const y = bandTop + i;
      if (y < fellY || y >= height) continue;
      const rowStart = y * width;
      pixels.fill(weftByRow[weftIndex][i], rowStart, rowStart + bandEnd);
      const highlight = i === centreRow ? highlightByWeft[weftIndex] : undefined;
      if (highlight !== undefined) {
        for (let x = 0; x < bandEnd; x++) if ((x % baseWidth) % ZARI_HIGHLIGHT_COLUMN_STEP === 0) pixels[rowStart + x] = highlight;
      }
    }
  }

  // Float highlighting (R3.3, R10.2): one run-length pass per visible woven pick for the weft floats (computed when the
  // pick first appears) and one pass per end for the warp floats, over the visible picks plus `limit` picks of margin.
  // Only woven picks already in the cloth (0..p-1) count. The buffers are allocated once per frame.
  const highlighting = settings.floatHighlight !== null;
  const tiledEnds = baseEnds * settings.repeat;
  const lastRowIndex = fellY > 0 ? Math.floor((fellY - 1) / t) : -1;
  const firstVisiblePick = Math.max(0, p - 1 - lastRowIndex);
  const warpMask = new Uint8Array(highlighting && lastRowIndex >= 0 ? Math.max(0, p - firstVisiblePick) * baseEnds : 0);
  const weftMask = new Uint8Array(highlighting ? tiledEnds : 0);
  if (highlighting && warpMask.length > 0) markWarpFloats(cloth, firstVisiblePick, p - 1, limit, warpMask);
  let weftMaskPick = -1;

  // Woven rows above the fell. Row i (0 nearest the fell) holds y from fellY-(i+1)*t to fellY-i*t-1 and shows pick p-1-i.
  for (let y = 0; y < fellY; y++) {
    const rowIndex = Math.floor((fellY - 1 - y) / t);
    const pick = p - 1 - rowIndex;
    if (pick < 0) continue;
    const row = cloth.picks[pick];
    if (row === undefined) continue;
    const rowStart = y * width;
    if (row.kind !== 'woven') {
      // Gap row: hatch across the full cloth width, no warp, weft or shading (R4.1 to R4.5).
      // The hatch is measured from the start of each repeat, u = x mod baseWidth, so the row tiles (R14.2).
      const ink = row.kind === 'missing' ? missingInk : damagedInk;
      const inked = row.kind === 'missing' ? isSlashInk : isCrossInk;
      for (let x = 0; x < drawnWidth; x++) pixels[rowStart + x] = inked(x % baseWidth, y) ? ink : gapWhite;
      if (copyRepeats) copyAcross(rowStart);
      continue;
    }
    const withinRow = y - (fellY - (rowIndex + 1) * t);
    if (highlighting && weftMaskPick !== pick) {
      markWeftFloats(row.lift, baseEnds, limit, weftMask);
      weftMaskPick = pick;
    }
    const warpMaskRow = (pick - firstVisiblePick) * baseEnds;
    const weftIndex = pick % weftByRow.length;
    const weftRow = weftByRow[weftIndex][withinRow];
    const highlight = withinRow === centreRow ? highlightByWeft[weftIndex] : undefined;
    for (let cell = 0, x0 = 0; x0 < drawnWidth; cell++, x0 += t) {
      const xEnd = Math.min(x0 + t, drawnWidth);
      if (row.lift[cell % baseEnds] === 1) {
        for (let x = x0; x < xEnd; x++) pixels[rowStart + x] = warpByColumn[x - x0];
      } else {
        pixels.fill(weftRow, rowStart + x0, rowStart + xEnd);
        if (highlight !== undefined) {
          // Highlight columns are measured from the start of each repeat: u = x mod baseWidth, u mod 4 = 0 (R14.2).
          for (let x = x0; x < xEnd; x++) if ((x % baseWidth) % ZARI_HIGHLIGHT_COLUMN_STEP === 0) pixels[rowStart + x] = highlight;
        }
      }
      // Every pixel of a cell in a float longer than the limit, zari highlight pixels included, is blended halfway
      // toward the highlight colour.
      if (highlighting && (row.lift[cell % baseEnds] === 1 ? warpMask[warpMaskRow + (cell % baseEnds)] : weftMask[cell]) === 1) {
        for (let x = x0; x < xEnd; x++) {
          const o = (rowStart + x) * 4;
          data[o] = blendHalfway(data[o], highlightTarget[0]);
          data[o + 1] = blendHalfway(data[o + 1], highlightTarget[1]);
          data[o + 2] = blendHalfway(data[o + 2], highlightTarget[2]);
        }
      }
    }
    if (copyRepeats) copyAcross(rowStart);
  }

  return { ok: true, value: { width, height, data } };
}
