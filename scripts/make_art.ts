/**
 * Makes the pictures the app draws itself, into public/art, from the real code: the demo Card_Profile, the real sample
 * designs (generateSample), the card geometry of the Card_Drawing (cardGeometry, punchedHooks), the ends codec
 * (encodeCardGrid) and the cloth simulator (prepareCloth, renderFrame). Nothing here is a hand-drawn stand-in for a pattern.
 *
 *   node scripts/make_art.ts            writes public/art/*.avif
 *   node scripts/make_art.ts --png      writes public/art/*.png instead (a way to look at the pictures anywhere)
 *
 * The rendering is a plain software rasteriser (scripts/art/canvas.ts) and the PNG encoder of scripts/png_rgba.ts, so there is
 * no new dependency. The AVIF step uses `sips`, which ships with macOS. Same inputs give the same pictures; the AVIF bytes
 * depend on the encoder of the machine that ran it, which is why the files are committed.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { encodeCardGrid, parseCardProfile } from '../src/codec/index.ts';
import type { CardGrid, CardProfile, Pattern } from '../src/codec/index.ts';
import { parseRenderSettings, prepareCloth, renderFrame } from '../src/simulator/index.ts';
import type { Weft } from '../src/simulator/index.ts';
import { cardGeometry, punchedHooks } from '../src/ui/illustrations/cardGeometry.ts';
import type { CardGeometry, PunchedHook } from '../src/ui/illustrations/cardGeometry.ts';
import { generateSample, sampleWithLostCards } from '../src/ui/samples/sampleDesigns.ts';
import { ART, ART_HEIGHT, ART_LIST, ART_WIDTH, CHAIN_HEIGHT, CHAIN_WIDTH } from '../src/ui/state/art.ts';
import type { ArtId } from '../src/ui/state/art.ts';
import { Canvas, Mask, coverage, hash01, hex, mix, rectBox, roundRectDistance, segmentDistance, toMm, toPixel } from './art/canvas.ts';
import type { Placement, Rgb } from './art/canvas.ts';
import { encodePngRgba } from './png_rgba.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');

/** The most that public/photos and public/art may weigh together. */
export const IMAGE_BYTE_BUDGET = 600_000;
/** AVIF quality for sips (0 to 100). */
const AVIF_QUALITY = 80;

// ---------------------------------------------------------------- palette (colours, not card dimensions)

const TABLE_LIGHT = hex('#efe6d1');
const TABLE_DARK = hex('#dccfb0');
const STOCK_LIGHT = hex('#e3c58f');
const STOCK_DARK = hex('#cba868');
const STOCK_EDGE = hex('#9b7b44');
const SHADOW_INK = hex('#3a2a12');
const CORD = hex('#8c2a2a');
const CORD_DARK = hex('#5e1a1a');
const PANEL = hex('#fffbf2');
const GRID_LIFTED = hex('#234d3b');
const GRID_AT_REST = hex('#e9dfc6');
const GRID_REPEAT_LINE = hex('#c7a566');

// ---------------------------------------------------------------- the real inputs

export function demoProfile(): CardProfile {
  const json: unknown = JSON.parse(readFileSync(path.join(repoRoot, 'public/profiles/demo-12x16.json'), 'utf8'));
  const parsed = parseCardProfile(json);
  if (!parsed.ok) throw new Error(`the demo profile is invalid: ${JSON.stringify(parsed.violations)}`);
  return parsed.value;
}

function geometryOf(profile: CardProfile): CardGeometry {
  const result = cardGeometry(profile);
  if (!result.ok) throw new Error('the demo profile has no card geometry');
  return result.geometry;
}

function punchedOf(profile: CardProfile, geometry: CardGeometry, grid: CardGrid): PunchedHook[] {
  const punched = punchedHooks(profile, geometry, grid);
  if (punched === null) throw new Error('a sample card does not match the profile');
  return punched;
}

const countPunched = (grid: CardGrid): number => grid.reduce((sum, hookRow) => sum + hookRow.filter(Boolean).length, 0);

