import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_URL,
  extractPageAssets,
  formatHeaders,
  loginPageReason,
  normaliseBaseUrl,
  parseArgs,
  resolveUrl,
  runDeployedChecks,
  secureContextInfo,
  selectHeaders,
} from '../../scripts/checks/deployed.ts';
import type { FetchLike } from '../../scripts/checks/deployed.ts';
import { exitCodeFor } from '../../scripts/checks/report.ts';
import profileJson from '../../public/profiles/demo-12x16.json';

const SEED = 60404;
const NUM_RUNS = 100;
const BASE = 'https://naqsha.example/';

const INDEX_HTML = `<!doctype html><html><head><title>Naqsha</title>
<script type="module" crossorigin src="./assets/index-abc.js"></script>
<link rel="stylesheet" crossorigin href="./assets/index-abc.css"></head>
<body><div id="root"></div></body></html>`;

// ---------------------------------------------------------------- a fake network

type FakeReply = { status?: number; type?: string; body?: string; url?: string; redirected?: boolean; headers?: Record<string, string> } | Error;

function fakeFetch(routes: Record<string, FakeReply>, seen: string[] = []): FetchLike {
  return async (url) => {
    seen.push(url);
    const reply = routes[url];
    if (reply === undefined) return fakeResponse(url, { status: 404, type: 'text/html', body: 'not found' });
    if (reply instanceof Error) throw reply;
    return fakeResponse(url, reply);
  };
}

function fakeResponse(requested: string, reply: Exclude<FakeReply, Error>): Response {
  const response = new Response(reply.body ?? '', {
    status: reply.status ?? 200,
    headers: { ...(reply.type === undefined ? {} : { 'content-type': reply.type }), ...reply.headers },
  });
  Object.defineProperty(response, 'url', { value: reply.url ?? requested });
  Object.defineProperty(response, 'redirected', { value: reply.redirected ?? false });
  return response;
}

const GOOD: Record<string, FakeReply> = {
  [BASE]: { type: 'text/html; charset=utf-8', body: INDEX_HTML, headers: { server: 'Vercel', 'cache-control': 'public, max-age=0' } },
  [`${BASE}assets/index-abc.js`]: { type: 'text/javascript; charset=utf-8', body: 'console.log(1)' },
  [`${BASE}assets/index-abc.css`]: { type: 'text/css; charset=utf-8', body: 'body{}' },
  [`${BASE}profiles/demo-12x16.json`]: { type: 'application/json', body: JSON.stringify(profileJson) },
};

const run = (routes: Record<string, FakeReply>, url = BASE) => runDeployedChecks({ fetch: fakeFetch(routes), url, expectedTitle: 'Naqsha' });

// ---------------------------------------------------------------- generators

const segment = fc.stringMatching(/^[a-z0-9]{1,8}$/);
const fileName = fc.tuple(segment, fc.constantFrom('js', 'mjs', 'css')).map(([name, ext]) => `${name}.${ext}`);
const relativeRef = fc.tuple(fc.constantFrom('./', '', '/', '../', '../../'), fc.array(segment, { maxLength: 3 }), fileName).map(([lead, dirs, file]) => `${lead}${[...dirs, file].join('/')}`);
const baseUrl = fc.tuple(fc.constantFrom('http', 'https'), segment, fc.option(fc.integer({ min: 1, max: 65535 }), { nil: undefined }), fc.array(segment, { maxLength: 3 }))
  .map(([scheme, host, port, dirs]) => `${scheme}://${host}.example${port === undefined ? '' : `:${port}`}/${dirs.map((d) => `${d}/`).join('')}`);
const quote = fc.constantFrom('"', "'");
const refValue = fc.stringMatching(/^[a-z0-9./_-]{1,20}$/).filter((value) => !value.includes('"') && !value.includes("'"));

type Shape = { scripts: Array<{ src: string; quote: string; extra: boolean }>; sheets: Array<{ href: string; quote: string; relFirst: boolean }>; decoys: string[] };
const shape: fc.Arbitrary<Shape> = fc.record({
  scripts: fc.array(fc.record({ src: refValue, quote, extra: fc.boolean() }), { maxLength: 4 }),
  sheets: fc.array(fc.record({ href: refValue, quote, relFirst: fc.boolean() }), { maxLength: 4 }),
  decoys: fc.subarray([
    '<script>console.log("inline")</script>',
    '<link rel="icon" href="/favicon.ico">',
    '<link rel="preconnect" href="https://fonts.example">',
    '<a href="/other.css">link</a>',
    '<img src="/pic.png">',
    '<!-- <script src="/commented.js"></script> -->',
  ]),
});
const htmlOf = (s: Shape): string =>
  `<!doctype html><html><head><title>T</title>${s.decoys.join('\n')}
${s.sheets.map((h) => (h.relFirst ? `<link rel=${h.quote}stylesheet${h.quote} href=${h.quote}${h.href}${h.quote}>` : `<link href=${h.quote}${h.href}${h.quote} rel=${h.quote}stylesheet${h.quote} crossorigin>`)).join('\n')}
</head><body><div id="root"></div>${s.scripts.map((x) => `<script ${x.extra ? 'type="module" ' : ''}src=${x.quote}${x.src}${x.quote}></script>`).join('\n')}</body></html>`;

