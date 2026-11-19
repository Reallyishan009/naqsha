/**
 * `npm run check:manual [-- --only <id>]`: an interactive walkthrough of the checks that need a
 * person, a phone or a real browser. Each answer is appended, with the date, to
 * docs/MANUAL_TEST_RESULTS.md. Exit code 0 when no step was answered "fail" and the walkthrough
 * finished, 1 on a fail or a usage error, 2 when stdin is not a terminal.
 * The logic is in scripts/checks/manualResults.ts and the steps in scripts/checks/manualSteps.ts.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  DEPLOYED_CAVEAT,
  RESULTS_FILE,
  createLineReader,
  formatDate,
  parseArgs,
  runWalkthrough,
  summarise,
  textToAppend,
} from './checks/manualResults.ts';
import type { ResultEntry } from './checks/manualResults.ts';
import { MANUAL_STEPS, findStep } from './checks/manualSteps.ts';

const root = path.resolve(import.meta.dirname, '..');

function hindiNote(): string {
  try {
    const text = readFileSync(path.join(root, 'docs', 'HINDI_REVIEW.md'), 'utf8');
    const match = /^Unreviewed strings: (\d+)\s*$/m.exec(text);
    return match === null
      ? 'docs/HINDI_REVIEW.md has no "Unreviewed strings" line. Run `npm run review-list`.'
      : `Unreviewed strings: ${match[1]} (from docs/HINDI_REVIEW.md)`;
  } catch {
    return 'docs/HINDI_REVIEW.md could not be read. Run `npm run review-list`.';
  }
}

async function main(): Promise<number> {
  if (process.stdin.isTTY !== true) {
    console.error(
      'check:manual needs a person at a terminal. Standard input is not a terminal, so nothing was asked and nothing was written. Run `npm run check:manual` yourself in a terminal.',
    );
    return 2;
  }
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(`check:manual: ${args.message}`);
    return 1;
  }
  const steps = args.only === null ? MANUAL_STEPS : [findStep(args.only)!];

  console.log(DEPLOYED_CAVEAT);
  console.log(`Answers are appended to ${RESULTS_FILE}.`);

  const resultsPath = path.join(root, RESULTS_FILE);
  const record = (entry: ResultEntry): void => {
    const existing = existsSync(resultsPath) ? readFileSync(resultsPath, 'utf8') : null;
    appendFileSync(resultsPath, textToAppend(existing, entry));
  };

  const reader = createLineReader(process.stdin);
  const result = await runWalkthrough(steps, {
    readLine: reader.readLine,
    output: process.stdout,
    record,
    today: () => formatDate(new Date()),
    notes: { hindi: hindiNote() },
  });
  reader.close();

  console.log(`\n${result.answered.length} of ${steps.length} steps answered: ${summarise(result.answered)}.`);
  if (result.ended) console.log('The input ended before the last step. Answers so far are saved.');
  return result.answered.some((e) => e.answer === 'fail') ? 1 : 0;
}

process.exitCode = await main();