/** The pick of the pattern with the most punched holes (the first one on a tie), so the card shown is a full one. */
export function fullestPick(pattern: Pattern): number {
  let best = 0;
  pattern.forEach((grid, pick) => {
    if (countPunched(grid) > countPunched(pattern[best]!)) best = pick;
  });
  return best;
}

// ---------------------------------------------------------------- the table and the cards

function paintTable(canvas: Canvas): void {
  canvas.fill((x, y) => {
    const along = (x / canvas.width + y / canvas.height) / 2;
    const cx = x / canvas.width - 0.5;
    const cy = y / canvas.height - 0.5;
    const vignette = Math.min(1, (cx * cx + cy * cy) * 1.4);
    return mix(mix(TABLE_LIGHT, TABLE_DARK, along), TABLE_DARK, vignette * 0.45);
  });
}

type Disc = { x: number; y: number; r: number };

function discsOf(geometry: CardGeometry, punched: readonly PunchedHook[], placement: Placement): Disc[] {
  const disc = (centreX: number, centreY: number, diameterMm: number): Disc => {
    const centre = toPixel(placement, centreX, centreY);
    return { x: centre.x, y: centre.y, r: (diameterMm / 2) * placement.pxPerMm };
  };
  return [
    ...punched.map((hook) => disc(hook.centreMm.x, hook.centreMm.y, geometry.holeDiameterMm)),
    ...geometry.pegHoles.map((peg) => disc(peg.centreMm.x, peg.centreMm.y, peg.diameterMm)),
    ...geometry.lacingHoles.map((lacing) => disc(lacing.centreMm.x, lacing.centreMm.y, lacing.diameterMm)),
  ];
}

const CORNER_RADIUS_MM = 0.8;

/** The distance in pixels from a pixel centre to the edge of the card (negative inside). */
function cardDistance(geometry: CardGeometry, placement: Placement): (px: number, py: number) => number {
  return (px, py) => {
    const at = toMm(placement, px, py);
    return (
      roundRectDistance(at.x, at.y, geometry.widthMm / 2, geometry.heightMm / 2, geometry.widthMm / 2, geometry.heightMm / 2, CORNER_RADIUS_MM) *
      placement.pxPerMm
    );
  };
}

/** Adds the soft shadow of every card to the table: a wide soft one and a tight one at the edge. */
function castCardShadows(canvas: Canvas, geometry: CardGeometry, placements: readonly Placement[], reach: number): void {
  const wide = new Mask(canvas.width, canvas.height);
  const tight = new Mask(canvas.width, canvas.height);
  for (const placement of placements) {
    const box = rectBox(placement, geometry.widthMm, geometry.heightMm, 3);
    const distance = cardDistance(geometry, placement);
    wide.add(canvas, box, distance);
    tight.add(canvas, box, distance);
  }
  wide.blur(reach);
  tight.blur(Math.max(1, reach / 5));
  wide.castOn(canvas, SHADOW_INK, 0.36, reach * 0.45, reach * 0.9);
  tight.castOn(canvas, SHADOW_INK, 0.3, reach * 0.1, reach * 0.2);
}

