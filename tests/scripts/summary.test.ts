import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  commandStep,
  exitCodeFor,
  formatStepReport,
  formatSummary,
  parseArgs,
  runSteps,
} from '../../scripts/checks/summary.ts';
import type { CommandRunner, Outcome, Status, Step, StepResult } from '../../scripts/checks/summary.ts';

const SEED = 20240612;
const NUM_RUNS = 200;

const statusArb = fc.constantFrom<Status>('PASS', 'FAIL', 'SKIPPED', 'INFO');
const word = fc.stringMatching(/^[a-z][a-z ]{0,15}$/);

/** Steps with unique names and a fixed status each, so a run can be checked by name. */
const stepsArb = fc
  .array(statusArb, { maxLength: 15 })
  .map((statuses) => statuses.map((status, index): Step => ({ name: `step-${index}`, run: () => ({ status, detail: `detail ${index}` }) })));

describe('check:all arguments', () => {
  it('parses --bail, --help and unknown arguments', () => {
    expect(parseArgs([])).toEqual({ bail: false, help: false, unknown: [] });
    expect(parseArgs(['--bail'])).toEqual({ bail: true, help: false, unknown: [] });
    expect(parseArgs(['--help', '--nope'])).toEqual({ bail: false, help: true, unknown: ['--nope'] });
  });
});

describe('command step', () => {
  const fake = (status: number | null, output: string): CommandRunner => () => ({ status, output });

  it('passes on status 0, fails with the exact output otherwise', () => {
    expect(commandStep('typecheck', 'npm', ['run', 'typecheck'], fake(0, 'fine')).run().status).toBe('PASS');
    const failed = commandStep('typecheck', 'npm', ['run', 'typecheck'], fake(2, 'error TS1\nline 2\n')).run();
    expect(failed).toMatchObject({ status: 'FAIL', output: 'error TS1\nline 2\n' });
    expect(failed.detail).toContain('status 2');
    expect(commandStep('x', 'nope', [], fake(null, '')).run().detail).toContain('could not run');
  });

  it('passes the command and arguments to the runner', () => {
    const calls: string[][] = [];
    const runner: CommandRunner = (command, args) => {
      calls.push([command, ...args]);
      return { status: 0, output: '' };
    };
    commandStep('build', 'npm', ['run', 'build'], runner).run();
    expect(calls).toEqual([['npm', 'run', 'build']]);
  });
});

describe('step runner and summary', () => {
  it('R16.7 without --bail every step runs and the table has one row per step', () => {
    fc.assert(
      fc.property(stepsArb, (steps) => {
        const results = runSteps(steps, { bail: false });
        expect(results.map((result) => result.name)).toEqual(steps.map((step) => step.name));
        const tableRows = formatSummary(results).split('\n').filter((line) => line.startsWith('|'));
        expect(tableRows.length - 2).toBe(steps.length);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R16.7 the exit code is non-zero exactly when a step failed', () => {
    fc.assert(
      fc.property(fc.array(statusArb, { maxLength: 15 }), (statuses) => {
        const results: StepResult[] = statuses.map((status, index) => ({ name: `s${index}`, status, detail: 'd' }));
        expect(exitCodeFor(results) !== 0).toBe(statuses.includes('FAIL'));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R16.7 with --bail nothing after the first failure runs or appears in the output', () => {
    fc.assert(
      fc.property(stepsArb, (steps) => {
        const ran: string[] = [];
        const tracked = steps.map((step): Step => ({ name: step.name, run: () => (ran.push(step.name), step.run()) }));
        const printed: string[] = [];
        const results = runSteps(tracked, { bail: true }, (result) => printed.push(formatStepReport(result)));
        const firstFail = steps.findIndex((step) => step.run().status === 'FAIL');
        const expectedCount = firstFail === -1 ? steps.length : firstFail + 1;
        expect(ran).toEqual(steps.slice(0, expectedCount).map((step) => step.name));
        const text = `${printed.join('\n')}\n${formatSummary(results)}`;
        for (const later of steps.slice(expectedCount)) expect(text.includes(`${later.name}:`) || text.includes(`| ${later.name} |`)).toBe(false);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('SKIPPED and INFO do not make the exit code non-zero', () => {
    const results: StepResult[] = [
      { name: 'a', status: 'SKIPPED', detail: 'why' },
      { name: 'b', status: 'INFO', detail: 'dirty' },
      { name: 'c', status: 'PASS', detail: '' },
    ];
    expect(exitCodeFor(results)).toBe(0);
    expect(exitCodeFor([...results, { name: 'd', status: 'FAIL', detail: '' }])).toBe(1);
  });

  it('a failed step prints its exact output and a summary lists each status', () => {
    const failed: StepResult = { name: 'build', status: 'FAIL', detail: 'exit 1', output: 'boom\nat line 3\n' };
    expect(formatStepReport(failed)).toContain('boom\nat line 3');
    const skipped: Outcome = { status: 'SKIPPED', detail: 'no spec format validator command in the repo' };
    const summary = formatSummary([failed, { name: 'spec', ...skipped }]);
    expect(summary).toContain('| build | FAIL | exit 1 |');
    expect(summary).toContain('| spec | SKIPPED | no spec format validator command in the repo |');
    expect(summary).toContain('FAIL 1');
  });

  it('R16.7 table cells stay on one row for any name and detail text', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(word, fc.string(), statusArb), { maxLength: 8 }), (rows) => {
        const results = rows.map(([name, detail, status]): StepResult => ({ name, detail, status }));
        const tableRows = formatSummary(results).split('\n').filter((line) => line.startsWith('|'));
        expect(tableRows.length - 2).toBe(rows.length);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
