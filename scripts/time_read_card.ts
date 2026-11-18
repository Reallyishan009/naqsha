/**
 * Times readCard on a synthetic 1920 x 1080 card image in Node (R16, tech.md budget: 300 ms on a
 * mid-range 2020 phone; the on-device number is a manual check).
 *
 * Usage (Node 22.18+ runs .ts directly):
 *   node scripts/time_read_card.ts [runs]
 */
import { existsSync, readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// src/reader imports its own files without an extension (the bundler resolves them). Node does not,
// so retry a failed relative import with `.ts`. Only this script needs the hook.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL !== undefined) {
      const candidate = new URL(`${specifier}.ts`, context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const { parseCardProfile } = await import('../src/codec/index.ts');
const { readCard } = await import('../src/reader/index.ts');
const { demoPattern, renderCard } = await import('./make_fixtures.ts');

const WIDTH_PX = 1920;
const HEIGHT_PX = 1080;
const BACKGROUND_LEVEL = 70;
const SEED = 1;
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

const profileJson: unknown = JSON.parse(readFileSync(join(repoRoot, 'public/profiles/demo-12x16.json'), 'utf8'));
const parsed = parseCardProfile(profileJson);
if (!parsed.ok) throw new Error(`demo profile is invalid: ${JSON.stringify(parsed.violations)}`);
const profile = parsed.value;
const card = demoPattern(profile)[0]!;

// Largest scale at which the card and its border fit the frame height, then pad to exactly 1920 x 1080.
const pixelsPerMm = (HEIGHT_PX - 2) / (profile.cardHeightMm + 10);
const grey = renderCard(profile, card, { noise: 2, tiltDegrees: 3, shade: 0.1, seed: SEED, pixelsPerMm });
if (grey.width > WIDTH_PX || grey.height > HEIGHT_PX) throw new Error('rendered card does not fit 1080p');
const data = new Uint8ClampedArray(WIDTH_PX * HEIGHT_PX * 4);
const offsetX = Math.floor((WIDTH_PX - grey.width) / 2);
const offsetY = Math.floor((HEIGHT_PX - grey.height) / 2);
for (let i = 0; i < WIDTH_PX * HEIGHT_PX; i++) {
  const value = BACKGROUND_LEVEL;
  data[i * 4] = value;
  data[i * 4 + 1] = value;
  data[i * 4 + 2] = value;
  data[i * 4 + 3] = 255;
}
for (let y = 0; y < grey.height; y++) {
  for (let x = 0; x < grey.width; x++) {
    const value = grey.pixels[y * grey.width + x]!;
    const at = ((y + offsetY) * WIDTH_PX + x + offsetX) * 4;
    data[at] = value;
    data[at + 1] = value;
    data[at + 2] = value;
  }
}
const pixels = { width: WIDTH_PX, height: HEIGHT_PX, data };

const runs = Number(process.argv[2] ?? 15);
const first = readCard(profile, pixels);
if (!first.ok) throw new Error(`readCard failed on the synthetic image: ${JSON.stringify(first.failure)}`);
const matches = first.grid.every((row, r) => row.every((cell, c) => cell === card[r]![c]));
if (!matches) throw new Error('readCard returned a grid that differs from the ground truth');

const samplesMs: number[] = [];
for (let run = 0; run < runs; run++) {
  const start = performance.now();
  readCard(profile, pixels);
  samplesMs.push(performance.now() - start);
}
const sorted = [...samplesMs].sort((a, b) => a - b);
const median = sorted.length % 2 === 1
  ? sorted[(sorted.length - 1) / 2]!
  : (sorted[sorted.length / 2 - 1]! + sorted[sorted.length / 2]!) / 2;
console.log(`image ${WIDTH_PX}x${HEIGHT_PX}, card at ${pixelsPerMm.toFixed(2)} px/mm, seed ${SEED}, ${runs} timed runs after one warm-up read`);
console.log(`node ${process.version}, ${process.platform} ${process.arch}`);
console.log(`readCard min ${sorted[0]!.toFixed(1)} ms, median ${median.toFixed(1)} ms, max ${sorted[sorted.length - 1]!.toFixed(1)} ms`);
console.log(`runs (ms): ${samplesMs.map((s) => s.toFixed(1)).join(', ')}`);
