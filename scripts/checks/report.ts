/**
 * The step runner and report formatting for `npm run check:browser`. A step that throws is a FAIL with the
 * error message as its reason, and the run goes on with the next step. No I/O here.
 */
export type BrowserStatus = 'PASS' | 'FAIL';
export type BrowserStep = {
  /** Short name, printed after the step number. */
  name: string;
  /** Resolves with what was observed (the PASS detail); throws an Error with the reason to FAIL. */
  run: () => Promise<string>;
};
export type BrowserResult = { number: number; name: string; status: BrowserStatus; detail: string };

export type RunHooks = {
  /** Called after each step, pass or fail, for example to take a screenshot. A throw here is reported, not fatal. */
  after?: (result: BrowserResult) => Promise<void>;
  /** Called with each result as soon as it is known, for streaming output. */
  onResult?: (result: BrowserResult) => void;
};

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message === '' ? error.name : error.message;
  return String(error);
}

/** Runs every step in order. A failed step never stops the run. */
export async function runBrowserSteps(steps: readonly BrowserStep[], hooks: RunHooks = {}): Promise<BrowserResult[]> {
  const results: BrowserResult[] = [];
  for (const [index, step] of steps.entries()) {
    let result: BrowserResult;
    try {
      result = { number: index + 1, name: step.name, status: 'PASS', detail: await step.run() };
    } catch (error) {
      result = { number: index + 1, name: step.name, status: 'FAIL', detail: messageOf(error) };
    }
    if (hooks.after) {
      try {
        await hooks.after(result);
      } catch (error) {
        result = { ...result, detail: `${result.detail} (after-step hook failed: ${messageOf(error)})` };
      }
    }
    results.push(result);
    hooks.onResult?.(result);
  }
  return results;
}

export function formatResult(result: BrowserResult): string {
  const [first = '', ...rest] = result.detail.split('\n');
  const head = `${result.status === 'PASS' ? 'PASS' : 'FAIL'}  ${String(result.number).padStart(2, ' ')}. ${result.name}`;
  const lines = [first === '' ? head : `${head}: ${first}`];
  for (const line of rest) lines.push(`        ${line}`);
  return lines.join('\n');
}

export function formatSummary(results: readonly BrowserResult[]): string {
  const failed = results.filter((result) => result.status === 'FAIL');
  const lines = ['', 'Summary', ...results.map((result) => `  ${result.status}  ${String(result.number).padStart(2, ' ')}. ${result.name}`)];
  lines.push(`${results.length - failed.length} passed, ${failed.length} failed`);
  return lines.join('\n');
}

/** Non-zero exactly when a step failed, or when no step ran. */
export function exitCodeFor(results: readonly BrowserResult[]): number {
  return results.length === 0 || results.some((result) => result.status === 'FAIL') ? 1 : 0;
}
