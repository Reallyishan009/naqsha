/**
 * Renders synthetic Jacquard card images from a card profile and the hole
 * grid of ONE pick, plus a ground-truth JSON file for each image.
 *
 * One card is one pick. The hole grid is the set of hook positions for that
 * pick, so every hole position is an end (hookRows * hookColumns ends).
 *
 * Usage (Node 22.18+ runs .ts directly; otherwise use `npx tsx`):
 *   node scripts/make_fixtures.ts --all
 *   node scripts/make_fixtures.ts --profile public/profiles/demo-12x16.json \
 *        --card my-card.json --out tests/fixtures/mine.png \
 *        --noise 12 --tilt 5 --shade 0.2 --seed 7 [--pixels-per-mm 6] [--pick-index 3]
 *
 * A card file is JSON: an array of hook rows, each an array of booleans (one
 * per hook column). true = punched hole = the hook lifts.
 *
 * No third-party dependencies: PNG encoding uses node:zlib.
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { encodeCardGrid, parseCardProfile } from '../src/codec/index.ts';
import type { CardGrid, CardProfile, Ends, Pattern, PointMm, Violation } from '../src/codec/index.ts';

export type RenderOptions = {
  /** Standard deviation of gaussian noise, in grey levels (0 to 255). */
  noise: number;
  /** Rotation of the card in the image, degrees, positive = clockwise. */
  tiltDegrees: number;
  /** Strength of the shadow / brightness gradient, 0 (none) to about 0.5. */
  shade: number;
  /** Seed for all randomness. Same seed and inputs give identical bytes. */
  seed: number;
  /** Image scale: pixels per millimetre of the card. The border stays in mm. */
  pixelsPerMm: number;
};

/** What callers may pass: `pixelsPerMm` is optional and defaults to PIXELS_PER_MM. */
export type RenderInput = Omit<RenderOptions, 'pixelsPerMm'> & { pixelsPerMm?: number };

export type GrayImage = { width: number; height: number; pixels: Uint8Array };

export type GroundTruth = {
  profile: string;
  image: string;
  pickIndex: number;
  hookRows: number;
  hookColumns: number;
  endsPerPick: number;
  card: CardGrid;
  /** The card as an ends list: ends[endOrder[r][c]] is card[r][c]. */
  ends: Ends;
  options: RenderOptions;
};

export const PIXELS_PER_MM = 6;
export const BORDER_MM = 5;
export const SURFACE_LEVEL = 215;
export const HOLE_LEVEL = 20;
const BACKGROUND_LEVEL = 70;

export const DEFAULT_OPTIONS: RenderOptions = {
  noise: 0,
  tiltDegrees: 0,
  shade: 0,
  seed: 1,
  pixelsPerMm: PIXELS_PER_MM,
};

// ---------------------------------------------------------------- validation
/** Thrown when the profile or a card is invalid. Carries every violation. */
export class FixtureViolationError extends Error {
  violations: Violation[];
  constructor(violations: Violation[]) {
    super(formatViolations(violations));
    this.name = 'FixtureViolationError';
    this.violations = violations;
  }
}
export function formatViolations(violations: Violation[]): string {
  return violations.map((v) => `  [${v.kind}] ${v.location}: ${v.message}`).join('\n');
}
/** Returns the profile if parseCardProfile accepts it; otherwise throws with every violation. */
export function requireValidProfile(profile: unknown): CardProfile {
  const parsed = parseCardProfile(profile);
  if (!parsed.ok) throw new FixtureViolationError(parsed.violations);
  return parsed.value;
}

export function assertCardMatchesProfile(profile: CardProfile, card: CardGrid): void {
  if (card.length !== profile.hookRows) {
    throw new Error(`Card has ${card.length} hook rows, profile expects ${profile.hookRows}`);
  }
  card.forEach((hookRow, hookRowIndex) => {
    if (hookRow.length !== profile.hookColumns) {
      throw new Error(
        `Hook row ${hookRowIndex} has ${hookRow.length} hook columns, profile expects ${profile.hookColumns}`,
      );
    }
  });
}

