import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decideOffline, formatOffline, groupPasses, offlineConditions } from '../../scripts/checks/offline.ts';
import type { CheckStatus, OfflineCheck, OfflineGroup } from '../../scripts/checks/offline.ts';

const SEED = 13013;
const NUM_RUNS = 200;
const check = (status: CheckStatus, name = 'c'): OfflineCheck => ({ name, status, note: 'n' });
const group = (title: string, ...statuses: CheckStatus[]): OfflineGroup => ({ title, checks: statuses.map((s, i) => check(s, `c${i}`)) });

const status = fc.constantFrom<CheckStatus>('pass', 'fail', 'not-run');
const groupArb = fc.record({
  title: fc.string({ minLength: 1, maxLength: 8 }),
  checks: fc.array(status, { maxLength: 6 }).map((list) => list.map((s, i) => check(s, `c${i}`))),
});

describe('offlineConditions', () => {
  it('R13.1 offline true gives the offline flag with no latency and no throttling', () => {
    expect(offlineConditions(true)).toEqual({ offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  });
  it('R13.1 offline false gives the online flag', () => {
    expect(offlineConditions(false).offline).toBe(false);
  });
  it('R13.1 the offline flag is passed through and nothing else depends on it', () => {
    fc.assert(
      fc.property(fc.boolean(), (offline) => {
        const { offline: flag, ...rest } = offlineConditions(offline);
        expect(flag).toBe(offline);
        expect(rest).toEqual({ latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});

describe('decideOffline', () => {
  it('R13.1 every check passed in every group is a pass', () => {
    expect(decideOffline([group('reload', 'pass', 'pass'), group('no reload', 'pass')])).toEqual({ ok: true, notPassed: [] });
  });
  it('R13.1 a failed reload with its checks not run is a fail that names each one', () => {
    const verdict = decideOffline([group('reload', 'fail', 'not-run'), group('no reload', 'pass')]);
    expect(verdict.ok).toBe(false);
    expect(verdict.notPassed).toEqual(['reload: c0 (fail)', 'reload: c1 (not-run)']);
  });
  it('R13.1 no group at all, or a group with no check, is not a pass', () => {
    expect(decideOffline([]).ok).toBe(false);
    expect(decideOffline([group('reload')]).ok).toBe(false);
  });
  it('R13.1 the step passes exactly when there is a group and every check of every group passed', () => {
    fc.assert(
      fc.property(fc.array(groupArb, { maxLength: 4 }), (groups) => {
        const allPass = groups.length > 0 && groups.every((g) => g.checks.length > 0 && g.checks.every((c) => c.status === 'pass'));
        expect(decideOffline(groups).ok).toBe(allPass);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
  it('R13.1 one line per check that did not pass, and none for a check that passed', () => {
    fc.assert(
      fc.property(fc.array(groupArb, { maxLength: 4 }), (groups) => {
        const notPassedChecks = groups.flatMap((g) => g.checks).filter((c) => c.status !== 'pass').length;
        const emptyGroups = groups.filter((g) => g.checks.length === 0).length;
        expect(decideOffline(groups).notPassed).toHaveLength(notPassedChecks + emptyGroups);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
  it('R13.1 changing one passing check to not-run or fail can never turn a failing step into a pass', () => {
    fc.assert(
      fc.property(fc.array(groupArb, { minLength: 1, maxLength: 4 }), fc.constantFrom<CheckStatus>('fail', 'not-run'), (groups, worse) => {
        const before = decideOffline(groups).ok;
        const worsened = groups.map((g, gi) => (gi === 0 ? { ...g, checks: g.checks.map((c, ci) => (ci === 0 ? { ...c, status: worse } : c)) } : g));
        if (!before) expect(decideOffline(worsened).ok).toBe(false);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});

describe('formatOffline', () => {
  it('R13.1 prints the group status and one line per check, with not-run shown as NOT RUN', () => {
    const text = formatOffline([group('reload', 'pass', 'not-run')]);
    expect(text).toBe('FAIL reload\n  PASS c0: n\n  NOT RUN c1: n');
  });
  it('R13.1 a group is printed as PASS exactly when groupPasses says so', () => {
    fc.assert(
      fc.property(groupArb, (g) => {
        expect(formatOffline([g]).startsWith(`${groupPasses(g) ? 'PASS' : 'FAIL'} ${g.title}`)).toBe(true);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
