import { readFileSync } from 'node:fs';
import path from 'node:path';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { headersForAllPaths, hostSourceProblems, parseCsp, readVercelHeaders } from '../../scripts/checks/headers.ts';

const root = path.resolve(import.meta.dirname, '..', '..');
const config: unknown = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));

/** The final policy, as directive name to sources. */
const FINAL_CSP = {
  'default-src': ["'self'"],
  'img-src': ["'self'", 'data:', 'blob:'],
  'style-src': ["'self'", "'unsafe-inline'"],
  'script-src': ["'self'"],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'worker-src': ["'self'"],
  'manifest-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'none'"],
};

describe('deploy: security headers in vercel.json', () => {
  const entries = headersForAllPaths(config) ?? [];
  const valueOf = (key: string): string | undefined => entries.find((entry) => entry.key === key)?.value;

  it('vercel.json is valid JSON with a headers entry for every path', () => {
    expect(headersForAllPaths(config)).not.toBeNull();
  });

  it('the simple security headers have exactly these values', () => {
    expect(valueOf('X-Content-Type-Options')).toBe('nosniff');
    expect(valueOf('X-Frame-Options')).toBe('DENY');
    expect(valueOf('Referrer-Policy')).toBe('no-referrer');
    expect(valueOf('Permissions-Policy')).toBe('camera=(self), microphone=(), geolocation=()');
  });

  it('the Content-Security-Policy, parsed into directives, is the final policy', () => {
    expect(parseCsp(valueOf('Content-Security-Policy') ?? '')).toEqual(FINAL_CSP);
  });

  it('no directive allows a host other than self, data: and blob:, and only style-src allows unsafe-inline', () => {
    expect(hostSourceProblems(parseCsp(valueOf('Content-Security-Policy') ?? ''))).toEqual([]);
  });

  it('the preview server of check:browser is given the same headers', () => {
    expect(readVercelHeaders(root)).toEqual(Object.fromEntries(entries.map((entry) => [entry.key, entry.value])));
  });
});

describe('hostSourceProblems and parseCsp', () => {
  it('a host, a wildcard, unsafe-eval or unsafe-inline outside style-src is reported', () => {
    expect(hostSourceProblems(parseCsp("img-src 'self' https://cdn.example.com; script-src 'self' 'unsafe-inline'; connect-src *; style-src 'unsafe-inline'"))).toEqual([
      'img-src allows https://cdn.example.com',
      "script-src allows 'unsafe-inline'",
      'connect-src allows *',
    ]);
  });

  it('a repeated directive keeps its first value', () => {
    expect(parseCsp("img-src 'self'; img-src https://a.example")).toEqual({ 'img-src': ["'self'"] });
  });

  it('headersForAllPaths is null for a config without a catch-all headers rule', () => {
    expect(headersForAllPaths({})).toBeNull();
    expect(headersForAllPaths({ headers: [{ source: '/a', headers: [] }] })).toBeNull();
  });

  it('R23.2 parsing a policy built from directives gives those directives back', () => {
    const directive = fc.record({
      name: fc.constantFrom('img-src', 'font-src', 'worker-src', 'media-src'),
      sources: fc.array(fc.constantFrom("'self'", 'data:', 'blob:', "'none'"), { minLength: 1, maxLength: 3 }),
    });
    fc.assert(
      fc.property(fc.uniqueArray(directive, { selector: (d) => d.name, minLength: 1, maxLength: 4 }), (list) => {
        const policy = list.map((d) => `${d.name} ${d.sources.join(' ')}`).join('; ');
        expect(parseCsp(policy)).toEqual(Object.fromEntries(list.map((d) => [d.name, d.sources])));
        expect(hostSourceProblems(parseCsp(policy))).toEqual([]);
      }),
    );
  });
});