/** Paints one card: manila stock in two tones with grain and a darker cut edge, then its punched holes, peg holes and lacing holes with the table showing through. */
function paintCard(canvas: Canvas, table: Canvas, geometry: CardGeometry, punched: readonly PunchedHook[], placement: Placement, seed: number): void {
  const distance = cardDistance(geometry, placement);
  canvas.paint(
    rectBox(placement, geometry.widthMm, geometry.heightMm, 3),
    distance,
    (px, py) => {
      const at = toMm(placement, px, py);
      const along = (at.x / geometry.widthMm + at.y / geometry.heightMm) / 2;
      const stock = mix(STOCK_LIGHT, STOCK_DARK, along);
      const grain = (hash01(Math.floor(px / 2), Math.floor(py / 2), seed) - 0.5) * 5 + (hash01(Math.floor(px), Math.floor(py), seed + 1) - 0.5) * 3;
      const edge = Math.min(1, Math.max(0, (distance(px, py) + 1.8) / 1.8));
      const shaded = mix(stock, STOCK_EDGE, edge * 0.4);
      return [shaded[0] + grain, shaded[1] + grain, shaded[2] + grain];
    },
  );
  const lightShift = 0.32 * placement.pxPerMm;
  for (const disc of discsOf(geometry, punched, placement)) {
    const box = { left: disc.x - disc.r - 3, top: disc.y - disc.r - 3, right: disc.x + disc.r + 3, bottom: disc.y + disc.r + 3 };
    canvas.paint(
      box,
      (px, py) => Math.hypot(px - disc.x, py - disc.y) - disc.r,
      (px, py) => {
        const [r, g, b] = table.get(Math.floor(px), Math.floor(py));
        const below: Rgb = [r * 0.86, g * 0.86, b * 0.86];
        // The paper's thickness shadows the inside wall on the side the light comes from (top left).
        const lit = coverage((Math.hypot(px - disc.x - lightShift, py - disc.y - lightShift) - disc.r) / 1.4);
        const inside = mix([below[0] * 0.42, below[1] * 0.42, below[2] * 0.42], below, lit);
        const rim = Math.min(1, Math.max(0, 1 + (Math.hypot(px - disc.x, py - disc.y) - disc.r) / 1.2));
        return mix(inside, STOCK_EDGE, rim * 0.5);
      },
    );
  }
}

/** A card on the table: the picture the Try a sample cards and the Landing show for one pick. */
function cardPicture(profile: CardProfile, grid: CardGrid, seed: number): Uint8ClampedArray {
  const geometry = geometryOf(profile);
  const canvas = new Canvas(ART_WIDTH, ART_HEIGHT);
  paintTable(canvas);
  const pxPerMm = Math.min((ART_WIDTH * 0.86) / geometry.widthMm, (ART_HEIGHT * 0.84) / geometry.heightMm);
  const placement: Placement = {
    pxPerMm,
    angle: 0,
    originX: (ART_WIDTH - geometry.widthMm * pxPerMm) / 2,
    originY: (ART_HEIGHT - geometry.heightMm * pxPerMm) / 2 - ART_HEIGHT * 0.01,
  };
  castCardShadows(canvas, geometry, [placement], ART_WIDTH * 0.022);
  const table = snapshot(canvas);
  paintCard(canvas, table, geometry, punchedOf(profile, geometry, grid), placement, seed);
  return canvas.toRgba(1.1, seed);
}

function snapshot(canvas: Canvas): Canvas {
  const copy = new Canvas(canvas.width, canvas.height);
  copy.pixels.set(canvas.pixels);
  return copy;
}

// ---------------------------------------------------------------- a chain of cards, laced

/** The cards in a line of the chain, the gap between two cards of a line and the gap between the two lines, all in millimetres. */
const CHAIN_PER_LINE = 4;
const CHAIN_GAP_MM = 18;
const CHAIN_LINE_GAP_MM = 46;
/** The first pick of the sample shown in the chain: pick 0 of the diamond has no punched hole, and the cards from here on show the figure growing. */
const CHAIN_FIRST_PICK = 2;

type Point = { x: number; y: number };

function cubicPoint(a: Point, c1: Point, c2: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * b.x,
    y: u * u * u * a.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * b.y,
  };
}

/**
 * Eight cards of the diamond sample laced into a chain, as a chain folds on a table: a line of four going right, then it turns back
 * and the next four come back under them. Each card's own height lies along the chain (that is where the lacing holes are), so a
 * card is turned a quarter turn. Cords run from the lower lacing holes of a card to the upper lacing holes of the next.
 */
