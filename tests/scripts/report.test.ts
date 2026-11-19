import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { exitCodeFor, formatResult, formatSummary, runBrowserSteps } from '../../scripts/checks/report.ts';
import type { BrowserResult, BrowserStep } from '../../scripts/checks/report.ts';

const SEED = 60304;
const NUM_RUNS = 100;

const ok = (name: string, detail = 'fine'): BrowserStep => ({ name, run: async () => detail });
const bad = (name: string, message: string): BrowserStep => ({
  name,
  run: async () => {
    throw new Error(message);
  },
});

describe('runBrowserSteps', () => {
  it('reports a failed step with its reason and carries on with the next one', async () => {
    const results = await runBrowserSteps([ok('one'), bad('two', 'no canvas'), ok('three')]);
    expect(results.map((r) => [r.number, r.status])).toEqual([[1, 'PASS'], [2, 'FAIL'], [3, 'PASS']]);
    expect(results[1]!.detail).toBe('no canvas');
    expect(exitCodeFor(results)).toBe(1);
  });

  it('turns a thrown non-Error into a reason, and a hook failure into a note on the result', async () => {
    const results = await runBrowserSteps(
      [{ name: 'odd', run: async () => Promise.reject('plain text') }, ok('two')],
      { after: async (result) => { if (result.number === 2) throw new Error('screenshot failed'); } },
    );
    expect(results[0]).toMatchObject({ status: 'FAIL', detail: 'plain text' });
    expect(results[1]!.status).toBe('PASS');
    expect(results[1]!.detail).toContain('after-step hook failed: screenshot failed');
  });

  it('formats one line per result, with extra lines indented, and a summary that counts', () => {
    const results: BrowserResult[] = [
      { number: 1, name: 'load', status: 'PASS', detail: 'title ok' },
      { number: 2, name: 'export', status: 'FAIL', detail: 'width is 3, expected 4\nheight is 1, expected 2' },
    ];
    expect(formatResult(results[0]!)).toBe('PASS   1. load: title ok');
    expect(formatResult(results[1]!)).toBe('FAIL   2. export: width is 3, expected 4\n        height is 1, expected 2');
    expect(formatSummary(results)).toContain('1 passed, 1 failed');
    expect(exitCodeFor([])).toBe(1);
    expect(exitCodeFor([results[0]!])).toBe(0);
  });

  it('R23.1 every step runs once and in order, and the exit code is non-zero exactly when a step failed', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.boolean(), { minLength: 1, maxLength: 14 }), async (passes) => {
        const ran: number[] = [];
        const steps = passes.map((passed, index): BrowserStep => ({
          name: `step ${index}`,
          run: async () => {
            ran.push(index);
            if (!passed) throw new Error(`reason ${index}`);
            return `detail ${index}`;
          },
        }));
        const results = await runBrowserSteps(steps);
        expect(ran).toEqual(passes.map((_, index) => index));
        expect(results.map((r) => r.status === 'PASS')).toEqual(passes);
        expect(exitCodeFor(results) !== 0).toBe(passes.includes(false));
        const summary = formatSummary(results);
        expect(summary.split('\n').filter((line) => /^ {2}(PASS|FAIL) /.test(line))).toHaveLength(passes.length);
        results.forEach((r) => expect(formatResult(r)).toContain(r.detail.split('\n')[0]!));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
