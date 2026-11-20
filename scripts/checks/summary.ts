/**
 * Pure parts of `npm run check:all` that deal with steps: result types, argument parsing,
 * the step runner (with `--bail`), the command step (over an injected runner) and the
 * summary table. No I/O here.
 */

export type Status = 'PASS' | 'FAIL' | 'SKIPPED' | 'INFO';

/** What a step reports. `output` is the exact output of a failed command, printed in full. */
export type Outcome = { status: Status; detail: string; output?: string };

export type StepResult = Outcome & { name: string };

export type Step = { name: string; run: () => Outcome };

/** Runs a command and returns its exit status (null if it could not start) and combined output. */
export type CommandRunner = (command: string, args: string[]) => { status: number | null; output: string };

export type CheckArgs = { bail: boolean; help: boolean; unknown: string[] };

export function parseArgs(argv: readonly string[]): CheckArgs {
  const args: CheckArgs = { bail: false, help: false, unknown: [] };
  for (const arg of argv) {
    if (arg === '--bail') args.bail = true;
    else if (arg === '--help' || arg === '-h') args.help = true;
    else args.unknown.push(arg);
  }
  return args;
}

export const USAGE = 'usage: npm run check:all [-- --bail]\n  --bail  stop at the first failed step (default: run every step)';

/** A step that runs one command; PASS on exit status 0, FAIL otherwise with the exact output. */
export function commandStep(name: string, command: string, args: string[], runner: CommandRunner): Step {
  const shown = [command, ...args].join(' ');
  return {
    name,
    run: () => {
      const { status, output } = runner(command, args);
      if (status === 0) return { status: 'PASS', detail: shown };
      return {
        status: 'FAIL',
        detail: status === null ? `${shown} could not run` : `${shown} exited with status ${status}`,
        output,
      };
    },
  };
}

/**
 * Runs the steps in order. Without `bail` every step runs. With `bail` the run stops after
 * the first FAIL and later steps are neither run nor reported.
 */
export function runSteps(
  steps: readonly Step[],
  options: { bail: boolean },
  onResult: (result: StepResult) => void = () => {},
): StepResult[] {
  const results: StepResult[] = [];
  for (const step of steps) {
    const result: StepResult = { name: step.name, ...step.run() };
    results.push(result);
    onResult(result);
    if (options.bail && result.status === 'FAIL') break;
  }
  return results;
}

/** Non-zero exactly when a step failed. SKIPPED and INFO never count as failures. */
export function exitCodeFor(results: readonly StepResult[]): number {
  return results.some((result) => result.status === 'FAIL') ? 1 : 0;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
}

/** The per-step report: a status line, then the exact output for a FAIL. */
export function formatStepReport(result: StepResult): string {
  const head = `${result.status.padEnd(7)} ${result.name}: ${oneLine(result.detail)}`;
  if (result.status === 'FAIL' && result.output !== undefined && result.output.length > 0) {
    return `${head}\n${result.output.replace(/\n$/, '')}\n--- end of output of "${result.name}" ---`;
  }
  return head;
}

/** A markdown-style table with a header, a separator and one table row per result, then a totals line. */
export function formatSummary(results: readonly StepResult[]): string {
  const lines = ['| Step | Status | Detail |', '|---|---|---|'];
  for (const result of results) {
    lines.push(`| ${oneLine(result.name)} | ${result.status} | ${oneLine(result.detail)} |`);
  }
  const count = (status: Status): number => results.filter((result) => result.status === status).length;
  lines.push(
    '',
    `PASS ${count('PASS')}, FAIL ${count('FAIL')}, SKIPPED ${count('SKIPPED')}, INFO ${count('INFO')}`,
  );
  return lines.join('\n');
}