function chainPicture(profile: CardProfile, pattern: Pattern, seed: number): Uint8ClampedArray {
  const geometry = geometryOf(profile);
  const count = CHAIN_PER_LINE * 2;
  const alongMm = geometry.heightMm + CHAIN_GAP_MM; // the step from one card to the next along a line
  const acrossMm = geometry.widthMm + CHAIN_LINE_GAP_MM;
  const unit: Placement[] = [];
  for (let index = 0; index < count; index++) {
    const line = Math.floor(index / CHAIN_PER_LINE);
    const place = index % CHAIN_PER_LINE;
    const screenPlace = line === 0 ? place : CHAIN_PER_LINE - 1 - place;
    // The card's centre in millimetres; the card's own y axis points right in the first line and left in the second.
    const centre: Point = { x: screenPlace * alongMm, y: line * acrossMm };
    const angle = line === 0 ? -Math.PI / 2 : Math.PI / 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const cx = geometry.widthMm / 2;
    const cy = geometry.heightMm / 2;
    unit.push({ pxPerMm: 1, angle, originX: centre.x - (cx * cos - cy * sin), originY: centre.y - (cx * sin + cy * cos) });
  }
  const corners = unit.flatMap((placement) => [0, 1, 2, 3].map((i) => toPixel(placement, (i % 2) * geometry.widthMm, Math.floor(i / 2) * geometry.heightMm)));
  const loopMm = 58; // room on the right for the cords that turn the chain back
  const minX = Math.min(...corners.map((c) => c.x));
  const maxX = Math.max(...corners.map((c) => c.x)) + loopMm;
  const minY = Math.min(...corners.map((c) => c.y));
  const maxY = Math.max(...corners.map((c) => c.y));
  const margin = CHAIN_WIDTH * 0.05;
  const pxPerMm = Math.min((CHAIN_WIDTH - 2 * margin) / (maxX - minX), (CHAIN_HEIGHT - 2 * margin) / (maxY - minY));
  const shiftX = (CHAIN_WIDTH - (maxX - minX) * pxPerMm) / 2 - minX * pxPerMm;
  const shiftY = (CHAIN_HEIGHT - (maxY - minY) * pxPerMm) / 2 - minY * pxPerMm;
  const placements: Placement[] = unit.map((placement) => ({
    pxPerMm,
    angle: placement.angle,
    originX: placement.originX * pxPerMm + shiftX,
    originY: placement.originY * pxPerMm + shiftY,
  }));

  const canvas = new Canvas(CHAIN_WIDTH, CHAIN_HEIGHT);
  paintTable(canvas);
  castCardShadows(canvas, geometry, placements, CHAIN_WIDTH * 0.011);
  const table = snapshot(canvas);
  placements.forEach((placement, index) => {
    const grid = pattern[CHAIN_FIRST_PICK + index];
    if (grid === undefined) throw new Error(`the sample has no pick ${CHAIN_FIRST_PICK + index}`);
    paintCard(canvas, table, geometry, punchedOf(profile, geometry, grid), placement, seed + index);
  });

  // The lacing: each lower lacing hole of a card to the upper lacing hole of the next card at the same x on the card.
  const lowerLacingHoles = geometry.lacingHoles.filter((lacing) => lacing.centreMm.y > geometry.heightMm / 2);
  const upperLacingHoles = geometry.lacingHoles.filter((lacing) => lacing.centreMm.y <= geometry.heightMm / 2);
  const cordHalf = Math.max(1.4, 0.55 * pxPerMm);
  const cords: Point[][] = [];
  for (let index = 0; index + 1 < count; index++) {
    const turning = index + 1 === CHAIN_PER_LINE;
    for (const lower of lowerLacingHoles) {
      const upper = upperLacingHoles.find((lacing) => Math.abs(lacing.centreMm.x - lower.centreMm.x) < 1e-6);
      if (upper === undefined) continue;
      const a = toPixel(placements[index]!, lower.centreMm.x, lower.centreMm.y);
      const b = toPixel(placements[index + 1]!, upper.centreMm.x, upper.centreMm.y);
      if (!turning) {
        cords.push([a, b]);
        continue;
      }
      // The turn: the cord leaves to the right and comes back; the one that spans more of the two cards goes round the outside.
      const outer = Math.abs(b.y - a.y) > acrossMm * pxPerMm;
      const reach = (outer ? 50 : 26) * pxPerMm;
      const line: Point[] = [];
      for (let step = 0; step <= 48; step++) {
        line.push(cubicPoint(a, { x: a.x + reach, y: a.y }, { x: b.x + reach, y: b.y }, b, step / 48));
      }
      cords.push(line);
    }
  }
  const segments = cords.flatMap((line) => line.slice(1).map((end, at) => ({ from: line[at]!, to: end })));
  const segmentBox = (from: Point, to: Point) => ({
    left: Math.min(from.x, to.x) - 8,
    top: Math.min(from.y, to.y) - 8,
    right: Math.max(from.x, to.x) + 8,
    bottom: Math.max(from.y, to.y) + 8,
  });
  const cordShadow = new Mask(canvas.width, canvas.height);
  for (const { from, to } of segments) {
    cordShadow.add(canvas, segmentBox(from, to), (px, py) => segmentDistance(px, py, from.x, from.y, to.x, to.y, cordHalf));
  }
  cordShadow.blur(2);
  cordShadow.castOn(canvas, SHADOW_INK, 0.45, cordHalf * 1.2, cordHalf * 1.6);
  for (const { from, to } of segments) {
    canvas.paint(
      segmentBox(from, to),
      (px, py) => segmentDistance(px, py, from.x, from.y, to.x, to.y, cordHalf),
      (px, py) => {
        const across = segmentDistance(px, py, from.x, from.y, to.x, to.y, 0) / cordHalf;
        return mix(CORD, CORD_DARK, Math.min(1, Math.max(0, across + 0.15)) * 0.7);
      },
    );
  }
  return canvas.toRgba(1.1, seed);
}