// ---------------------------------------------------------------- pure parts

describe('parseArgs', () => {
  it('uses the default URL when none is given, and ignores a leading --', () => {
    expect(parseArgs([])).toEqual({ ok: true, url: DEFAULT_URL });
    expect(parseArgs(['--', 'http://localhost:4173'])).toEqual({ ok: true, url: 'http://localhost:4173/' });
  });
  it('rejects a non-http URL and more than one URL', () => {
    expect(parseArgs(['ftp://x.example/']).ok).toBe(false);
    expect(parseArgs(['nonsense']).ok).toBe(false);
    expect(parseArgs(['https://a.example', 'https://b.example']).ok).toBe(false);
  });
});

describe('normaliseBaseUrl and resolveUrl', () => {
  it('adds a trailing slash, drops the fragment, and keeps a file name', () => {
    expect(normaliseBaseUrl('https://a.example')).toBe('https://a.example/');
    expect(normaliseBaseUrl('https://a.example/app#x')).toBe('https://a.example/app/');
    expect(normaliseBaseUrl('https://a.example/app/index.html')).toBe('https://a.example/app/index.html');
  });
  it('resolves a relative asset against the base, including a sub-path base', () => {
    expect(resolveUrl('./assets/a.js', 'https://a.example/app/')).toBe('https://a.example/app/assets/a.js');
    expect(resolveUrl('profiles/x.json', 'https://a.example/app/')).toBe('https://a.example/app/profiles/x.json');
    expect(resolveUrl('/assets/a.js', 'https://a.example/app/')).toBe('https://a.example/assets/a.js');
  });
  it('R23.1 normalisation is idempotent', () => {
    fc.assert(
      fc.property(baseUrl, fc.boolean(), (url, strip) => {
        const input = strip ? url.replace(/\/$/, '') : url;
        const once = normaliseBaseUrl(input);
        expect(once).not.toBeNull();
        expect(normaliseBaseUrl(once!)).toBe(once);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
  it('R23.1 resolving a relative asset against a base stays on the base origin', () => {
    fc.assert(
      fc.property(baseUrl, relativeRef, (base, ref) => {
        const resolved = resolveUrl(ref, base);
        expect(resolved).not.toBeNull();
        expect(new URL(resolved!).origin).toBe(new URL(base).origin);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});

describe('extractPageAssets', () => {
  it('finds the Vite scripts, stylesheets, title and root, and ignores comments and other tags', () => {
    const found = extractPageAssets(`${INDEX_HTML}<!-- <script src="/x.js"></script> --><link rel="icon" href="/f.ico">`);
    expect(found).toEqual({ title: 'Naqsha', scripts: ['./assets/index-abc.js'], stylesheets: ['./assets/index-abc.css'], hasRoot: true });
  });
  it('reports a missing title and root', () => {
    expect(extractPageAssets('<html><body>hi</body></html>')).toEqual({ title: null, scripts: [], stylesheets: [], hasRoot: false });
  });
  it('R23.1 extracted asset URLs equal the generated ones, in order, and no others', () => {
    fc.assert(
      fc.property(shape, (s) => {
        const found = extractPageAssets(htmlOf(s));
        expect(found.scripts).toEqual(s.scripts.map((x) => x.src));
        expect(found.stylesheets).toEqual(s.sheets.map((x) => x.href));
        expect(found.title).toBe('T');
        expect(found.hasRoot).toBe(true);
      }),
      { seed: SEED, numRuns: NUM_RUNS },
    );
  });
});

describe('loginPageReason', () => {
  it('accepts the app', () => {
    expect(loginPageReason(BASE, INDEX_HTML)).toBeNull();
  });
  it('flags a Vercel login URL, a login path, and a password field', () => {
    expect(loginPageReason('https://vercel.com/login?next=x', INDEX_HTML)).toMatch(/Vercel login/);
    expect(loginPageReason('https://a.example/login', INDEX_HTML)).toMatch(/login/);
    expect(loginPageReason(BASE, '<form><input type="password"></form>')).toMatch(/password/);
    expect(loginPageReason(BASE, '<h1>Authentication Required</h1>')).toMatch(/login or protection/);
  });
});

describe('headers and HTTPS info', () => {
  it('selects the key headers in a fixed order and marks missing ones', () => {
    const selected = selectHeaders(new Headers({ server: 'Vercel', 'Content-Type': 'text/html' }));
    expect(selected.map((h) => h.name)).toEqual(['content-type', 'cache-control', 'content-security-policy', 'x-frame-options', 'server', 'strict-transport-security']);
    expect(formatHeaders(selected)).toContain('content-security-policy: (not sent)');
    expect(formatHeaders(selected)).toContain('server: Vercel');
  });
  it('says whether the camera secure-context condition can hold', () => {
    expect(secureContextInfo('https://a.example/')).toMatch(/yes/);
    expect(secureContextInfo('http://localhost:4173/')).toMatch(/localhost/);
    expect(secureContextInfo('http://192.168.0.2/')).toMatch(/not a secure context/);
  });
});

// ---------------------------------------------------------------- the checks, over a fake fetch

describe('runDeployedChecks', () => {
  it('passes every step against a healthy deployment and prints headers and the commit note as INFO', async () => {
    const { results, info } = await run(GOOD);
    expect(results.map((r) => r.status)).toEqual(['PASS', 'PASS', 'PASS', 'PASS']);
    expect(exitCodeFor(results)).toBe(0);
    expect(info.join('\n')).toContain('server: Vercel');
    expect(info.join('\n')).toContain('HTTPS: yes');
    expect(info.join('\n')).toContain('not determinable');
  });

  it('fails with the status on a non-200 page, and the later steps say why they did not run', async () => {
    const { results } = await run({ [BASE]: { status: 401, type: 'text/html', body: 'x' } });
    expect(results[0]).toMatchObject({ status: 'FAIL', detail: `GET ${BASE}: HTTP 401` });
    expect(results[1]!.detail).toMatch(/did not load/);
    expect(exitCodeFor(results)).toBe(1);
  });

  it('fails on a redirect to a login page that answers 200', async () => {
    const { results } = await run({ [BASE]: { type: 'text/html', body: '<input type="password">', url: 'https://vercel.com/login', redirected: true } });
    expect(results[0]!.status).toBe('FAIL');
    expect(results[0]!.detail).toMatch(/another origin/);
  });

  it('fails when the 200 body is not the app', async () => {
    const { results } = await run({ [BASE]: { type: 'text/html', body: '<html><title>Sign in</title></html>' } });
    expect(results[0]).toMatchObject({ status: 'FAIL' });
    expect(results[0]!.detail).toMatch(/not the app's index.html/);
  });

  it('fails a title that differs from index.html', async () => {
    const { results } = await run({ ...GOOD, [BASE]: { type: 'text/html', body: INDEX_HTML.replace('Naqsha', 'Other') } });
    expect(results[1]).toMatchObject({ status: 'FAIL', detail: 'title is "Other", expected "Naqsha" from index.html' });
  });

  it('fails an asset that is missing, or that is served as HTML by a rewrite', async () => {
    const missing = await run({ ...GOOD, [`${BASE}assets/index-abc.css`]: { status: 404, type: 'text/html' } });
    expect(missing.results[2]!.detail).toContain('index-abc.css: HTTP 404');
    const rewritten = await run({ ...GOOD, [`${BASE}assets/index-abc.js`]: { type: 'text/html', body: INDEX_HTML } });
    expect(rewritten.results[2]!.detail).toMatch(/content-type text\/html is not plausible for JavaScript/);
  });

  it('fails a profile that is not valid JSON, and one that parseCardProfile rejects', async () => {
    const notJson = await run({ ...GOOD, [`${BASE}profiles/demo-12x16.json`]: { type: 'text/html', body: INDEX_HTML } });
    expect(notJson.results[3]!.detail).toMatch(/not JSON/);
    const rejected = await run({ ...GOOD, [`${BASE}profiles/demo-12x16.json`]: { type: 'application/json', body: '{}' } });
    expect(rejected.results[3]!.detail).toMatch(/parseCardProfile rejected it/);
  });

  it('reports a network error and a timeout with the exact message', async () => {
    const refused = await run({ [BASE]: new TypeError('fetch failed', { cause: new Error('connect ECONNREFUSED 1.2.3.4:443') }) });
    expect(refused.results[0]!.detail).toBe(`GET ${BASE}: fetch failed (connect ECONNREFUSED 1.2.3.4:443)`);
    const timeout = new Error('The operation was aborted due to timeout');
    timeout.name = 'TimeoutError';
    const slow = await run({ [BASE]: timeout });
    expect(slow.results[0]!.detail).toBe(`GET ${BASE}: no response within 10 s`);
  });

  it('resolves assets and the profile against the page URL under a sub-path', async () => {
    const sub = 'https://a.example/app/';
    const seen: string[] = [];
    const routes: Record<string, FakeReply> = {};
    for (const [key, value] of Object.entries(GOOD)) routes[key.replace(BASE, sub)] = value;
    const report = await runDeployedChecks({ fetch: fakeFetch(routes, seen), url: sub, expectedTitle: 'Naqsha' });
    expect(report.results.every((r) => r.status === 'PASS')).toBe(true);
    expect(seen).toContain(`${sub}profiles/demo-12x16.json`);
    expect(seen).toContain(`${sub}assets/index-abc.js`);
  });
});
