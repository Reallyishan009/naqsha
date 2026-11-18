/**
 * Writes the sample bitmaps media/sample-design-1bit.bmp and media/sample-design-8bit.bmp:
 * 200 picks of the demo pattern, exported with default options.
 *
 * Usage (Node 22.18+ runs .ts directly):
 *   node scripts/export_sample.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parseCardProfile } from '../src/codec/index.ts';
import { exportPatternBmp } from '../src/exporter/index.ts';
import { demoPattern } from './demo_pattern.ts';

export const SAMPLE_BMP_PICK_COUNT = 200;

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

/** Exports the demo pattern in both bit depths. Pure apart from reading the demo profile. */
export function exportSampleDesigns(): { oneBit: Uint8Array; eightBit: Uint8Array } {
  const profileJson: unknown = JSON.parse(readFileSync(join(repoRoot, 'public/profiles/demo-12x16.json'), 'utf8'));
  const parsedProfile = parseCardProfile(profileJson);
  if (!parsedProfile.ok) throw new Error(`demo profile is invalid: ${JSON.stringify(parsedProfile.violations)}`);
  const profile = parsedProfile.value;
  const pattern = demoPattern(profile, SAMPLE_BMP_PICK_COUNT);

  const oneBit = exportPatternBmp(profile, pattern, { bitDepth: 1 });
  if (!oneBit.ok) throw new Error(`1-bit export failed: ${JSON.stringify(oneBit.failure)}`);
  const eightBit = exportPatternBmp(profile, pattern, { bitDepth: 8 });
  if (!eightBit.ok) throw new Error(`8-bit export failed: ${JSON.stringify(eightBit.failure)}`);
  return { oneBit: oneBit.bytes, eightBit: eightBit.bytes };
}

function run(): void {
  const { oneBit, eightBit } = exportSampleDesigns();
  const mediaDir = resolve(join(repoRoot, 'media'));
  mkdirSync(mediaDir, { recursive: true });
  for (const [name, bytes] of [
    ['sample-design-1bit.bmp', oneBit],
    ['sample-design-8bit.bmp', eightBit],
  ] as const) {
    writeFileSync(join(mediaDir, name), bytes);
    console.log(`wrote ${join(mediaDir, name)} (${bytes.length} bytes)`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