// ---------------------------------------------------------------- the pattern grid

/** How many ends and picks the grid and the cloth pictures show: 48 ends by 36 picks fills a 4 by 3 picture at 16 px a square. */
const SHOWN_ENDS = 48;
const SQUARE_PX = 14;

function gridPicture(profile: CardProfile, pattern: Pattern, seed: number): Uint8ClampedArray {
  const canvas = new Canvas(ART_WIDTH, ART_HEIGHT);
  paintTable(canvas);
  const picks = pattern.length;
  const gridWidth = SHOWN_ENDS * SQUARE_PX;
  const gridHeight = picks * SQUARE_PX;
  const pad = 18;
  const panelWidth = gridWidth + 2 * pad;
  const panelHeight = gridHeight + 2 * pad;
  const panelX = (ART_WIDTH - panelWidth) / 2;
  const panelY = (ART_HEIGHT - panelHeight) / 2;
  const panelDistance = (px: number, py: number): number =>
    roundRectDistance(px, py, panelX + panelWidth / 2, panelY + panelHeight / 2, panelWidth / 2, panelHeight / 2, 14);
  const panelBox = { left: panelX - 4, top: panelY - 4, right: panelX + panelWidth + 4, bottom: panelY + panelHeight + 4 };
  const shadow = new Mask(canvas.width, canvas.height);
  shadow.add(canvas, panelBox, panelDistance);
  shadow.blur(14);
  shadow.castOn(canvas, SHADOW_INK, 0.3, 4, 10);
  canvas.paint(panelBox, panelDistance, () => PANEL);

  const originX = panelX + pad;
  const originY = panelY + pad;
  const period = Math.max(2, profile.hookRows);
  // The lines that mark one repeat along the picks and along the ends.
  for (let line = 0; line <= picks; line += period) {
    const y = originY + line * SQUARE_PX;
    canvas.paint({ left: originX, top: y - 2, right: originX + gridWidth, bottom: y + 2 }, (px, py) => Math.max(Math.abs(py - y) - 0.75, Math.abs(px - (originX + gridWidth / 2)) - gridWidth / 2), () => GRID_REPEAT_LINE);
  }
  for (let line = 0; line <= SHOWN_ENDS; line += period) {
    const x = originX + line * SQUARE_PX;
    canvas.paint({ left: x - 2, top: originY, right: x + 2, bottom: originY + gridHeight }, (px, py) => Math.max(Math.abs(px - x) - 0.75, Math.abs(py - (originY + gridHeight / 2)) - gridHeight / 2), () => GRID_REPEAT_LINE);
  }
  pattern.forEach((grid, pick) => {
    const ends = encodeCardGrid(profile, grid);
    if (!ends.ok) throw new Error(`pick ${pick} does not encode: ${JSON.stringify(ends.violations)}`);
    for (let end = 0; end < SHOWN_ENDS; end++) {
      const cx = originX + (end + 0.5) * SQUARE_PX;
      const cy = originY + (pick + 0.5) * SQUARE_PX;
      const lifted = ends.value[end] === true;
      const half = lifted ? SQUARE_PX / 2 - 1.5 : SQUARE_PX / 2 - 3.5;
      canvas.paint(
        { left: cx - half - 2, top: cy - half - 2, right: cx + half + 2, bottom: cy + half + 2 },
        (px, py) => roundRectDistance(px, py, cx, cy, half, half, lifted ? 2.4 : 1.4),
        () => (lifted ? GRID_LIFTED : GRID_AT_REST),
      );
    }
  });
  return canvas.toRgba(0.8, seed);
}

