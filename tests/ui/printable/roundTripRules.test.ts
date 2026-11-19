import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { stripComments } from '../../support/source.ts';

// The marker is built from pieces so that this file is not itself taken for a property test.
const PROPERTY_RUNNER = ['fc', 'assert'].join('.');
const ROOT = path.resolve(import.meta.dirname, '../../..');

function code(relative: string): string {
  return stripComments(readFileSync(path.join(ROOT, relative), 'utf8'), false);
}

function occurrences(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe('printable card round-trip tests keep their rules', () => {
  it('R21.16 the draw-then-read tests take the profile as a parameter, use fixed seeds and filter nothing out', () => {
    const raster = code('tests/ui/printable/raster.test.ts');
    const runs = occurrences(raster, PROPERTY_RUNNER);
    expect(runs, 'the round-trip properties were not found').toBeGreaterThanOrEqual(2);
    // Every property call has its own fixed seed and a run count.
    expect(raster.match(/seed:\s*\d+/g) ?? []).toHaveLength(runs);
    expect(raster.match(/numRuns:\s*\d+/g) ?? []).toHaveLength(runs);
    // The profile is generated (property) or supplied by the profile file (example), never written out in the test.
    expect(raster).toContain('cardProfileArbitrary');
    expect(raster).toContain('demoProfile()');
    expect(raster).toContain('cardGridArbitrary(profile)');
    // No narrowing of the generated grids and no skipping of a failing grid.
    expect(raster).not.toMatch(/\.filter\(|\bpre\(|\.skip\(|\.todo\(|\.only\(/);
    // The grid generator itself draws any boolean grid of the profile size.
    const profiles = code('tests/support/profiles.ts');
    const start = profiles.indexOf('export function cardGridArbitrary');
    expect(start).toBeGreaterThan(-1);
    const body = profiles.slice(start, profiles.indexOf('\n}\n', start));
    expect(body).toContain('fc.boolean()');
    expect(body).not.toMatch(/\.filter\(|\bpre\(/);
  });
});
