/**
 * Pure parts of `npm run check:manual`: answer parsing, results formatting, the append-only
 * results text, argument parsing and the walkthrough loop. Input and output are injected.
 */
import readline from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { MANUAL_STEPS, findStep } from './manualSteps.ts';
import type { ManualStep } from './manualSteps.ts';

export const RESULTS_FILE = 'docs/MANUAL_TEST_RESULTS.md';

export const RESULTS_HEADER = [
  '# Manual test results',
  '',
  'Written by `npm run check:manual`. Each answer is appended with its date; earlier answers are never changed or removed.',
  '',
  '| Date | Step | Answer | Note |',
  '| --- | --- | --- | --- |',
  '',
].join('\n');

export const DEPLOYED_CAVEAT =
  'Deployed-site caveat: if `npm run check:deployed` shows a different asset hash than a local build, the deploy may be behind main: check the Vercel dashboard.';

export type Answer = 'pass' | 'fail' | 'skip';

export type ResultEntry = { date: string; stepId: string; answer: Answer; note: string };

/** Accepts pass, fail, skip, p, f, s in any letter case with surrounding whitespace. Anything else is null. */
export function parseAnswer(text: string): Answer | null {
  switch (text.trim().toLowerCase()) {
    case 'pass':
    case 'p':
      return 'pass';
    case 'fail':
    case 'f':
      return 'fail';
    case 'skip':
    case 's':
      return 'skip';
    default:
      return null;
  }
}

/** Local date as YYYY-MM-DD. */
export function formatDate(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** One line: the note is reduced to a single line and "|" is escaped so the table row stays whole. */
export function formatEntry(entry: ResultEntry): string {
  const note = entry.note.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
  return `| ${entry.date} | ${entry.stepId} | ${entry.answer} | ${note} |`;
}

/**
 * The text to add to the end of the file. `existing` is the current content, or null when the
 * file does not exist yet. The result never changes `existing`: it only adds to its end.
 */
export function textToAppend(existing: string | null, entry: ResultEntry): string {
  const line = `${formatEntry(entry)}\n`;
  if (existing === null || existing === '') return RESULTS_HEADER + line;
  return (existing.endsWith('\n') ? '' : '\n') + line;
}

export function appendResult(existing: string | null, entry: ResultEntry): string {
  return (existing ?? '') + textToAppend(existing, entry);
}

export type Args = { ok: true; only: string | null } | { ok: false; message: string };

export function parseArgs(argv: readonly string[]): Args {
  let only: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] as string;
    if (arg === '--only') {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) return { ok: false, message: '--only needs a step id' };
      only = value;
      i++;
    } else if (arg.startsWith('--only=')) {
      only = arg.slice('--only='.length);
    } else {
      return { ok: false, message: `unknown argument ${arg}` };
    }
  }
  if (only !== null && findStep(only) === undefined) {
    return { ok: false, message: `no step with id "${only}". Ids: ${MANUAL_STEPS.map((s) => s.id).join(', ')}` };
  }
  return { ok: true, only };
}

/** Reads one line at a time. Resolves to null when the input has ended. */
export type ReadLine = () => Promise<string | null>;

export function createLineReader(input: Readable): { readLine: ReadLine; close: () => void } {
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const lines = rl[Symbol.asyncIterator]();
  return {
    readLine: async () => {
      const next = await lines.next();
      return next.done === true ? null : next.value;
    },
    close: () => rl.close(),
  };
}

export type WalkthroughDeps = {
  readLine: ReadLine;
  output: Pick<Writable, 'write'>;
  /** Called after each answer, so progress is saved even if the person stops. */
  record: (entry: ResultEntry) => void;
  today: () => string;
  /** Extra text printed under a step, by step id. */
  notes?: Readonly<Record<string, string>>;
};

export type WalkthroughResult = { answered: ResultEntry[]; ended: boolean };

function printStep(step: ManualStep, index: number, total: number, deps: WalkthroughDeps): void {
  const out = deps.output;
  out.write(`\n=== Step ${index + 1} of ${total}: ${step.title} [${step.id}] ===\n\n`);
  out.write(`${step.instructions}\n\n`);
  const note = deps.notes?.[step.id];
  if (note !== undefined) out.write(`${note}\n\n`);
  out.write(`Expected: ${step.expected}\n`);
  out.write(`A fail means: ${step.failMeans}\n\n`);
}

/** Runs the steps in order. `ended` is true when the input closed before the last answer. */
export async function runWalkthrough(steps: readonly ManualStep[], deps: WalkthroughDeps): Promise<WalkthroughResult> {
  const answered: ResultEntry[] = [];
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i] as ManualStep;
    printStep(step, i, steps.length, deps);
    let answer: Answer | null = null;
    while (answer === null) {
      deps.output.write('Type pass, fail or skip (p, f, s): ');
      const line = await deps.readLine();
      if (line === null) return { answered, ended: true };
      answer = parseAnswer(line);
      if (answer === null) deps.output.write(`"${line.trim()}" is not an answer. `);
    }
    let note = '';
    if (answer !== 'pass') {
      deps.output.write('Short note (optional, press Enter for none): ');
      const noteLine = await deps.readLine();
      if (noteLine === null) {
        const entry: ResultEntry = { date: deps.today(), stepId: step.id, answer, note: '' };
        deps.record(entry);
        answered.push(entry);
        return { answered, ended: true };
      }
      note = noteLine;
    }
    const entry: ResultEntry = { date: deps.today(), stepId: step.id, answer, note };
    deps.record(entry);
    answered.push(entry);
  }
  deps.output.write('\nAll steps answered.\n');
  return { answered, ended: false };
}

export function summarise(entries: readonly ResultEntry[]): string {
  const count = (answer: Answer): number => entries.filter((e) => e.answer === answer).length;
  return `pass ${count('pass')}, fail ${count('fail')}, skip ${count('skip')}`;
}