// ---------------------------------------------------------------- the cloth

type ClothLook = { warp: string; wefts: Weft[] };

/** The size of one warp and weft intersection in a cloth picture that shows 48 ends of the sample; the border shows every end of the card, so it uses 4 px. */
const WEAVE_PX = 16;
const BORDER_WEAVE_PX = 4;

/**
 * The cloth of `pattern` woven with the real simulator and cropped to the woven part. The pattern is woven again and again
 * (the card chain laced round) until it fills the picture height, so the picture height must be a whole number of repeats.
 */
function clothPicture(profile: CardProfile, pattern: Pattern, look: ClothLook, sizePx: number): Uint8ClampedArray {
  const picks = ART_HEIGHT / sizePx;
  if (!Number.isInteger(picks) || picks % pattern.length !== 0) {
    throw new Error(`the cloth picture holds ${picks} picks, which is not a whole number of ${pattern.length}-pick repeats`);
  }
  const woven: Pattern = [];
  while (woven.length < picks) woven.push(...pattern);
  const cloth = prepareCloth(profile, woven);
  if (!cloth.ok) throw new Error(`prepareCloth failed: ${JSON.stringify(cloth.failure)}`);
  const shed = sizePx * 6; // the simulator keeps the lower 6 intersections for the shed; the picture is the woven part above it
  const settings = parseRenderSettings({
    warpColour: look.warp,
    weftPlan: look.wefts,
    threadSizePx: sizePx,
    repeat: 1,
    viewport: { width: ART_WIDTH, height: ART_HEIGHT + shed },
    floatHighlight: null,
  });
  if (!settings.ok) throw new Error(`parseRenderSettings failed: ${JSON.stringify(settings.failure)}`);
  const image = renderFrame(cloth.value, settings.value, { pick: picks, phase: 'rest' });
  if (!image.ok) throw new Error(`renderFrame failed: ${JSON.stringify(image.failure)}`);
  return new Uint8ClampedArray(image.value.data.buffer, image.value.data.byteOffset, ART_WIDTH * ART_HEIGHT * 4).slice();
}

// ---------------------------------------------------------------- the list of pictures

const MADDER_WEFT = '#7a1f2b';
const FOREST_WEFT = '#2c5a44';
const IVORY = '#f4ecd8';
const ivory: Weft = { kind: 'plain', colour: IVORY };
const forest: Weft = { kind: 'plain', colour: FOREST_WEFT };
const GOLD: Weft = { kind: 'zari', tone: 'gold' };

type Drawn = { rgba: Uint8ClampedArray; width: number; height: number };

