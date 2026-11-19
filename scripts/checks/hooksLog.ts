/**
 * Pure parts of the hooks evidence log: the line format, the parse, the per-hook summary,
 * the last-lines selection and the reading of a hook file. No I/O here.
 * One line is `<ISO timestamp>\t<hook name>\t<result>`. Tabs and line breaks inside the name or
 * the result are replaced by a space when a line is formatted, so a line always has three fields.
 */
export const HOOKS_LOG_PATH = 'logs/hooks.log';

export type HookLogEntry = { at: string; hook: string; result: string };
export type ParsedLine = { ok: true; entry: HookLogEntry } | { ok: false; line: string };
export type HookSummary = { hook: string; count: number; lastAt: string | null };
export type HookListResult = { ok: true; names: string[] } | { ok: false; message: string };

const clean = (text: string): string => text.replace(/[\t\r\n]/g, ' ');

export function formatHookLogLine(entry: HookLogEntry): string {
  return `${entry.at}\t${clean(entry.hook)}\t${clean(entry.result)}`;
}

function isIsoTimestamp(text: string): boolean {
  const ms = Date.parse(text);
  return !Number.isNaN(ms) && new Date(ms).toISOString() === text;
}

/** Never throws. A line that is not `<ISO>\t<name>\t<result>` with non-empty fields is not ok. */
export function parseHookLogLine(line: string): ParsedLine {
  const parts = line.split('\t');
  if (parts.length !== 3) return { ok: false, line };
  const [at, hook, result] = parts as [string, string, string];
  if (!isIsoTimestamp(at) || hook === '' || result === '') return { ok: false, line };
  return { ok: true, entry: { at, hook, result } };
}

/** Splits log text into non-blank lines (a missing log is the empty text). */
export function splitLogLines(text: string): string[] {
  return text.split('\n').map((l) => l.replace(/\r$/, '')).filter((l) => l.trim() !== '');
}

/** At most `count` lines, the last ones, in file order. */
export function lastLines(text: string, count: number): string[] {
  const lines = splitLogLines(text);
  if (!Number.isFinite(count) || count <= 0) return [];
  return lines.slice(-Math.floor(count));
}

/** Per hook: how many well-formed log lines carry its name, and the latest timestamp among them. */
export function summarizeHooks(logText: string, hookNames: string[]): { hooks: HookSummary[]; malformed: string[] } {
  const counts = new Map<string, { count: number; lastMs: number; lastAt: string }>();
  const malformed: string[] = [];
  for (const line of splitLogLines(logText)) {
    const parsed = parseHookLogLine(line);
    if (!parsed.ok) {
      malformed.push(line);
      continue;
    }
    const { at, hook } = parsed.entry;
    const ms = Date.parse(at);
    const seen = counts.get(hook);
    if (seen === undefined) counts.set(hook, { count: 1, lastMs: ms, lastAt: at });
    else {
      seen.count += 1;
      if (ms > seen.lastMs) {
        seen.lastMs = ms;
        seen.lastAt = at;
      }
    }
  }
  const hooks = hookNames.map((hook) => {
    const seen = counts.get(hook);
    return { hook, count: seen?.count ?? 0, lastAt: seen?.lastAt ?? null };
  });
  return { hooks, malformed };
}

export function describeSummary(summary: HookSummary): string {
  return summary.count === 0 || summary.lastAt === null
    ? `${summary.hook}: never fired (no log line)`
    : `${summary.hook}: fired ${summary.count} times, last at ${summary.lastAt}`;
}

/** Reads the hook names from the text of one `.kiro/hooks/*.json` file (schema v1: `hooks[].name`). */
export function readHookNames(fileText: string): HookListResult {
  let data: unknown;
  try {
    data = JSON.parse(fileText);
  } catch {
    return { ok: false, message: 'not valid JSON' };
  }
  if (typeof data !== 'object' || data === null || !Array.isArray((data as { hooks?: unknown }).hooks)) {
    return { ok: false, message: 'no "hooks" array' };
  }
  const names: string[] = [];
  for (const hook of (data as { hooks: unknown[] }).hooks) {
    const name = typeof hook === 'object' && hook !== null ? (hook as { name?: unknown }).name : undefined;
    if (typeof name !== 'string' || name === '') return { ok: false, message: 'a hook has no name' };
    names.push(name);
  }
  return { ok: true, names };
}
