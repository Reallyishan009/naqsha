import { floatLengthAt } from './floats.ts';
import { parseColour } from './settings.ts';
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
  packRgb,
  packShaded,
  shadeTable,
} from './style.ts';
import type { PreparedCloth, RenderSettings, SimImage, SimResult, Weft } from './types.ts';

type Rgb = [number, number, number];

type FrameRead = { valid: true; pick: number } | { valid: false; pick: unknown };

/**
 * TEMPORARY LIMIT (until task 3.2): only { pick, phase: 'rest' } with an integer pick 0..slotCount is drawn.
 * Every other value, including lift and pass frames, gives pick-out-of-range.
 */
function readFrame(frame: unknown, pickCount: number): FrameRead {
  try {
    if (typeof frame !== 'object' || frame === null) return { valid: false, pick: frame };
    const record = frame as Record<string, unknown>;
    const pick = record.pick;
    if (record.phase === 'rest' && typeof pick === 'number' && Number.isInteger(pick) && pick >= 0 && pick <= pickCount) {
      return { valid: true, pick };
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
 * Draws one frame as RGBA bytes (R8.1: same input, same bytes). Rest frames only for now, see readFrame.
 * Never throws for a bad frame (R7.5). Settings and cloth are expected to come from parseRenderSettings and prepareCloth.
 */
export function renderFrame(cloth: PreparedCloth, settings: RenderSettings, frame: unknown): SimResult<SimImage> {
  const pickCount = cloth.picks.length;
  const read = readFrame(frame, pickCount);
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

  // Draws every end of one pixel row as a vertical warp thread.
  const drawWarpRow = (rowStart: number): void => {
    for (let x0 = 0; x0 < drawnWidth; x0 += t) {
      const xEnd = Math.min(x0 + t, drawnWidth);
      for (let x = x0; x < xEnd; x++) pixels[rowStart + x] = warpByColumn[x - x0];
    }
    if (copyRepeats) copyAcross(rowStart);
  };

  // The shed: the first row is drawn and the rest are copies of it.
  if (shedHeight > 0) {
    drawWarpRow(fellY * width);
    for (let y = fellY + 1; y < height; y++) pixels.copyWithin(y * width, fellY * width, (fellY + 1) * width);
  }

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
      // Float highlighting (R3.3): only woven picks already in the cloth (0..p-1) count. Every pixel of a cell in a
      // float longer than the limit, zari highlight pixels included, is blended halfway toward the highlight colour.
      if (settings.floatHighlight !== null && floatLengthAt(cloth, pick, cell, settings.repeat, limit, p - 1) > limit) {
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
