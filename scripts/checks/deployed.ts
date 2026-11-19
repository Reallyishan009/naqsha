/**
 * The logic behind `npm run check:deployed`: argument parsing, URL handling, asset extraction from index.html,
 * login-page detection, header selection and the checks themselves. The network is reached only through the
 * injected `fetch`, so tests use a fake. Imports only from src/codec and scripts/checks/report.ts.
 */
import { parseCardProfile } from '../../src/codec/index.ts';
import { runBrowserSteps } from './report.ts';
import type { BrowserResult, BrowserStep } from './report.ts';

export const DEFAULT_URL = 'https://naqsha-ashen.vercel.app/';
export const TIMEOUT_MS = 10_000;
export const PROFILE_PATH = 'profiles/demo-12x16.json';

export type FetchLike = (url: string, init?: { signal?: AbortSignal }) => Promise<Response>;

// ---------------------------------------------------------------- arguments and URLs

export type ParsedArgs = { ok: true; url: string } | { ok: false; message: string };

/** `[<url>]`. No argument means the default URL. */
export function parseArgs(argv: readonly string[]): ParsedArgs {
  const args = argv.filter((arg) => arg !== '--');
  if (args.length > 1) return { ok: false, message: `expected at most one URL, got ${args.length}: ${args.join(' ')}` };
  const raw = args[0] ?? DEFAULT_URL;
  const url = normaliseBaseUrl(raw);
  if (url === null) return { ok: false, message: `not an http or https URL: ${raw}` };
  return { ok: true, url };
}

/**
 * The page URL as a base for relative references: http or https only, no fragment, and a trailing slash when
 * the last path segment is not a file name. Returns null for anything else. Idempotent.
 */
export function normaliseBaseUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  url.hash = '';
  const last = url.pathname.split('/').pop() ?? '';
  if (!url.pathname.endsWith('/') && !last.includes('.')) url.pathname = `${url.pathname}/`;
  return url.href;
}

