/**
 * `npm run check:all [-- --bail]`: typecheck, the full test suite, build, bundle check,
 * spec format validators, then repo hygiene. Prints PASS, FAIL, SKIPPED or INFO per step,
 * the exact output of any failed step, and a summary table. Exit code is non-zero if a step failed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  checkKiroDirs,
  checkKiroNotIgnored,
  checkLicense,
  checkNoSecrets,
  checkReadmeNoComing,
  findSpecValidator,
  reportGitState,
} from './checks/hygiene.ts';
import type { RepoFacts } from './checks/hygiene.ts';
import {
  commandStep,
  exitCodeFor,
  formatStepReport,
  formatSummary,
  parseArgs,
  runSteps,
  USAGE,
} from './checks/summary.ts';
import type { CommandRunner, Step } from './checks/summary.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');

const runner: CommandRunner = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `\n${result.error.message}` : ''}`;
  return { status: result.status, output };
};

function git(args: string[]): { status: number | null; output: string } {
  return runner('git', args);
}

function readFacts(): RepoFacts {
  return {
    exists: (relative) => existsSync(path.join(repoRoot, relative)),
    readText: (relative) => {
      try {
        return readFileSync(path.join(repoRoot, relative), 'utf8');
      } catch {
        return null;
      }
    },
    trackedFiles: git(['ls-files', '-z']).output.split('\0').filter((file) => file.length > 0),
    // `git check-ignore -q` exits 0 when the path is ignored and 1 when it is not.
    isIgnored: (relative) => git(['check-ignore', '-q', relative]).status === 0,
    statusPorcelain: git(['status', '--porcelain']).output,
  };
}

function specValidatorStep(): Step {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')) as {
    scripts?: Record<string, string>;
  };
  const found = findSpecValidator(Object.keys(pkg.scripts ?? {}), readdirSync(path.join(repoRoot, 'scripts')));
  if (found === null) {
    return {
      name: 'spec format validators',
      run: () => ({ status: 'SKIPPED', detail: 'no spec format validator command in the repo' }),
    };
  }
  return commandStep('spec format validators', found.command, found.args, runner);
}

function main(): number {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.unknown.length > 0) {
    if (args.unknown.length > 0) console.error(`unknown argument(s): ${args.unknown.join(' ')}`);
    console.log(USAGE);
    return args.unknown.length > 0 ? 2 : 0;
  }
  // Facts are read when the first hygiene step runs, so that earlier steps do not wait on git.
  let facts: RepoFacts | null = null;
  const lazy = (): RepoFacts => (facts ??= readFacts());
  const steps: Step[] = [
    commandStep('typecheck', 'npm', ['run', 'typecheck'], runner),
    commandStep('test suite', 'npm', ['run', 'test:run'], runner),
    commandStep('build', 'npm', ['run', 'build'], runner),
    commandStep('bundle check', 'npm', ['run', 'check-bundle'], runner),
    specValidatorStep(),
    { name: 'hygiene: LICENSE', run: () => checkLicense(lazy()) },
    { name: 'hygiene: .kiro not ignored', run: () => checkKiroNotIgnored(lazy()) },
    { name: 'hygiene: .kiro directories', run: () => checkKiroDirs(lazy()) },
    { name: 'hygiene: no secrets', run: () => checkNoSecrets(lazy()) },
    { name: 'hygiene: README has no "coming"', run: () => checkReadmeNoComing(lazy()) },
    { name: 'hygiene: git working tree', run: () => reportGitState(lazy()) },
  ];
  const results = runSteps(steps, { bail: args.bail }, (result) => console.log(formatStepReport(result)));
  if (args.bail && results.length < steps.length) {
    console.log(`--bail: stopped after the first failure; ${steps.length - results.length} step(s) not run`);
  }
  console.log(`\n${formatSummary(results)}`);
  return exitCodeFor(results);
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === import.meta.filename) {
  process.exit(main());
}
