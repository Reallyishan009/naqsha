/**
 * Renders the sample cloth image media/sample-cloth.png: 48 picks of the demo
 * pattern, woven with one plain weft and one gold zari weft.
 *
 * Usage (Node 22.18+ runs .ts directly):
 *   node scripts/render_sample.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseCardProfile } from '../src/codec/index.ts';
import { parseRenderSettings, prepareCloth, renderFrame } from '../src/simulator/index.ts';
import { demoPattern } from './make_fixtures.ts';
import { encodePngRgba } from './png_rgba.ts';

export const SAMPLE_PICK_COUNT = 48;
export const SAMPLE_THREAD_SIZE_PX = 6;
/** 192 ends * 6 px = the full base width. */
export const SAMPLE_VIEWPORT = { width: 1152, height: 324 };

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** Renders the sample cloth and returns the PNG bytes. Pure apart from reading the demo profile. */
export function renderSampleCloth(): Buffer {
  const profileJson: unknown = JSON.parse(readFileSync(join(repoRoot, 'public/profiles/demo-12x16.json'), 'utf8'));
  const parsedProfile = parseCardProfile(profileJson);
  if (!parsedProfile.ok) throw new Error(`demo profile is invalid: ${JSON.stringify(parsedProfile.violations)}`);
  const profile = parsedProfile.value;

  const cloth = prepareCloth(profile, demoPattern(profile, SAMPLE_PICK_COUNT));
  if (!cloth.ok) throw new Error(`prepareCloth failed: ${JSON.stringify(cloth.failure)}`);

  const settings = parseRenderSettings({
    warpColour: '#f4ecd8',
    weftPlan: [
      { kind: 'plain', colour: '#7a1f2b' },
      { kind: 'zari', tone: 'gold' },
    ],
    threadSizePx: SAMPLE_THREAD_SIZE_PX,
    repeat: 1,
    viewport: SAMPLE_VIEWPORT,
    floatHighlight: null,
  });
  if (!settings.ok) throw new Error(`parseRenderSettings failed: ${JSON.stringify(settings.failure)}`);

  const image = renderFrame(cloth.value, settings.value, { pick: SAMPLE_PICK_COUNT, phase: 'rest' });
  if (!image.ok) throw new Error(`renderFrame failed: ${JSON.stringify(image.failure)}`);
  return encodePngRgba(image.value.width, image.value.height, image.value.data);
}

function run(): void {
  const outPath = resolve(join(repoRoot, 'media/sample-cloth.png'));
  const start = performance.now();
  const png = renderSampleCloth();
  const elapsedMs = performance.now() - start;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, png);
  console.log(
    `wrote ${outPath} (${SAMPLE_VIEWPORT.width} x ${SAMPLE_VIEWPORT.height} px, ${png.length} bytes, rendered in ${elapsedMs.toFixed(1)} ms)`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  run();
}