/** Resolves a reference from the page against its base URL. Null when it cannot be resolved. */
export function resolveUrl(reference: string, base: string): string | null {
  try {
    return new URL(reference, base).href;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- HTML

export type PageAssets = { title: string | null; scripts: string[]; stylesheets: string[]; hasRoot: boolean };

function attributesOf(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>`=]+)))?/g;
  const inner = tag.replace(/^<\s*[^\s>/]+/, '');
  for (const match of inner.matchAll(pattern)) {
    const name = (match[1] ?? '').toLowerCase();
    if (!attributes.has(name)) attributes.set(name, match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

/** Script `src`, stylesheet `href` and the title, in document order. Comments are ignored. */
export function extractPageAssets(html: string): PageAssets {
  const text = html.replace(/<!--[\s\S]*?-->/g, '');
  const scripts: string[] = [];
  const stylesheets: string[] = [];
  for (const match of text.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const tag = match[0];
    const attributes = attributesOf(tag);
    if (match[1]!.toLowerCase() === 'script') {
      const src = attributes.get('src');
      if (src !== undefined && src !== '') scripts.push(src);
    } else {
      const rel = (attributes.get('rel') ?? '').toLowerCase().split(/\s+/);
      const href = attributes.get('href');
      if (rel.includes('stylesheet') && href !== undefined && href !== '') stylesheets.push(href);
    }
  }
  const titleMatch = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(text);
  const title = titleMatch === null ? null : titleMatch[1]!.trim();
  const hasRoot = /<div\b[^>]*\bid\s*=\s*["']?root["']?[\s>/]/i.test(text);
  return { title, scripts, stylesheets, hasRoot };
}

/** Why the response looks like a login page rather than the app, or null when it does not. */
export function loginPageReason(finalUrl: string, html: string): string | null {
  let url: URL | null = null;
  try {
    url = new URL(finalUrl);
  } catch {
    url = null;
  }
  if (url !== null && /(^|\.)vercel\.com$/i.test(url.hostname) && /login|sso|auth/i.test(url.pathname + url.search)) {
    return `final URL is a Vercel login page (${finalUrl})`;
  }
  if (url !== null && /\/(log-?in|sign-?in|sso|oauth|authorize)(\/|$)/i.test(url.pathname)) {
    return `final URL path looks like a login page (${finalUrl})`;
  }
  const assets = extractPageAssets(html);
  if (/<input\b[^>]*type\s*=\s*["']?password/i.test(html)) return 'the body has a password field';
  if (/authentication required|log in to vercel|continue with (github|google)/i.test(html) && !assets.hasRoot) {
    return 'the body reads like a login or protection page';
  }
  return null;
}

// ---------------------------------------------------------------- headers and HTTPS

export const KEY_HEADERS = [
  'content-type',
  'cache-control',
  'content-security-policy',
  'x-frame-options',
  'server',
  'strict-transport-security',
] as const;

/** The key headers in a fixed order; a missing one has the value null. */
export function selectHeaders(headers: Pick<Headers, 'get'>): Array<{ name: string; value: string | null }> {
  return KEY_HEADERS.map((name) => ({ name, value: headers.get(name) }));
}

export function formatHeaders(selected: ReadonlyArray<{ name: string; value: string | null }>): string {
  return selected.map(({ name, value }) => `${name}: ${value ?? '(not sent)'}`).join('\n');
}

/** Whether the camera's secure-context condition can hold for this URL. */
export function secureContextInfo(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol === 'https:') return 'HTTPS: yes, a secure context, so getUserMedia (the camera) is available';
  const local = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '[::1]';
  return local
    ? 'HTTPS: no, but localhost counts as a secure context, so the camera works only on this machine'
    : 'HTTPS: no, so this is not a secure context and the camera will be refused on other devices';
}

// ---------------------------------------------------------------- the checks

export type DeployedReport = { results: BrowserResult[]; info: string[] };

export type DeployedDeps = {
  fetch: FetchLike;
  url: string;
  /** The title of the local index.html; the deployed title must equal it. */
  expectedTitle: string;
  timeoutMs?: number;
  onResult?: (result: BrowserResult) => void;
};

function messageOf(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const base = error.message === '' ? error.name : error.message;
    return cause instanceof Error && cause.message !== '' && !base.includes(cause.message) ? `${base} (${cause.message})` : base;
  }
  return String(error);
}

type Fetched = { status: number; finalUrl: string; redirected: boolean; headers: Headers; body: string };

async function get(deps: DeployedDeps, url: string): Promise<Fetched> {
  const timeoutMs = deps.timeoutMs ?? TIMEOUT_MS;
  let response: Response;
  try {
    response = await deps.fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'TimeoutError' || name === 'AbortError') throw new Error(`GET ${url}: no response within ${timeoutMs / 1000} s`);
    throw new Error(`GET ${url}: ${messageOf(error)}`);
  }
  let body: string;
  try {
    body = await response.text();
  } catch (error) {
    throw new Error(`GET ${url}: reading the body failed: ${messageOf(error)}`);
  }
  return { status: response.status, finalUrl: response.url === '' ? url : response.url, redirected: response.redirected, headers: response.headers, body };
}

function contentTypeOk(kind: 'js' | 'css', contentType: string | null): boolean {
  const type = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
  return kind === 'css' ? type === 'text/css' : type === 'text/javascript' || type === 'application/javascript' || type === 'application/x-javascript';
}

/** Runs the four checks, then collects the INFO lines. A failed step never stops the later ones. */
export async function runDeployedChecks(deps: DeployedDeps): Promise<DeployedReport> {
  const info: string[] = [];
  let page: Fetched | null = null;
  let assets: PageAssets | null = null;
  let pageOk = false;
  const needPage = (): { page: Fetched; assets: PageAssets } => {
    if (!pageOk || page === null || assets === null) throw new Error('not run, the page did not load in step 1');
    return { page, assets };
  };

  const steps: BrowserStep[] = [
    {
      name: 'page loads with 200 and is the app, not a login page',
      run: async () => {
        const fetched = await get(deps, deps.url);
        page = fetched;
        assets = extractPageAssets(fetched.body);
        if (fetched.status !== 200) throw new Error(`GET ${deps.url}: HTTP ${fetched.status}`);
        if (new URL(fetched.finalUrl).origin !== new URL(deps.url).origin) {
          throw new Error(`redirected to another origin: ${fetched.finalUrl}`);
        }
        const login = loginPageReason(fetched.finalUrl, fetched.body);
        if (login !== null) throw new Error(`redirect to a login page: ${login}`);
        if (assets.title === null || !assets.hasRoot) {
          throw new Error(`the body is not the app's index.html (title: ${assets.title ?? 'none'}, root element: ${assets.hasRoot ? 'yes' : 'no'})`);
        }
        pageOk = true;
        return `HTTP 200, final URL ${fetched.finalUrl}${fetched.redirected ? ' (redirected, same origin)' : ''}, root element present`;
      },
    },
    {
      name: 'page title',
      run: async () => {
        const { assets: found } = needPage();
        if (found.title !== deps.expectedTitle) throw new Error(`title is "${found.title}", expected "${deps.expectedTitle}" from index.html`);
        return `"${found.title}"`;
      },
    },
    {
      name: 'JS and CSS assets load',
      run: async () => {
        const { page: loaded, assets: found } = needPage();
        const base = loaded.finalUrl;
        const wanted = [
          ...found.scripts.map((reference) => ({ kind: 'js' as const, reference })),
          ...found.stylesheets.map((reference) => ({ kind: 'css' as const, reference })),
        ];
        if (wanted.length === 0) throw new Error('index.html references no script or stylesheet');
        if (!found.scripts.length) throw new Error('index.html references no script');
        const lines: string[] = [];
        const problems: string[] = [];
        for (const { kind, reference } of wanted) {
          const resolved = resolveUrl(reference, base);
          if (resolved === null) {
            problems.push(`${reference}: cannot be resolved against ${base}`);
            continue;
          }
          try {
            const asset = await get(deps, resolved);
            const type = asset.headers.get('content-type');
            if (asset.status !== 200) problems.push(`${resolved}: HTTP ${asset.status}`);
            else if (!contentTypeOk(kind, type)) problems.push(`${resolved}: content-type ${type ?? '(none)'} is not plausible for ${kind === 'js' ? 'JavaScript' : 'CSS'}`);
            else lines.push(`${resolved} 200 ${type}, ${asset.body.length} chars`);
          } catch (error) {
            problems.push(messageOf(error));
          }
        }
        if (problems.length > 0) throw new Error(problems.join('\n'));
        return lines.join('\n');
      },
    },
    {
      name: `${PROFILE_PATH} loads and passes parseCardProfile`,
      run: async () => {
        const { page: loaded } = needPage();
        const resolved = resolveUrl(PROFILE_PATH, loaded.finalUrl);
        if (resolved === null) throw new Error(`cannot resolve ${PROFILE_PATH} against ${loaded.finalUrl}`);
        const fetched = await get(deps, resolved);
        if (fetched.status !== 200) throw new Error(`${resolved}: HTTP ${fetched.status}`);
        let json: unknown;
        try {
          json = JSON.parse(fetched.body);
        } catch (error) {
          throw new Error(`${resolved}: not JSON (${messageOf(error)}), content-type ${fetched.headers.get('content-type') ?? '(none)'}`);
        }
        const parsed = parseCardProfile(json);
        if (!parsed.ok) throw new Error(`${resolved}: parseCardProfile rejected it: ${parsed.violations.map((violation) => violation.kind).join(', ')}`);
        return `${resolved} accepted`;
      },
    },
  ];

  const results = await runBrowserSteps(steps, { onResult: deps.onResult });
  if (page !== null) {
    info.push(`response headers of ${deps.url}\n${formatHeaders(selectHeaders((page as Fetched).headers))}`);
  } else {
    info.push('response headers: not available, the page did not load');
  }
  info.push(secureContextInfo(deps.url));
  info.push('deployed commit: not determinable from the response; asset hashes were not compared with a local build');
  return { results, info };
}
