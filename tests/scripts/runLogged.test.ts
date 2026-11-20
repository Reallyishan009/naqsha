/**
 * Runs .kiro/hooks/bin/run-logged.sh for real (no mocks, no fake log lines) and checks the three
 * results it must write. The log goes to a temporary file through NAQSHA_HOOKS_LOG, so logs/hooks.log
 * keeps lines from real hook runs only. POSIX shell, so the suite skips these on Windows.
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isTimeoutResult, parseHookLogLine } from '../../scripts/checks/hooksLog.ts';

const root = path.resolve(import.meta.dirname, '..', '..');
const wrapper = path.join(root, '.kiro', 'hooks', 'bin', 'run-logged.sh');
const HOOK = 'run-logged test, not a hook run';

let work: string;
let logFile: string;

beforeAll(() => {
  work = mkdtempSync(path.join(tmpdir(), 'naqsha-run-logged-'));
  logFile = path.join(work, 'hooks.log');
});
afterAll(() => rmSync(work, { recursive: true, force: true }));

type Run = { status: number | null; signal: NodeJS.Signals | null; stdout: string };

/** Starts the wrapper; `onStart` may signal it. Resolves with its exit status. */
function runWrapper(args: string[], stdin: string, onStart?: (pid: number) => void): Promise<Run> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', [wrapper, HOOK, ...args], {
      cwd: root,
      env: { ...process.env, NAQSHA_HOOKS_LOG: logFile },
    });
    let stdout = '';
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stdin.end(stdin);
    child.on('error', reject);
    child.on('close', (status, signal) => resolve({ status, signal, stdout }));
    if (onStart !== undefined && child.pid !== undefined) onStart(child.pid);
  });
}

/** The lines written so far, parsed. A line this wrapper wrote must be well-formed. */
function lines(): { at: string; hook: string; result: string }[] {
  const text = readFileSync(logFile, 'utf8');
  return text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const parsed = parseHookLogLine(l);
      if (!parsed.ok) throw new Error(`malformed log line: ${JSON.stringify(l)}`);
      return parsed.entry;
    });
}

const describeIf = process.platform === 'win32' ? describe.skip : describe;

describeIf('R16.7 the hook wrapper writes one log line per run, also when the run is cut short', () => {
  it('passes the exit status through and gives the command the hook STDIN', async () => {
    const seen = path.join(work, 'stdin.json');
    const payload = '{"filePath":"src/codec/types.ts"}';
    const ok = await runWrapper(['30', 'sh', '-c', `cat > ${seen}; exit 0`], payload);
    expect(ok.status).toBe(0);
    expect(readFileSync(seen, 'utf8')).toBe(payload);

    const failed = await runWrapper(['30', 'sh', '-c', 'exit 3'], '');
    expect(failed.status).toBe(3);

    const written = lines();
    expect(written.map((e) => e.result)).toEqual(['exit 0', 'exit 3']);
    expect(written.every((e) => e.hook === HOOK && !isTimeoutResult(e.result))).toBe(true);
  }, 30_000);

  it('writes a timeout line when its own deadline ends a slow command', async () => {
    const before = lines().length;
    const run = await runWrapper(['1', 'sleep', '30'], '');
    expect(run.status).toBe(124);
    const written = lines();
    expect(written.length).toBe(before + 1);
    const last = written[written.length - 1]!;
    expect(last.result).toBe('timed out (deadline 1s)');
    expect(isTimeoutResult(last.result)).toBe(true);
  }, 30_000);

  it('writes a timeout line when the runner terminates it before the deadline', async () => {
    const before = lines().length;
    const run = await runWrapper(['60', 'sleep', '30'], '', (pid) => {
      setTimeout(() => process.kill(pid, 'SIGTERM'), 300);
    });
    expect(run.status).toBe(124);
    const written = lines();
    expect(written.length).toBe(before + 1);
    const last = written[written.length - 1]!;
    expect(last.result).toBe('timed out (terminated by the hook runner)');
    expect(isTimeoutResult(last.result)).toBe(true);
  }, 30_000);
});
