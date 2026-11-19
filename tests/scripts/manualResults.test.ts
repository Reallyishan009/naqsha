import { PassThrough } from 'node:stream';
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  RESULTS_HEADER,
  appendResult,
  createLineReader,
  formatDate,
  formatEntry,
  parseAnswer,
  parseArgs,
  runWalkthrough,
  summarise,
  textToAppend,
} from '../../scripts/checks/manualResults.ts';
import type { ResultEntry } from '../../scripts/checks/manualResults.ts';
import { MANUAL_STEPS } from '../../scripts/checks/manualSteps.ts';
import type { ManualStep } from '../../scripts/checks/manualSteps.ts';

const SEED = 60652;
const NUM_RUNS = 100;

const WORDS = ['pass', 'p', 'fail', 'f', 'skip', 's'] as const;
const EXPECTED = { pass: 'pass', p: 'pass', fail: 'fail', f: 'fail', skip: 'skip', s: 'skip' } as const;

const anyCase = (word: string): fc.Arbitrary<string> =>
  fc.array(fc.boolean(), { minLength: word.length, maxLength: word.length }).map((flags) =>
    [...word].map((ch, i) => (flags[i] ? ch.toUpperCase() : ch)).join(''),
  );
const padding = fc.stringMatching(/^[ \t]{0,4}$/);

const entryArb: fc.Arbitrary<ResultEntry> = fc.record({
  date: fc.constantFrom('2026-11-21', '2027-01-02'),
  stepId: fc.constantFrom(...MANUAL_STEPS.map((s) => s.id)),
  answer: fc.constantFrom('pass', 'fail', 'skip'),
  note: fc.string(),
});

const FAKE_STEPS: readonly ManualStep[] = [
  { id: 'one', title: 'First', instructions: 'Do one.', expected: 'One done.', failMeans: 'One broke.' },
  { id: 'two', title: 'Second', instructions: 'Do two.', expected: 'Two done.', failMeans: 'Two broke.' },
];

/** Feeds the given lines; the walkthrough output is collected in `text`. */
function fakeRun(lines: readonly string[], steps: readonly ManualStep[] = FAKE_STEPS) {
  const input = new PassThrough();
  input.end(lines.map((l) => `${l}\n`).join(''));
  const reader = createLineReader(input);
  const recorded: ResultEntry[] = [];
  let text = '';
  const done = runWalkthrough(steps, {
    readLine: reader.readLine,
    output: { write: (chunk: string | Uint8Array) => ((text += String(chunk)), true) },
    record: (entry) => recorded.push(entry),
    today: () => '2026-11-21',
    notes: { two: 'EXTRA NOTE' },
  }).finally(() => reader.close());
  return { done, recorded, text: () => text };
}