/** Draws every picture of the catalogue and, as a check, the number of punched holes of each card picture. */
export function drawAll(): Record<ArtId, Drawn> {
  const profile = demoProfile();
  const diamond = generateSample(profile, 'diamond');
  const border = generateSample(profile, 'border');
  const floral = generateSample(profile, 'floral');
  const lost = sampleWithLostCards(profile);
  const size = (id: ArtId, rgba: Uint8ClampedArray): Drawn => ({ rgba, width: ART[id].width, height: ART[id].height });
  return {
    'card-diamond': size('card-diamond', cardPicture(profile, diamond[fullestPick(diamond)]!, 101)),
    'card-border': size('card-border', cardPicture(profile, border[fullestPick(border)]!, 102)),
    'card-floral': size('card-floral', cardPicture(profile, floral[fullestPick(floral)]!, 103)),
    'grid-diamond': size('grid-diamond', gridPicture(profile, diamond, 104)),
    'cloth-diamond': size('cloth-diamond', clothPicture(profile, diamond, { warp: IVORY, wefts: [{ kind: 'plain', colour: MADDER_WEFT }] }, WEAVE_PX)),
    'cloth-border': size('cloth-border', clothPicture(profile, border, { warp: MADDER_WEFT, wefts: [ivory, ivory, ivory, GOLD] }, BORDER_WEAVE_PX)),
    'cloth-floral': size('cloth-floral', clothPicture(profile, floral, { warp: IVORY, wefts: [forest, forest, forest, GOLD] }, WEAVE_PX)),
    'cloth-lost': size('cloth-lost', clothPicture(profile, lost, { warp: IVORY, wefts: [{ kind: 'plain', colour: MADDER_WEFT }] }, WEAVE_PX)),
    'chain-8': size('chain-8', chainPicture(profile, diamond, 105)),
  };
}

// ---------------------------------------------------------------- writing

function sipsAvailable(): boolean {
  try {
    execFileSync('sips', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function directoryBytes(directory: string): number {
  try {
    return readdirSync(directory)
      .filter((name) => !name.startsWith('.'))
      .reduce((sum, name) => sum + statSync(path.join(directory, name)).size, 0);
  } catch {
    return 0;
  }
}

function run(): void {
  const asPng = process.argv.includes('--png');
  if (!asPng && !sipsAvailable()) {
    throw new Error('AVIF needs `sips` (macOS). Run with --png to write PNG files instead.');
  }
  const outDir = path.join(repoRoot, 'public/art');
  mkdirSync(outDir, { recursive: true });
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'naqsha-art-'));
  const drawn = drawAll();
  const report: string[] = [];
  try {
    for (const spec of ART_LIST) {
      const picture = drawn[spec.id];
      const png = encodePngRgba(picture.width, picture.height, picture.rgba);
      if (asPng) {
        const file = path.join(outDir, spec.file.replace(/\.avif$/, '.png'));
        writeFileSync(file, png);
        report.push(`${path.basename(file)}  ${statSync(file).size} bytes`);
        continue;
      }
      const source = path.join(scratch, `${spec.id}.png`);
      const target = path.join(outDir, spec.file);
      writeFileSync(source, png);
      execFileSync('sips', ['-s', 'format', 'avif', '-s', 'formatOptions', String(AVIF_QUALITY), source, '--out', target], { stdio: 'ignore' });
      report.push(`${spec.file}  ${statSync(target).size} bytes`);
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  for (const line of report) console.log(line);
  const art = directoryBytes(outDir);
  const photos = directoryBytes(path.join(repoRoot, 'public/photos'));
  console.log(`public/art ${art} bytes, public/photos ${photos} bytes, together ${art + photos} (limit ${IMAGE_BYTE_BUDGET})`);
  if (!asPng && art + photos > IMAGE_BYTE_BUDGET) {
    throw new Error(`public/photos and public/art weigh ${art + photos} bytes, over the ${IMAGE_BYTE_BUDGET} limit; lower AVIF_QUALITY`);
  }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  run();
}
