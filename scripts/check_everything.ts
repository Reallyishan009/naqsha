/**
 * `npm run check:everything [-- --manual] [--bail] [--url <url>]`: runs check:all, check:browser and
 * check:deployed in that order, and check:manual only with `--manual`. Every stage runs even if an
 * earlier one failed, unless `--bail`. Prints a summary of PASS, FAIL or SKIPPED with each exit code;
 * the exit code is non-zero if any stage failed. The logic is in scripts/checks/everything.ts.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  exitCodeFor,
  formatSummary,
  parseArgs,
  planStages,
  runStages,
  USAGE,
} from './checks/everything.ts';
import type { StageRunner } from './checks/everything.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');

const runner: StageRunner = (command, args, { interactive }) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    // check:manual asks a person questions, so it gets the terminal. The others are captured, then printed.
    stdio: interactive ? 'inherit' : ['inherit', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`;
  return { status: result.status, output };
};

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (!args.ok) {
    console.error(`check:everything: ${args.message}`);
    console.log(USAGE);
    return 2;
  }
  if (args.help) {
    console.log(USAGE);
    return 0;
  }
  const stages = planStages({ manual: args.manual, url: args.url });
  const results = runStages(stages, { bail: args.bail }, runner, (result) => {
    if (result.output.length > 0 && result.id !== 'manual') console.log(result.output.replace(/\n$/, ''));
    console.log(`\n=== ${result.id}: ${result.status}${result.exitCode === null ? '' : ` (exit ${result.exitCode})`} ===\n`);
  });
  if (!args.manual) console.log('check:manual was not run (add --manual to include it)');
  console.log(`\n${formatSummary(results)}`);
  return exitCodeFor(results);
}

process.exitCode = main();
