import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { BUILD_LOG_STEP_IDS, MANUAL_STEPS, findStep } from '../../scripts/checks/manualSteps.ts';

const SEED = 60651;
const NUM_RUNS = 100;
const BUILD_LOG = readFileSync(path.resolve(import.meta.dirname, '..', '..', 'docs', 'BUILD_LOG.md'), 'utf8');

/** Bullets of the form "- **23.1 Title.** Steps..." in the build log, by id like "R23.1". */
function buildLogBullets(): Map<string, string[]> {
  const bullets = new Map<string, string[]>();
  for (const line of BUILD_LOG.split('\n')) {
    const match = /^- (\*\*(\d+\.\d+) .*)$/.exec(line);
    if (match === null) continue;
    const id = `R${match[2]}`;
    bullets.set(id, [...(bullets.get(id) ?? []), match[1] as string]);
  }
  return bullets;
}

describe('check:manual step list', () => {
  it('every step has an id, title, instructions, expected result and fail meaning', () => {
    for (const step of MANUAL_STEPS) {
      for (const field of [step.id, step.title, step.instructions, step.expected, step.failMeans]) {
        expect(field.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('step ids are unique, also without regard to letter case', () => {
    const ids = MANUAL_STEPS.map((step) => step.id.toLowerCase());
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('the walkthrough covers the eight common checks and the five build-log items', () => {
    const ids = MANUAL_STEPS.map((step) => step.id);
    for (const id of ['live-camera', 'print-100', 'card-photo', 'rise', 'focus-skip', 'reduced-motion', 'indexeddb', 'hindi']) {
      expect(ids).toContain(id);
    }
    for (const id of ['R8.8', 'R14.12', 'R16.5', 'R23.1', 'R23.11']) expect(ids).toContain(id);
  });

  it('the live camera step names the deployed URL and the denied and http cases', () => {
    const step = findStep('live-camera');
    expect(step?.instructions).toContain('https://naqsha-ashen.vercel.app/');
    expect(step?.instructions).toContain('The camera is blocked.');
    expect(step?.instructions).toContain('The camera needs a secure page (https).');
  });

  it('the print step states 60 x 45 mm at 100%', () => {
    const text = findStep('print-100')?.instructions ?? '';
    expect(text).toContain('100%');
    expect(text).toContain('60 mm by 45 mm');
  });

  it('R8.8, R14.12, R16.5, R23.1 and R23.11 exist and their text equals the BUILD_LOG entry', () => {
    const bullets = buildLogBullets();
    expect([...BUILD_LOG_STEP_IDS].sort()).toEqual(['R14.12', 'R16.5', 'R23.1', 'R23.11', 'R8.8']);
    for (const id of BUILD_LOG_STEP_IDS) {
      const inLog = bullets.get(id);
      expect(inLog, `${id} appears exactly once in docs/BUILD_LOG.md`).toHaveLength(1);
      expect(findStep(id)?.instructions).toBe(inLog?.[0]);
    }
  });

  it('R23.1 findStep finds every step by its id in any letter case', () => {
    fc.assert(
      fc.property(fc.constantFrom(...MANUAL_STEPS), fc.boolean(), (step, upper) => {
        const id = upper ? step.id.toUpperCase() : step.id.toLowerCase();
        expect(findStep(` ${id} `)).toBe(step);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R23.1 findStep returns nothing for an id that is not a step', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        fc.pre(!MANUAL_STEPS.some((step) => step.id.toLowerCase() === text.trim().toLowerCase()));
        expect(findStep(text)).toBeUndefined();
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
