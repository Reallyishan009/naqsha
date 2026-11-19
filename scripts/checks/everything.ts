/**
 * Pure parts of `npm run check:everything`: argument parsing, the plan (which stages run for
 * which flags), the stage runner over an injected command runner, and the summary. No I/O here.
 */
export type StageId = 'all' | 'browser' | 'deployed' | 'manual';
export type StageStatus = 'PASS' | 'FAIL' | 'SKIPPED';
export type StageResult = {
  id: StageId;
  command: string;
  status: StageStatus;
  /** The exit code of the child process; null when it did not run or could not start. */
  exitCode: number | null;
  detail: string;
  output: string;
};
/** Runs one command as a child process. It may throw; the runner of stages turns that into a FAIL. */
export type StageRunner = (command: string, args: string[], options: { interactive: boolean }) => {
  status: number | null;
  output: string;
};
export type EverythingArgs =
  | { ok: true; bail: boolean; manual: boolean; url: string | null; help: boolean }
  | { ok: false; message: string };

export const USAGE =
  'usage: npm run check:everything [-- --manual] [--bail] [--url <url>]\n' +
  '  --manual     also run check:manual (needs a person at a terminal)\n' +
  '  --bail       stop after the first failed stage (default: run every stage)\n' +
  '  --url <url>  the address check:deployed checks (default: its own default URL)';

export function parseArgs(argv: readonly string[]): EverythingArgs {
  let bail = false;
  let manual = false;
  let help = false;
  let url: string | null = null;
  const args = argv.filter((arg) => arg !== '--');
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!;
    if (arg === '--bail') bail = true;
    else if (arg === '--manual') manual = true;
    else if (arg === '--help' || arg === '-h') help = true;
    else if (arg === '--url') {
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) return { ok: false, message: '--url needs a value' };
      url = value;
      index += 1;
    } else if (arg.startsWith('--url=')) {
      const value = arg.slice('--url='.length);
      if (value.length === 0) return { ok: false, message: '--url needs a value' };
      url = value;
    } else return { ok: false, message: `unknown argument: ${arg}` };
  }
  return { ok: true, bail, manual, url, help };
}

export type Stage = { id: StageId; command: string; args: string[]; interactive: boolean };

/** The stages in order: all, browser, deployed, then manual only when asked for. */
export function planStages(options: { manual: boolean; url: string | null }): Stage[] {
  const stages: Stage[] = [
    { id: 'all', command: 'npm', args: ['run', 'check:all'], interactive: false },
    { id: 'browser', command: 'npm', args: ['run', 'check:browser'], interactive: false },
    {
      id: 'deployed',
      command: 'npm',
      args: options.url === null ? ['run', 'check:deployed'] : ['run', 'check:deployed', '--', options.url],
      interactive: false,
    },
  ];
  if (options.manual) {
    stages.push({ id: 'manual', command: 'npm', args: ['run', 'check:manual'], interactive: true });
  }
  return stages;
}

const shown = (stage: Stage): string => [stage.command, ...stage.args].join(' ');

function lastLine(text: string): string {
  const lines = text.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);
  return lines[lines.length - 1] ?? '';
}

/**
 * Runs the stages in order. A runner that throws or cannot start is a FAIL with its message,
 * never a crash. With `bail`, stages after the first FAIL are reported SKIPPED and not run.
 */
export function runStages(
  stages: readonly Stage[],
  options: { bail: boolean },
  runner: StageRunner,
  onResult: (result: StageResult) => void = () => {},
): StageResult[] {
  const results: StageResult[] = [];
  let stopped = false;
  for (const stage of stages) {
    let result: StageResult;
    if (stopped) {
      result = {
        id: stage.id,
        command: shown(stage),
        status: 'SKIPPED',
        exitCode: null,
        detail: 'not run: --bail stopped after an earlier failure',
        output: '',
      };
    } else {
      try {
        const { status, output } = runner(stage.command, stage.args, { interactive: stage.interactive });
        if (status === 0) {
          result = { id: stage.id, command: shown(stage), status: 'PASS', exitCode: 0, detail: 'exit 0', output };
        } else {
          const message = lastLine(output);
          result = {
            id: stage.id,
            command: shown(stage),
            status: 'FAIL',
            exitCode: status,
            detail:
              status === null
                ? `could not run${message ? `: ${message}` : ''}`
                : `exit ${status}${message ? `: ${message}` : ''}`,
            output,
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result = {
          id: stage.id,
          command: shown(stage),
          status: 'FAIL',
          exitCode: null,
          detail: `could not run: ${message}`,
          output: message,
        };
      }
      if (options.bail && result.status === 'FAIL') stopped = true;
    }
    results.push(result);
    onResult(result);
  }
  return results;
}

/** Non-zero exactly when a stage failed. */
export function exitCodeFor(results: readonly StageResult[]): number {
  return results.some((result) => result.status === 'FAIL') ? 1 : 0;
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').replace(/\|/g, '/').trim();
}

export function formatSummary(results: readonly StageResult[]): string {
  const lines = ['| Stage | Result | Exit code | Detail |', '|---|---|---|---|'];
  for (const result of results) {
    const code = result.exitCode === null ? '-' : String(result.exitCode);
    lines.push(`| ${result.id} | ${result.status} | ${code} | ${oneLine(result.detail)} |`);
  }
  const count = (status: StageStatus): number => results.filter((result) => result.status === status).length;
  lines.push('', `PASS ${count('PASS')}, FAIL ${count('FAIL')}, SKIPPED ${count('SKIPPED')}`);
  return lines.join('\n');
}
