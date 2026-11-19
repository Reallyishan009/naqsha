import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  exitCodeFor,
  formatSummary,
  parseArgs,
  planStages,
  runStages,
} from '../../scripts/checks/everything.ts';
import type { StageId, StageRunner } from '../../scripts/checks/everything.ts';

const SEED = 20240613;
const NUM_RUNS = 200;

const ORDER: StageId[] = ['all', 'browser', 'deployed', 'manual'];
const idOf = (args: string[]): StageId => args[1]!.replace('check:', '') as StageId;

/** A fake runner: the exit status of each stage is given; it records which stages ran. */
function fakeRunner(statuses: Record<StageId, number | null>, ran: StageId[]): StageRunner {
  return (_command, args) => {
    const id = idOf(args);
    ran.push(id);
    return { status: statuses[id], output: `output of ${id}\nlast line of ${id}` };
  };
}

const statusArb = fc.constantFrom<number | null>(0, 0, 1, 2, null);
const statusesArb = fc.record({ all: statusArb, browser: statusArb, deployed: statusArb, manual: statusArb });

describe('check:everything arguments', () => {
  it('R16.7 parses --manual, --bail, --url and rejects anything else', () => {
    expect(parseArgs([])).toEqual({ ok: true, bail: false, manual: false, url: null, help: false });
    expect(parseArgs(['--manual', '--bail', '--url', 'https://x.test/'])).toEqual({
      ok: true,
      bail: true,
      manual: true,
      url: 'https://x.test/',
      help: false,
    });
    expect(parseArgs(['--url=https://y.test/'])).toMatchObject({ ok: true, url: 'https://y.test/' });
    expect(parseArgs(['--url']).ok).toBe(false);
    expect(parseArgs(['--nope']).ok).toBe(false);
  });

  it('R16.7 passes an optional URL through to check:deployed', () => {
    const withUrl = planStages({ manual: false, url: 'https://x.test/' });
    expect(withUrl[2]!.args).toEqual(['run', 'check:deployed', '--', 'https://x.test/']);
    expect(planStages({ manual: false, url: null })[2]!.args).toEqual(['run', 'check:deployed']);
  });
});

describe('check:everything plan and run', () => {
  it('R16.7 the stages are all, browser, deployed in order, and manual is added exactly by --manual', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.option(fc.webUrl(), { nil: null }), (manual, url) => {
        const ids = planStages({ manual, url }).map((stage) => stage.id);
        expect(ids).toEqual(manual ? ORDER : ORDER.slice(0, 3));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R16.7 without --bail every planned stage runs in order, whatever fails', () => {
    fc.assert(
      fc.property(statusesArb, fc.boolean(), (statuses, manual) => {
        const ran: StageId[] = [];
        const planned = planStages({ manual, url: null });
        const results = runStages(planned, { bail: false }, fakeRunner(statuses, ran));
        expect(ran).toEqual(planned.map((stage) => stage.id));
        expect(results.map((result) => result.id)).toEqual(ran);
        expect(results.every((result) => result.status !== 'SKIPPED')).toBe(true);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R16.7 the overall exit code is non-zero if and only if some stage failed', () => {
    fc.assert(
      fc.property(statusesArb, fc.boolean(), fc.boolean(), (statuses, manual, bail) => {
        const planned = planStages({ manual, url: null });
        const results = runStages(planned, { bail }, fakeRunner(statuses, []));
        const someFailed = planned.some((stage) => statuses[stage.id] !== 0);
        expect(exitCodeFor(results) !== 0).toBe(someFailed);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R16.7 with --bail nothing runs after the first failure and the rest are SKIPPED', () => {
    fc.assert(
      fc.property(statusesArb, fc.boolean(), (statuses, manual) => {
        const ran: StageId[] = [];
        const planned = planStages({ manual, url: null });
        const results = runStages(planned, { bail: true }, fakeRunner(statuses, ran));
        const firstFail = planned.findIndex((stage) => statuses[stage.id] !== 0);
        const expectedRan = firstFail === -1 ? planned.length : firstFail + 1;
        expect(ran).toEqual(planned.slice(0, expectedRan).map((stage) => stage.id));
        expect(results.slice(expectedRan).every((result) => result.status === 'SKIPPED' && result.exitCode === null)).toBe(true);
        expect(results).toHaveLength(planned.length);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R16.7 a runner that throws (for example no Chrome) shows as FAIL with its message and later stages still run', () => {
    const ran: StageId[] = [];
    const runner: StageRunner = (_command, args) => {
      ran.push(idOf(args));
      if (idOf(args) === 'browser') throw new Error('No Chrome found. Set CHROME_PATH.');
      return { status: 0, output: '' };
    };
    const results = runStages(planStages({ manual: false, url: null }), { bail: false }, runner);
    expect(ran).toEqual(['all', 'browser', 'deployed']);
    expect(results[1]).toMatchObject({ status: 'FAIL', exitCode: null });
    expect(results[1]!.detail).toContain('No Chrome found. Set CHROME_PATH.');
    expect(exitCodeFor(results)).toBe(1);
  });

  it('R16.7 the summary has one row per stage with its result and exit code', () => {
    const results = runStages(
      planStages({ manual: false, url: null }),
      { bail: false },
      fakeRunner({ all: 0, browser: 3, deployed: 0, manual: 0 }, []),
    );
    const summary = formatSummary(results);
    expect(summary).toContain('| all | PASS | 0 |');
    expect(summary).toContain('| browser | FAIL | 3 | exit 3: last line of browser |');
    expect(summary).toContain('PASS 2, FAIL 1, SKIPPED 0');
  });
});
