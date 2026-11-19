import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  describeSummary,
  formatHookLogLine,
  lastLines,
  parseHookLogLine,
  readHookNames,
  summarizeHooks,
} from '../../scripts/checks/hooksLog.ts';

const SEED = 72002;
const NUM_RUNS = 200;

// Names and results without tab or line break, which formatting would replace by a space.
const text = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !/[\t\r\n]/.test(s));
const isoAt = fc.date({ min: new Date('2000-01-01'), max: new Date('2100-01-01'), noInvalidDate: true }).map((d) => d.toISOString());
const entry = fc.record({ at: isoAt, hook: text, result: text });

describe('hooks log', () => {
  it('formats and parses one line', () => {
    const line = formatHookLogLine({ at: '2026-11-22T10:00:00.000Z', hook: 'My hook', result: 'exit 0' });
    expect(line).toBe('2026-11-22T10:00:00.000Z\tMy hook\texit 0');
    expect(parseHookLogLine(line)).toEqual({ ok: true, entry: { at: '2026-11-22T10:00:00.000Z', hook: 'My hook', result: 'exit 0' } });
  });

  it('reports malformed lines and counts only well-formed ones', () => {
    const good = '2026-11-22T10:00:00.000Z\tA\texit 0';
    const result = summarizeHooks(`${good}\nnot a line\n2026-13-99\tA\texit 0\n`, ['A', 'B']);
    expect(result.malformed).toEqual(['not a line', '2026-13-99\tA\texit 0']);
    expect(result.hooks).toEqual([
      { hook: 'A', count: 1, lastAt: '2026-11-22T10:00:00.000Z' },
      { hook: 'B', count: 0, lastAt: null },
    ]);
  });

  it('an empty or missing log says never fired', () => {
    const { hooks } = summarizeHooks('', ['A']);
    expect(describeSummary(hooks[0]!)).toBe('A: never fired (no log line)');
  });

  it('describes a fired hook with its count and last time', () => {
    expect(describeSummary({ hook: 'A', count: 2, lastAt: 'T' })).toBe('A: fired 2 times, last at T');
  });

  it('last lines: the last N in file order, blank lines skipped', () => {
    expect(lastLines('a\nb\n\nc\nd\n', 2)).toEqual(['c', 'd']);
    expect(lastLines('', 20)).toEqual([]);
  });

  it('reads hook names from a v1 hook file and rejects other text', () => {
    expect(readHookNames('{"version":"v1","hooks":[{"name":"X"},{"name":"Y"}]}')).toEqual({ ok: true, names: ['X', 'Y'] });
    expect(readHookNames('nope').ok).toBe(false);
    expect(readHookNames('{"hooks":[{}]}').ok).toBe(false);
  });

  it('R16.7 a formatted log line parses back to the same timestamp, hook name and result', () => {
    fc.assert(
      fc.property(entry, (e) => {
        expect(parseHookLogLine(formatHookLogLine(e))).toEqual({ ok: true, entry: e });
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R16.7 the count of a hook equals the number of log lines carrying its name', () => {
    fc.assert(
      fc.property(fc.array(entry, { maxLength: 30 }), fc.uniqueArray(text, { maxLength: 4 }), (entries, names) => {
        const log = entries.map((e) => `${formatHookLogLine(e)}\n`).join('');
        const { hooks, malformed } = summarizeHooks(log, names);
        expect(malformed).toEqual([]);
        for (const h of hooks) {
          const mine = entries.filter((e) => e.hook === h.hook);
          expect(h.count).toBe(mine.length);
          expect(h.lastAt).toBe(mine.length === 0 ? null : mine.map((e) => e.at).reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)));
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R16.7 malformed lines never throw, are reported and never counted as fired', () => {
    fc.assert(
      // Lines without a tab cannot have three fields, so every non-blank one is malformed.
      fc.property(fc.array(fc.string({ maxLength: 40 }).filter((s) => !/[\t\r\n]/.test(s)), { maxLength: 20 }), (lines) => {
        const { hooks, malformed } = summarizeHooks(lines.join('\n'), ['A', ...lines]);
        expect(malformed).toEqual(lines.filter((l) => l.trim() !== ''));
        expect(hooks.every((h) => h.count === 0 && h.lastAt === null)).toBe(true);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R16.7 last lines returns at most N lines, the last ones, in file order', () => {
    fc.assert(
      fc.property(fc.array(fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !/[\r\n]/.test(s) && s.trim() !== ''), { maxLength: 40 }), fc.integer({ min: 0, max: 30 }), (lines, n) => {
        const out = lastLines(lines.join('\n'), n);
        expect(out.length).toBeLessThanOrEqual(n);
        expect(out).toEqual(n === 0 ? [] : lines.slice(-n));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