// --------------------------------------------------------------- randomness

function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

// ---------------------------------------------------------------- rendering

function insideHole(x: number, y: number, centre: PointMm, diameterMm: number): boolean {
  const dx = x - centre.x;
  const dy = y - centre.y;
  return dx * dx + dy * dy <= (diameterMm / 2) ** 2;
}

/** Grey level at a point given in card coordinates (mm from top-left). */
function sampleCard(profile: CardProfile, card: CardGrid, x: number, y: number): number {
  if (x < 0 || y < 0 || x > profile.cardWidthMm || y > profile.cardHeightMm) {
    return BACKGROUND_LEVEL;
  }
  const hookColumnIndex = Math.round((x - profile.firstHoleCentreMm.x) / profile.horizontalPitchMm);
  const hookRowIndex = Math.round((y - profile.firstHoleCentreMm.y) / profile.verticalPitchMm);
  if (
    hookColumnIndex >= 0 &&
    hookColumnIndex < profile.hookColumns &&
    hookRowIndex >= 0 &&
    hookRowIndex < profile.hookRows
  ) {
    const centre = {
      x: profile.firstHoleCentreMm.x + hookColumnIndex * profile.horizontalPitchMm,
      y: profile.firstHoleCentreMm.y + hookRowIndex * profile.verticalPitchMm,
    };
    if (card[hookRowIndex]![hookColumnIndex] && insideHole(x, y, centre, profile.holeDiameterMm)) {
      return HOLE_LEVEL;
    }
  }
  for (const pegHole of profile.pegHoles) {
    if (insideHole(x, y, pegHole.positionMm, pegHole.diameterMm)) return HOLE_LEVEL;
  }
  for (const centre of profile.lacingHoles.positionsMm) {
    if (insideHole(x, y, centre, profile.lacingHoles.diameterMm)) return HOLE_LEVEL;
  }
  return SURFACE_LEVEL;
}

/** Fills in the default `pixelsPerMm` and rejects a scale that is not a positive number. */
export function resolveOptions(input: RenderInput): RenderOptions {
  const pixelsPerMm = input.pixelsPerMm ?? PIXELS_PER_MM;
  if (!Number.isFinite(pixelsPerMm) || pixelsPerMm <= 0) {
    throw new Error(`pixelsPerMm must be a positive number, got ${pixelsPerMm}`);
  }
  return { ...input, pixelsPerMm };
}

/** Renders ONE card (the hole grid of one pick). */
export function renderCard(
  profile: CardProfile,
  card: CardGrid,
  input: RenderInput = DEFAULT_OPTIONS,
): GrayImage {
  requireValidProfile(profile);
  assertCardMatchesProfile(profile, card);
  const options = resolveOptions(input);
  const pixelsPerMm = options.pixelsPerMm;

  const imageWidthMm = profile.cardWidthMm + 2 * BORDER_MM;
  const imageHeightMm = profile.cardHeightMm + 2 * BORDER_MM;
  const width = Math.ceil(imageWidthMm * pixelsPerMm);
  const height = Math.ceil(imageHeightMm * pixelsPerMm);
  const pixels = new Uint8Array(width * height);

  const rng = createRng(options.seed);
  const shadeAngle = rng() * 2 * Math.PI;
  const shadeCos = Math.cos(shadeAngle);
  const shadeSin = Math.sin(shadeAngle);

  const theta = (options.tiltDegrees * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const imageCentre = { x: imageWidthMm / 2, y: imageHeightMm / 2 };
  const cardCentre = { x: profile.cardWidthMm / 2, y: profile.cardHeightMm / 2 };
  const subSamples = [0.25, 0.75];

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      let sum = 0;
      for (const oy of subSamples) {
        for (const ox of subSamples) {
          const dx = (px + ox) / pixelsPerMm - imageCentre.x;
          const dy = (py + oy) / pixelsPerMm - imageCentre.y;
          // Inverse of a clockwise rotation by theta about the image centre.
          const cardX = cardCentre.x + cos * dx + sin * dy;
          const cardY = cardCentre.y - sin * dx + cos * dy;
          sum += sampleCard(profile, card, cardX, cardY);
        }
      }
      const base = sum / (subSamples.length * subSamples.length);
      const gradient = (px / width - 0.5) * shadeCos + (py / height - 0.5) * shadeSin;
      const lit = base * (1 + options.shade * gradient * 1.4);
      const noisy = lit + options.noise * gaussian(rng);
      pixels[py * width + px] = Math.max(0, Math.min(255, Math.round(noisy)));
    }
  }
  return { width, height, pixels };
}

