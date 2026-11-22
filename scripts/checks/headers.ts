/**
 * The security headers the site is deployed with (vercel.json) as plain data, so the deploy test and the
 * preview server of `check:browser` read the same file. No I/O except `readVercelHeaders`.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export type HeaderEntry = { key: string; value: string };
export type CspDirectives = Record<string, string[]>;

/** The headers vercel.json sends for every path (source "/(.*)"), or null when there is no such entry. */
export function headersForAllPaths(config: unknown): HeaderEntry[] | null {
  if (typeof config !== 'object' || config === null) return null;
  const rules = (config as { headers?: unknown }).headers;
  if (!Array.isArray(rules)) return null;
  for (const rule of rules as unknown[]) {
    if (typeof rule !== 'object' || rule === null) continue;
    const { source, headers } = rule as { source?: unknown; headers?: unknown };
    if (source !== '/(.*)' || !Array.isArray(headers)) continue;
    const entries: HeaderEntry[] = [];
    for (const header of headers as unknown[]) {
      const { key, value } = (header ?? {}) as { key?: unknown; value?: unknown };
      if (typeof key !== 'string' || typeof value !== 'string') return null;
      entries.push({ key, value });
    }
    return entries;
  }
  return null;
}

/** A Content-Security-Policy as directive name to source list. A repeated directive keeps its first value, as browsers do. */
export function parseCsp(policy: string): CspDirectives {
  const directives: CspDirectives = {};
  for (const part of policy.split(';')) {
    const [name, ...sources] = part.trim().split(/\s+/);
    if (name === undefined || name === '') continue;
    const key = name.toLowerCase();
    if (!(key in directives)) directives[key] = sources;
  }
  return directives;
}

/** Sources a directive may list: keywords and schemes that name no host. `'unsafe-inline'` is allowed for style-src only. */
export function hostSourceProblems(directives: CspDirectives): string[] {
  const problems: string[] = [];
  for (const [name, sources] of Object.entries(directives)) {
    for (const source of sources) {
      const allowed = source === "'self'" || source === "'none'" || source === 'data:' || source === 'blob:' || (source === "'unsafe-inline'" && name === 'style-src');
      if (!allowed) problems.push(`${name} allows ${source}`);
    }
  }
  return problems;
}

/** The headers of vercel.json for the preview server; throws when the file has none, so a check never runs without them. */
export function readVercelHeaders(root: string): Record<string, string> {
  const config: unknown = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const entries = headersForAllPaths(config);
  if (entries === null || entries.length === 0) throw new Error('vercel.json has no headers for source "/(.*)"');
  return Object.fromEntries(entries.map((entry) => [entry.key, entry.value]));
}