describe('parseAnswer', () => {
  it('accepts p, pass, f, fail, s and skip', () => {
    for (const word of WORDS) expect(parseAnswer(word)).toBe(EXPECTED[word]);
  });

  it('rejects anything else, including empty text and look-alikes', () => {
    for (const text of ['', ' ', 'y', 'yes', 'passed', 'ps', 'no', 'skipp', '1']) expect(parseAnswer(text)).toBeNull();
  });

  it('R23.1 accepts exactly pass/fail/skip and p/f/s in any letter case with surrounding spaces', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...WORDS).chain((word) => fc.tuple(fc.constant(word), anyCase(word), padding, padding)),
        ([word, cased, left, right]) => {
          expect(parseAnswer(`${left}${cased}${right}`)).toBe(EXPECTED[word]);
        },
      ),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('R23.1 rejects every other text', () => {
    fc.assert(
      fc.property(fc.string(), (text) => {
        const known = (WORDS as readonly string[]).includes(text.trim().toLowerCase());
        fc.pre(!known);
        expect(parseAnswer(text)).toBeNull();
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});

describe('results text', () => {
  it('a new file gets the header and then the first answer', () => {
    const entry: ResultEntry = { date: '2026-11-21', stepId: 'rise', answer: 'pass', note: '' };
    const text = appendResult(null, entry);
    expect(text.startsWith(RESULTS_HEADER)).toBe(true);
    expect(text.endsWith('| 2026-11-21 | rise | pass |  |\n')).toBe(true);
    expect(appendResult('', entry)).toBe(text);
  });

  it('a note is put on one line and "|" is escaped', () => {
    const line = formatEntry({ date: '2026-11-21', stepId: 'R8.8', answer: 'fail', note: 'a|b\nc\r\n d' });
    expect(line).toBe('| 2026-11-21 | R8.8 | fail | a\\|b c d |');
  });

  it('adds a newline first when the file does not end with one', () => {
    const entry: ResultEntry = { date: '2026-11-21', stepId: 'rise', answer: 'skip', note: 'later' };
    expect(textToAppend('old text', entry)).toBe('\n| 2026-11-21 | rise | skip | later |\n');
  });

  it('formatDate gives local year-month-day with two digits', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('R23.1 appending never removes earlier content: the old text is a prefix of the new text and every old line stays', () => {
    fc.assert(
      fc.property(fc.option(fc.string(), { nil: null }), fc.array(entryArb, { minLength: 1, maxLength: 5 }), (start, entries) => {
        let content = start;
        for (const entry of entries) {
          const next = appendResult(content, entry);
          const old = content ?? '';
          expect(next.startsWith(old)).toBe(true);
          expect(next.length).toBeGreaterThan(old.length);
          if (old !== '') {
            // every earlier line is unchanged
            const oldLines = old.split('\n');
            if (oldLines[oldLines.length - 1] === '') oldLines.pop(); // the empty piece after the last line end
            expect(next.split('\n').slice(0, oldLines.length)).toEqual(oldLines);
          }
          content = next;
        }
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });

  it('summarise counts the answers', () => {
    const e = (answer: ResultEntry['answer']): ResultEntry => ({ date: 'd', stepId: 's', answer, note: '' });
    expect(summarise([e('pass'), e('fail'), e('skip'), e('pass')])).toBe('pass 2, fail 1, skip 1');
  });
});

describe('parseArgs', () => {
  it('no arguments runs every step', () => {
    expect(parseArgs([])).toEqual({ ok: true, only: null });
  });

  it('--only takes a step id, with a space or an equals sign', () => {
    expect(parseArgs(['--only', 'R8.8'])).toEqual({ ok: true, only: 'R8.8' });
    expect(parseArgs(['--only=rise'])).toEqual({ ok: true, only: 'rise' });
  });

  it('rejects a missing value, an unknown id and an unknown flag', () => {
    expect(parseArgs(['--only']).ok).toBe(false);
    expect(parseArgs(['--only', 'nope']).ok).toBe(false);
    expect(parseArgs(['--all']).ok).toBe(false);
  });
});

describe('walkthrough with fake streams', () => {
  it('asks one step at a time, shows the instructions and records each answer with the date', async () => {
    const run = fakeRun(['pass', 'F', 'it broke']);
    const result = await run.done;
    expect(result.ended).toBe(false);
    expect(run.recorded).toEqual([
      { date: '2026-11-21', stepId: 'one', answer: 'pass', note: '' },
      { date: '2026-11-21', stepId: 'two', answer: 'fail', note: 'it broke' },
    ]);
    const text = run.text();
    expect(text).toContain('Step 1 of 2: First');
    expect(text).toContain('Do one.');
    expect(text).toContain('One broke.');
    expect(text.indexOf('Do two.')).toBeGreaterThan(text.indexOf('Do one.'));
    expect(text).toContain('EXTRA NOTE');
  });

  it('asks again on text that is not an answer, and asks no note after pass', async () => {
    const run = fakeRun(['maybe', '', ' SKIP ', 'later', 'p']);
    await run.done;
    expect(run.recorded.map((e) => [e.stepId, e.answer, e.note])).toEqual([
      ['one', 'skip', 'later'],
      ['two', 'pass', ''],
    ]);
    expect(run.text()).toContain('"maybe" is not an answer.');
  });

  it('stops without hanging when the input ends, keeping the answers already given', async () => {
    const run = fakeRun(['pass']);
    const result = await run.done;
    expect(result.ended).toBe(true);
    expect(run.recorded).toHaveLength(1);
  });

  it('keeps a skip when the input ends while the note is asked', async () => {
    const run = fakeRun(['skip']);
    const result = await run.done;
    expect(result.ended).toBe(true);
    expect(run.recorded).toEqual([{ date: '2026-11-21', stepId: 'one', answer: 'skip', note: '' }]);
  });

  it('R23.1 records one entry per step for any sequence of valid answers', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(fc.constantFrom('p', 'f', 's', 'PASS', ' Fail ', 'sKiP'), { minLength: 2, maxLength: 2 }), async (answers) => {
        const lines = answers.flatMap((a) => (parseAnswer(a) === 'pass' ? [a] : [a, '']));
        const run = fakeRun(lines);
        const result = await run.done;
        expect(result.ended).toBe(false);
        expect(run.recorded.map((e) => e.answer)).toEqual(answers.map((a) => parseAnswer(a)));
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});