// ------------------------------------------------------------- PNG encoding

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const byte of bytes) c = CRC_TABLE[(c ^ byte) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Buffer {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

/** Encodes an 8-bit greyscale PNG. Output is deterministic for the same input. */
export function encodePng(image: GrayImage): Buffer {
  const { width, height, pixels } = image;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 0; // colour type: greyscale
  const raw = Buffer.alloc((width + 1) * height); // filter byte 0 at each scanline start
  for (let y = 0; y < height; y++) {
    raw.set(pixels.subarray(y * width, (y + 1) * width), y * (width + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', new Uint8Array(0)),
  ]);
}

// ------------------------------------------------------------ file writing

/** The exact text of a ground-truth file. Pure, so tests can reuse it. */
export function groundTruthText(
  profile: CardProfile,
  card: CardGrid,
  imageName: string,
  input: RenderInput,
  pickIndex = 0,
): string {
  requireValidProfile(profile);
  const encoded = encodeCardGrid(profile, card);
  if (!encoded.ok) throw new FixtureViolationError(encoded.violations);
  const groundTruth: GroundTruth = {
    profile: profile.name,
    image: imageName,
    pickIndex,
    hookRows: profile.hookRows,
    hookColumns: profile.hookColumns,
    endsPerPick: profile.hookRows * profile.hookColumns,
    card,
    ends: encoded.value,
    options: resolveOptions(input),
  };
  return JSON.stringify(groundTruth, null, 2) + '\n';
}

export function writeFixture(
  profile: CardProfile,
  card: CardGrid,
  imagePath: string,
  options: RenderInput,
  pickIndex = 0,
): { imagePath: string; groundTruthPath: string } {
  const text = groundTruthText(profile, card, imagePath.split('/').pop()!, options, pickIndex);
  const png = encodePng(renderCard(profile, card, options));
  const groundTruthPath = imagePath.replace(/\.png$/i, '') + '.json';
  mkdirSync(dirname(imagePath), { recursive: true });
  writeFileSync(imagePath, png);
  writeFileSync(groundTruthPath, text);
  return { imagePath, groundTruthPath };
}

export const DEMO_PICK_COUNT = 3;

/**
 * A demo pattern: one card per pick, each a diagonal punched-hole run that
 * shifts by one hook column per pick. The top-right position is flipped on
 * every card so no card is symmetric.
 */
export function demoPattern(profile: CardProfile, pickCount = DEMO_PICK_COUNT): Pattern {
  const pattern: Pattern = [];
  for (let pickIndex = 0; pickIndex < pickCount; pickIndex++) {
    const card: CardGrid = [];
    for (let hookRowIndex = 0; hookRowIndex < profile.hookRows; hookRowIndex++) {
      const hookRow: boolean[] = [];
      for (let hookColumnIndex = 0; hookColumnIndex < profile.hookColumns; hookColumnIndex++) {
        hookRow.push((hookColumnIndex + 2 * hookRowIndex + pickIndex) % 3 === 0);
      }
      card.push(hookRow);
    }
    card[0]![profile.hookColumns - 1] = !card[0]![profile.hookColumns - 1];
    pattern.push(card);
  }
  return pattern;
}

/** Four conditions on pick 0, plus a clean card for each other demo pick. */
export const FIXTURE_SET: ReadonlyArray<{ name: string; pickIndex: number; options: RenderOptions }> = [
  { name: 'pick0-clean', pickIndex: 0, options: { noise: 0, tiltDegrees: 0, shade: 0, seed: 1234, pixelsPerMm: 6 } },
  { name: 'pick0-noisy', pickIndex: 0, options: { noise: 18, tiltDegrees: 0, shade: 0.25, seed: 1234, pixelsPerMm: 6 } },
  { name: 'pick0-tilted', pickIndex: 0, options: { noise: 0, tiltDegrees: 7, shade: 0, seed: 1234, pixelsPerMm: 6 } },
  { name: 'pick0-noisy-tilted', pickIndex: 0, options: { noise: 18, tiltDegrees: -6, shade: 0.25, seed: 1234, pixelsPerMm: 6 } },
  { name: 'pick1-clean', pickIndex: 1, options: { noise: 0, tiltDegrees: 0, shade: 0, seed: 1234, pixelsPerMm: 6 } },
  { name: 'pick2-clean', pickIndex: 2, options: { noise: 0, tiltDegrees: 0, shade: 0, seed: 1234, pixelsPerMm: 6 } },
];

// ---------------------------------------------------------------------- CLI

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (!arg.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args.set(arg.slice(2), 'true');
    } else {
      args.set(arg.slice(2), next);
      i++;
    }
  }
  return args;
}

function run(): void {
  const repoRoot = fileURLToPath(new URL('..', import.meta.url));
  const args = parseArgs(process.argv.slice(2));
  const profilePath = resolve(args.get('profile') ?? join(repoRoot, 'public/profiles/demo-12x16.json'));
  const profile = requireValidProfile(JSON.parse(readFileSync(profilePath, 'utf8')));

  if (args.has('all')) {
    const outDir = resolve(args.get('out-dir') ?? join(repoRoot, 'tests/fixtures'));
    const pattern = demoPattern(profile);
    for (const { name, pickIndex, options } of FIXTURE_SET) {
      const result = writeFixture(profile, pattern[pickIndex]!, join(outDir, `${name}.png`), options, pickIndex);
      console.log(`wrote ${result.imagePath} and ${result.groundTruthPath}`);
    }
    return;
  }

  const cardPath = args.get('card');
  const outPath = args.get('out');
  if (!cardPath || !outPath) {
    console.error(
      'Usage: make_fixtures.ts --all | --profile <file> --card <file> --out <file.png> [--noise N] [--tilt DEG] [--shade S] [--seed N] [--pixels-per-mm N] [--pick-index N]',
    );
    process.exit(1);
  }
  const card = JSON.parse(readFileSync(resolve(cardPath), 'utf8')) as CardGrid;
  const options: RenderOptions = {
    noise: Number(args.get('noise') ?? DEFAULT_OPTIONS.noise),
    tiltDegrees: Number(args.get('tilt') ?? DEFAULT_OPTIONS.tiltDegrees),
    shade: Number(args.get('shade') ?? DEFAULT_OPTIONS.shade),
    seed: Number(args.get('seed') ?? DEFAULT_OPTIONS.seed),
    pixelsPerMm: Number(args.get('pixels-per-mm') ?? DEFAULT_OPTIONS.pixelsPerMm),
  };
  const result = writeFixture(profile, card, resolve(outPath), options, Number(args.get('pick-index') ?? 0));
  console.log(`wrote ${result.imagePath} and ${result.groundTruthPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    run();
  } catch (error) {
    if (error instanceof FixtureViolationError) {
      console.error(`Invalid input, nothing rendered:\n${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}
