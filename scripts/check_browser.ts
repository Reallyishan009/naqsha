/**
 * `npm run check:browser`: drives a real headless Chrome over the DevTools protocol against `vite preview`
 * of the built `dist/`, and reports PASS or FAIL for thirteen steps. Needs Chrome (set CHROME_PATH to choose one)
 * and a built `dist/` (it runs `npm run build` itself when `dist/` is missing).
 * Screenshots go to `media/check/` (git-ignored). Exit code is non-zero if any step failed.
 * The pure parts are in `scripts/checks/`: cdp.ts, chrome.ts, bmpHeader.ts, pngHeader.ts, report.ts.
 */
import { spawn, spawnSync } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { parseCardProfile } from '../src/codec/index.ts';
import type { CardGrid, CardProfile } from '../src/codec/index.ts';
import { DEFAULT_EXPORT_OPTIONS, exportPatternBmp, readPatternBmp } from '../src/exporter/index.ts';
import { DEFAULT_PIXELS_PER_MM } from '../src/ui/printable/raster.ts';
import { generateSample } from '../src/ui/samples/sampleDesigns.ts';
import { bmpMismatches, parseBmpHeader } from './checks/bmpHeader.ts';
import { connectCdp } from './checks/cdp.ts';
import type { CdpClient } from './checks/cdp.ts';
import { chromeArgs, findChrome, parseDevToolsActivePort } from './checks/chrome.ts';
import { parsePngInfo } from './checks/pngHeader.ts';
import { decideOffline, formatOffline, offlineConditions } from './checks/offline.ts';
import type { OfflineCheck, OfflineGroup } from './checks/offline.ts';
import { newPickWatch, stepPickWatch } from './checks/pickWatch.ts';
import { encodePngRgba } from './png_rgba.ts';
import { exitCodeFor, formatResult, formatSummary, runBrowserSteps } from './checks/report.ts';
import type { BrowserResult, BrowserStep } from './checks/report.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const readJson = (relative: string): unknown => JSON.parse(readFileSync(path.join(repoRoot, relative), 'utf8'));
const EN = readJson('src/ui/i18n/en.json') as Record<string, string>;
const HI: Record<string, string> = Object.fromEntries(
  Object.entries(readJson('src/ui/i18n/hi.json') as Record<string, { text: string }>).map(([key, entry]) => [key, entry.text]),
);
const DESIGNS = ['diamond', 'border', 'floral'] as const;
type Design = (typeof DESIGNS)[number];
const SCREENS = ['weave', 'keep', 'scan'] as const;
type Screen = (typeof SCREENS)[number];

/** Thrown by a step to say what was wrong. */
function expect(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(reason);
}

function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

// ---------------------------------------------------------------- the page

type Evaluated<T> = { result: { value: T }; exceptionDetails?: { text: string; exception?: { description?: string } } };

class Page {
  readonly consoleErrors: string[] = [];
  readonly cdp: CdpClient;
  constructor(cdp: CdpClient) {
    this.cdp = cdp;
  }

  async init(downloadDir: string): Promise<void> {
    const { cdp } = this;
    cdp.on('Runtime.consoleAPICalled', (params) => {
      if (params.type !== 'error' && params.type !== 'assert') return;
      const args = Array.isArray(params.args) ? (params.args as { value?: unknown; description?: string }[]) : [];
      this.consoleErrors.push(`console.${String(params.type)}: ${args.map((a) => String(a.value ?? a.description ?? '')).join(' ')}`);
    });
    cdp.on('Runtime.exceptionThrown', (params) => {
      const details = params.exceptionDetails as { text?: string; exception?: { description?: string } } | undefined;
      this.consoleErrors.push(`uncaught: ${details?.exception?.description ?? details?.text ?? 'exception'}`);
    });
    cdp.on('Log.entryAdded', (params) => {
      const entry = params.entry as { level?: string; text?: string; url?: string } | undefined;
      if (entry?.level === 'error') this.consoleErrors.push(`log: ${entry.text ?? ''} ${entry.url ?? ''}`.trim());
    });
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    await cdp.call('Log.enable');
    await cdp.call('DOM.enable');
    await cdp.call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
    await this.setViewport(900, 1000);
  }

  setViewport(width: number, height: number): Promise<unknown> {
    return this.cdp.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  }

  async ev<T>(expression: string): Promise<T> {
    const answer = await this.cdp.call<Evaluated<T>>('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (answer.exceptionDetails) {
      throw new Error(`page script failed: ${answer.exceptionDetails.exception?.description ?? answer.exceptionDetails.text}`);
    }
    return answer.result.value;
  }

  async waitFor<T>(expression: string, what: string, timeoutMs = 15_000): Promise<NonNullable<T>> {
    const end = Date.now() + timeoutMs;
    for (;;) {
      let value: T | null = null;
      try {
        value = await this.ev<T>(expression);
      } catch {
        value = null;
      }
      if (value) return value as NonNullable<T>;
      if (Date.now() > end) throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}`);
      await sleep(100);
    }
  }

  async navigate(url: string): Promise<void> {
    const loaded = new Promise<void>((resolve) => {
      const off = this.cdp.on('Page.loadEventFired', () => {
        off();
        resolve();
      });
    });
    await this.cdp.call('Page.navigate', { url });
    await loaded;
  }

  async hardReload(): Promise<void> {
    const loaded = new Promise<void>((resolve) => {
      const off = this.cdp.on('Page.loadEventFired', () => {
        off();
        resolve();
      });
    });
    await this.cdp.call('Page.reload', { ignoreCache: true });
    await loaded;
  }

  /** A real mouse click at the centre of the element the expression returns. */
  async click(elementExpression: string, what: string): Promise<void> {
    const point = await this.waitFor<{ x: number; y: number }>(
      `(()=>{const e=${elementExpression};if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return r.width>0&&r.height>0?{x:r.x+r.width/2,y:r.y+r.height/2}:null})()`,
      what,
      10_000,
    );
    await this.cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
    await this.cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
    await this.cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  }

  clickText(selector: string, text: string): Promise<void> {
    return this.click(byText(selector, text), `${selector} "${text}"`);
  }

  async fillField(label: string, value: string): Promise<void> {
    await this.waitFor(
      `(()=>{const l=[...document.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent.trim()===${JSON.stringify(label)});const i=l?.querySelector('input,textarea');if(!i)return false;i.focus();i.select();return true})()`,
      `the "${label}" field`,
    );
    await this.cdp.call('Input.insertText', { text: value });
  }

  async setFile(inputSelector: string, file: string): Promise<void> {
    const root = await this.cdp.call<{ root: { nodeId: number } }>('DOM.getDocument', { depth: 0 });
    const found = await this.cdp.call<{ nodeId: number }>('DOM.querySelector', { nodeId: root.root.nodeId, selector: inputSelector });
    expect(found.nodeId > 0, `no element matches ${inputSelector}`);
    await this.cdp.call('DOM.setFileInputFiles', { files: [file], nodeId: found.nodeId });
  }

  async screenshot(file: string): Promise<void> {
    const shot = await this.cdp.call<{ data: string }>('Page.captureScreenshot', { format: 'png' });
    writeFileSync(file, Buffer.from(shot.data, 'base64'));
  }
}

const byText = (selector: string, text: string): string =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)})`;

// ---------------------------------------------------------------- page snippets

const PICK_PATTERN = format(
  EN['weave.pickPosition']!.replace(/[.*+?^$()|[\]\\]/g, '\\$&'),
  { pick: '(\\d+)', total: '(\\d+)' },
);
const PICK_TEXT = `(()=>{const p=[...document.querySelectorAll('p')].find(p=>new RegExp('^'+${JSON.stringify(PICK_PATTERN)}+'$').test(p.textContent.trim()));return p?p.textContent.trim():null})()`;
const CANVAS_STATS = `(()=>{const c=document.querySelector('canvas');if(!c)return null;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let opaque=0,h=2166136261;const colours=new Set();for(let i=0;i<d.length;i+=4){if(d[i+3]>0)opaque++;if(colours.size<64)colours.add((d[i]<<16)|(d[i+1]<<8)|d[i+2]);h=Math.imul(h^d[i],16777619);h=Math.imul(h^d[i+1],16777619);h=Math.imul(h^d[i+2],16777619);h=Math.imul(h^d[i+3],16777619)}return {width:c.width,height:c.height,opaque,colours:colours.size,hash:(h>>>0).toString(16)}})()`;

type CanvasStats = { width: number; height: number; opaque: number; colours: number; hash: string };

// ---------------------------------------------------------------- servers and Chrome

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address !== null ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

type Cleanup = () => Promise<void>;

async function startPreview(cleanups: Cleanup[]): Promise<{ url: string; stop: () => Promise<void> }> {
  const { preview } = await import('vite');
  const port = await freePort();
  const server = await preview({
    root: repoRoot,
    logLevel: 'warn',
    preview: { port, strictPort: true, host: '127.0.0.1', open: false },
  });
  let stopped = false;
  const stop = async (): Promise<void> => {
    if (stopped) return;
    stopped = true;
    await server.close();
  };
  cleanups.push(stop);
  const url = `http://127.0.0.1:${port}/`;
  const end = Date.now() + 20_000;
  for (;;) {
    try {
      if ((await fetch(url)).ok) return { url, stop };
    } catch {
      // not listening yet
    }
    if (Date.now() > end) throw new Error(`vite preview did not answer at ${url}`);
    await sleep(100);
  }
}

async function startChrome(chromePath: string, cleanups: Cleanup[]): Promise<{ port: number }> {
  const userDataDir = mkdtempSync(path.join(os.tmpdir(), 'naqsha-chrome-'));
  const child: ChildProcess = spawn(chromePath, chromeArgs(userDataDir), { stdio: 'ignore' });
  let exited = false;
  child.once('exit', () => {
    exited = true;
  });
  cleanups.push(async () => {
    if (!exited) {
      child.kill('SIGTERM');
      for (let i = 0; i < 30 && !exited; i++) await sleep(100);
      if (!exited) child.kill('SIGKILL');
    }
    for (let i = 0; i < 5; i++) {
      try {
        rmSync(userDataDir, { recursive: true, force: true });
        break;
      } catch {
        await sleep(200);
      }
    }
  });
  const end = Date.now() + 30_000;
  for (;;) {
    if (exited) throw new Error(`Chrome (${chromePath}) exited before it opened a DevTools port`);
    try {
      const active = parseDevToolsActivePort(readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8'));
      if (active !== null) return { port: active.port };
    } catch {
      // the file is written once Chrome is ready
    }
    if (Date.now() > end) throw new Error('Chrome did not open a DevTools port within 30 s');
    await sleep(100);
  }
}

async function openPage(port: number): Promise<CdpClient> {
  const end = Date.now() + 15_000;
  for (;;) {
    try {
      const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as { type: string; webSocketDebuggerUrl?: string }[];
      const target = targets.find((entry) => entry.type === 'page' && entry.webSocketDebuggerUrl !== undefined);
      if (target?.webSocketDebuggerUrl) return await connectCdp(target.webSocketDebuggerUrl, 60_000);
    } catch {
      // try again
    }
    if (Date.now() > end) throw new Error('Chrome has no page to drive');
    await sleep(200);
  }
}

// ---------------------------------------------------------------- the steps

type Context = {
  page: Page;
  profile: CardProfile;
  baseUrl: string;
  /** Stops the preview server, so the offline step can take the network away for real. Runs once. */
  stopPreview: () => Promise<void>;
  downloadDir: string;
  tempDir: string;
  expectedTitle: string;
  hashes: Partial<Record<Design, string>>;
  saved: { name: string; place: string; picks: number } | null;
  cardPng: string | null;
  /** Index of the Diamond pick that was printed: the one with the most punched holes, so the read cannot pass on an empty card. */
  printedPickIndex: number;
};

async function ensureEnglish(page: Page): Promise<void> {
  if ((await page.ev<string>('document.documentElement.lang')) !== 'en') await page.clickText('button', EN['language.en']!);
  await page.waitFor(`document.documentElement.lang==='en'`, 'the page language to be en');
}

async function goTo(page: Page, screen: Screen): Promise<void> {
  await ensureEnglish(page);
  await page.clickText('nav button', EN[`nav.${screen}`]!);
  await page.waitFor(`document.querySelector('#screen-title')?.textContent.trim()===${JSON.stringify(EN[`nav.${screen}`])}`, `the ${screen} screen`);
}

const parsePick = (text: string | null): { pick: number; total: number } | null => {
  const match = text === null ? null : new RegExp(`^${PICK_PATTERN}$`).exec(text);
  return match ? { pick: Number(match[1]), total: Number(match[2]) } : null;
};

/** Everything worth knowing about the page when a wait gives up. */
async function diagnose(page: Page, label: string): Promise<string> {
  let state = 'page state unreadable';
  try {
    state = JSON.stringify(
      await page.ev<unknown>(
        `(()=>{const b=t=>[...document.querySelectorAll('button')].find(x=>x.textContent.trim()===t);return {screen:document.querySelector('#screen-title')?.textContent.trim()??null,counter:${PICK_TEXT},playDisabled:b(${JSON.stringify(EN['weave.play'])})?.disabled??null,pauseDisabled:b(${JSON.stringify(EN['weave.pause'])})?.disabled??null,canvas:!!document.querySelector('canvas'),visibility:document.visibilityState}})()`,
      ),
    );
  } catch (error) {
    state = `page state unreadable: ${error instanceof Error ? error.message : String(error)}`;
  }
  let shot = 'no screenshot';
  try {
    const file = path.join(repoRoot, 'media', 'check', `failure-${slug(label)}.png`);
    await page.screenshot(file);
    shot = `screenshot ${path.relative(repoRoot, file)}`;
  } catch {
    // keep going: the state above is still reported
  }
  const errors = page.consoleErrors.length === 0 ? 'none' : page.consoleErrors.join(' | ');
  return `page: ${state}; console errors: ${errors}; ${shot}`;
}

/** Waits until the pick counter shows the last pick (a finished cloth may show it on the first read). Returns every value seen. */
async function playToEnd(page: Page, total: number, timeoutMs = 150_000): Promise<number[]> {
  let watch = newPickWatch();
  const end = Date.now() + timeoutMs;
  let lastText: string | null = null;
  for (;;) {
    lastText = await page.ev<string | null>(PICK_TEXT);
    const step = stepPickWatch(watch, parsePick(lastText), total);
    watch = step.watch;
    if (step.done) return watch.seen;
    if (Date.now() > end) {
      throw new Error(
        `the pick counter did not reach ${total} of ${total} within ${timeoutMs} ms (values seen: ${watch.seen.join(', ') || 'none'}; last counter text: ${lastText === null ? 'none' : JSON.stringify(lastText)}; ${await diagnose(page, `pick-counter-${total}`)})`,
      );
    }
    await sleep(100);
  }
}

async function chooseSample(page: Page, design: Design): Promise<number> {
  await goTo(page, 'weave');
  await page.clickText('button', EN[`tryit.${design}`]!);
  if (await page.ev<boolean>(`!!${byText('button', EN['tryit.confirmYes']!)}`)) await page.clickText('button', EN['tryit.confirmYes']!);
  return generateSample(await profileOf(), design).length;
}

let cachedProfile: CardProfile | null = null;
async function profileOf(): Promise<CardProfile> {
  if (cachedProfile === null) {
    const parsed = parseCardProfile(readJson('public/profiles/demo-12x16.json'));
    expect(parsed.ok, 'public/profiles/demo-12x16.json does not pass parseCardProfile');
    cachedProfile = parsed.value;
  }
  return cachedProfile;
}

async function canvasStats(page: Page): Promise<CanvasStats> {
  const stats = await page.ev<CanvasStats | null>(CANVAS_STATS);
  expect(stats !== null, 'there is no canvas on the page');
  return stats;
}

/** The canvas once two reads 300 ms apart agree, so a frame still being drawn is not measured. */
async function settledStats(page: Page): Promise<CanvasStats> {
  let last = await canvasStats(page);
  for (let i = 0; i < 20; i++) {
    await sleep(300);
    const next = await canvasStats(page);
    if (next.hash === last.hash) return next;
    last = next;
  }
  throw new Error(`the canvas never settled (last hash ${last.hash})`);
}

function describeStats(stats: CanvasStats): string {
  return `${stats.width}x${stats.height} canvas, ${stats.opaque} opaque pixels, ${stats.colours}+ colours`;
}

/** Waits for one finished download in the download directory, reads it, and removes it. */
async function takeDownload(dir: string, timeoutMs = 20_000): Promise<{ name: string; bytes: Uint8Array }> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const names = readdirSync(dir).filter((name) => !name.endsWith('.crdownload') && !name.startsWith('.'));
    const name = names[0];
    if (name !== undefined) {
      const file = path.join(dir, name);
      const size = statSync(file).size;
      await sleep(200);
      if (size > 0 && statSync(file).size === size) {
        const bytes = new Uint8Array(readFileSync(file));
        rmSync(file);
        return { name, bytes };
      }
    }
    if (Date.now() > end) throw new Error(`no download arrived in ${timeoutMs} ms`);
    await sleep(100);
  }
}

function clearDownloads(dir: string): void {
  for (const name of readdirSync(dir)) rmSync(path.join(dir, name), { force: true });
}

const KEEP_LIST_TEXT = `(()=>{const h=document.getElementById('keep-list-title');const s=h?h.closest('section'):null;return s?s.innerText:null})()`;

function buildSteps(ctx: Context): BrowserStep[] {
  const { page } = ctx;
  return [
    {
      name: 'app loads',
      async run() {
        const title = await page.ev<string>('document.title');
        expect(title === ctx.expectedTitle, `title is "${title}", expected "${ctx.expectedTitle}" (from dist/index.html)`);
        const heading = await page.waitFor<string>(
          `(()=>{const h=document.querySelector('#screen-title');if(!h)return null;const r=h.getBoundingClientRect();return r.width>0&&r.height>0?h.textContent.trim():null})()`,
          'a visible screen heading',
        );
        expect(heading === EN['nav.weave'] || heading === HI['nav.weave'], `the first screen heading is "${heading}", expected the Weave screen`);
        await page.waitFor(
          `[...document.querySelectorAll('button')].some(b=>(b.textContent.trim()===${JSON.stringify(EN['tryit.diamond'])}||b.textContent.trim()===${JSON.stringify(HI['tryit.diamond'])})&&!b.disabled)`,
          'the card profile to load (Try it buttons enabled)',
        );
        await sleep(500);
        expect(page.consoleErrors.length === 0, `console errors on load:\n${page.consoleErrors.join('\n')}`);
        return `title "${title}", "${heading}" visible, Try it enabled, no console errors`;
      },
    },
    {
      name: 'language switch hi <-> en',
      async run() {
        const lang = () => page.ev<string>('document.documentElement.lang');
        const heading = () => page.ev<string>(`document.querySelector('#screen-title')?.textContent.trim()`);
        await page.clickText('button', EN['language.en']!);
        await page.waitFor(`document.documentElement.lang==='en'`, 'lang en');
        const en = { lang: await lang(), heading: await heading(), nav: await page.ev<string>(`document.querySelector('nav').innerText`) };
        await page.clickText('button', HI['language.hi']!);
        await page.waitFor(`document.documentElement.lang==='hi'`, 'lang hi');
        const hi = { lang: await lang(), heading: await heading(), nav: await page.ev<string>(`document.querySelector('nav').innerText`) };
        expect(en.heading === EN['nav.weave'], `English heading is "${en.heading}", expected "${EN['nav.weave']}"`);
        expect(hi.heading === HI['nav.weave'], `Hindi heading is "${hi.heading}", expected "${HI['nav.weave']}"`);
        expect(en.nav !== hi.nav, 'the navigation text did not change between hi and en');
        await page.clickText('button', EN['language.en']!);
        await page.waitFor(`document.documentElement.lang==='en'`, 'lang back to en');
        const back = await heading();
        expect(back === EN['nav.weave'], `after switching back, the heading is "${back}"`);
        return `en: lang=${en.lang} "${en.heading}"; hi: lang=${hi.lang} "${hi.heading}"; back to en: "${back}"`;
      },
    },
    {
      name: 'play the three Try it samples',
      async run() {
        const lines: string[] = [];
        const failures: string[] = [];
        for (const design of DESIGNS) {
          try {
            const expected = await chooseSample(page, design);
            await page.waitFor(
              `(()=>{const m=new RegExp('^'+${JSON.stringify(PICK_PATTERN)}+'$').exec((${PICK_TEXT})||'');return m&&Number(m[1])<Number(m[2])&&Number(m[2])===${expected}})()`,
              `the pick counter to start below ${expected} for ${design}`,
              10_000,
            );
            const seen = await playToEnd(page, expected);
            const increasing = seen.every((value, index) => index === 0 || value > seen[index - 1]!);
            expect(seen.length >= 3 && increasing, `${design}: the pick counter did not advance (values seen: ${seen.join(', ')})`);
            const stats = await settledStats(page);
            expect(stats.opaque > 0 && stats.colours >= 2, `${design}: the cloth canvas looks blank (${describeStats(stats)})`);
            ctx.hashes[design] = stats.hash;
            lines.push(`${design} [hash ${stats.hash}]: counter ${seen[0]} -> ${expected} of ${expected} (${seen.length} values), ${describeStats(stats)}`);
          } catch (error) {
            failures.push(`${design}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        if (failures.length > 0) throw new Error([...failures, ...lines].join('\n'));
        return lines.join('\n');
      },
    },
    {
      name: 'Keep: save a design with a name and place',
      async run() {
        const stamp = new Date().toISOString().slice(11, 19).replaceAll(':', '');
        const name = `Check ${stamp}`;
        const place = 'Surat';
        // The current pattern is the Floral sample from the step before; make sure of it.
        const picks = await chooseSample(page, 'floral');
        await playToEnd(page, picks);
        await goTo(page, 'keep');
        await page.fillField(EN['keep.field.name']!, name);
        await page.fillField(EN['keep.field.place']!, place);
        await page.clickText('button', EN['keep.save.button']!);
        const saved = await page.waitFor<string>(`document.getElementById('keep-saved')?.textContent.trim()`, 'the "Saved" message');
        expect(saved === format(EN['keep.saved']!, { name }), `saved message is "${saved}", expected "${format(EN['keep.saved']!, { name })}"`);
        const list = await page.waitFor<string>(`(()=>{const t=${KEEP_LIST_TEXT};return t&&t.includes(${JSON.stringify(name)})?t:null})()`, 'the design in the list');
        expect(list.includes(place) && list.includes(format(EN['keep.list.picks']!, { count: picks })), `the list row lacks the place or "${picks} picks":\n${list}`);
        ctx.saved = { name, place, picks };
        return `saved "${name}" at ${place}, ${picks} picks; the list shows it`;
      },
    },
    {
      name: 'hard reload: the design is still listed',
      async run() {
        const saved = need(ctx.saved, 'step 4 did not save a design');
        await page.hardReload();
        await page.waitFor(`!!document.querySelector('#screen-title')`, 'the app after reload');
        await goTo(page, 'keep');
        const list = await page.waitFor<string>(`(()=>{const t=${KEEP_LIST_TEXT};return t&&t.includes(${JSON.stringify(saved.name)})?t:null})()`, `"${saved.name}" in the list after a reload`);
        expect(list.includes(saved.place), `after the reload the row lost its place:\n${list}`);
        return `"${saved.name}" is listed after a hard reload (cache ignored)`;
      },
    },
    {
      name: 'open the saved design',
      async run() {
        const saved = need(ctx.saved, 'step 4 did not save a design');
        await page.click(`document.querySelector(${JSON.stringify(`button[aria-label="${EN['keep.list.open']}: ${saved.name}"]`)})`, `the Open button of "${saved.name}"`);
        await page.waitFor(`document.querySelector('#screen-title')?.textContent.trim()===${JSON.stringify(EN['nav.weave'])}`, 'the Weave screen after Open');
        // A design opened from Keep is shown finished at once (the Weave screen mounts with a pattern), so no playback is awaited.
        await page.waitFor(`(${PICK_TEXT})===${JSON.stringify(format(EN['weave.pickPosition']!, { pick: saved.picks, total: saved.picks }))}`, `the counter to read ${saved.picks} of ${saved.picks}`, 20_000);
        const stats = await settledStats(page);
        expect(stats.opaque > 0 && stats.colours >= 2, `the opened cloth looks blank (${describeStats(stats)})`);
        const floral = ctx.hashes.floral;
        expect(floral !== undefined, 'step 3 recorded no Floral cloth to compare with');
        expect(stats.hash === floral, `the opened cloth differs from the Floral cloth played in step 3 (canvas hash ${stats.hash}, expected ${floral}; opened ${describeStats(stats)})`);
        return `Weave shows pick ${saved.picks} of ${saved.picks}; canvas hash ${stats.hash} equals the Floral cloth`;
      },
    },
    {
      name: 'delete with confirmation; still gone after a reload',
      async run() {
        const saved = need(ctx.saved, 'step 4 did not save a design');
        await goTo(page, 'keep');
        await page.waitFor(`(${KEEP_LIST_TEXT})?.includes(${JSON.stringify(saved.name)})`, `"${saved.name}" in the list before deleting`);
        await page.click(`document.querySelector(${JSON.stringify(`button[aria-label="${EN['keep.list.delete']}: ${saved.name}"]`)})`, 'the Delete button');
        const group = `[role="group"][aria-label="${EN['keep.list.deleteConfirm']}"]`;
        await page.waitFor(`!!document.querySelector(${JSON.stringify(group)})`, 'the delete confirmation');
        const stillThere = await page.ev<boolean>(`(${KEEP_LIST_TEXT}).includes(${JSON.stringify(saved.name)})`);
        expect(stillThere, 'the design vanished before it was confirmed');
        await page.click(`[...document.querySelectorAll(${JSON.stringify(`${group} button`)})].find(b=>b.textContent.trim()===${JSON.stringify(EN['keep.list.deleteYes'])})`, 'the confirm Delete button');
        await page.waitFor(`!(${KEEP_LIST_TEXT}).includes(${JSON.stringify(saved.name)})`, 'the design to leave the list');
        await page.hardReload();
        await page.waitFor(`!!document.querySelector('#screen-title')`, 'the app after reload');
        await goTo(page, 'keep');
        const empty = await page.waitFor<string>(`(()=>{const t=${KEEP_LIST_TEXT};return t&&t.includes(${JSON.stringify(EN['keep.list.empty'])})?t:null})()`, 'the empty list after a reload');
        expect(!empty.includes(saved.name), `after the reload "${saved.name}" is listed again`);
        return `confirmation shown, "${saved.name}" removed, and the list says "${EN['keep.list.empty']}" after a hard reload`;
      },
    },
    {
      name: 'export 1-bit and 8-bit BMP, parse the header',
      async run() {
        const profile = ctx.profile;
        const picks = await chooseSample(page, 'diamond');
        await playToEnd(page, picks);
        const pattern = generateSample(profile, 'diamond');
        const ends = profile.hookRows * profile.hookColumns;
        const lines: string[] = [];
        const failures: string[] = [];
        await goTo(page, 'keep');
        for (const bitDepth of [1, 8] as const) {
          try {
            clearDownloads(ctx.downloadDir);
            await page.clickText('label span', EN[`keep.export.bitDepth.${bitDepth}`]!);
            await page.clickText('button', EN['keep.export.button']!);
            const file = await takeDownload(ctx.downloadDir);
            const parsed = parseBmpHeader(file.bytes);
            expect(parsed.ok, `${bitDepth}-bit: ${parsed.ok ? '' : parsed.reason}`);
            const problems = bmpMismatches(parsed.header, { width: ends, height: picks, bitsPerPixel: bitDepth });
            expect(problems.length === 0, `${bitDepth}-bit ${file.name}: ${problems.join('; ')}`);
            const expectedName = `${profile.name}-${bitDepth}bit.bmp`;
            expect(file.name === expectedName, `${bitDepth}-bit: file name is ${file.name}, expected ${expectedName}`);
            const back = readPatternBmp(file.bytes, profile, { ...DEFAULT_EXPORT_OPTIONS, bitDepth });
            expect(back.ok && JSON.stringify(back.pattern) === JSON.stringify(pattern), `${bitDepth}-bit: readPatternBmp does not give back the Diamond pattern`);
            const fresh = exportPatternBmp(profile, pattern, { ...DEFAULT_EXPORT_OPTIONS, bitDepth });
            expect(fresh.ok && Buffer.from(fresh.bytes).equals(Buffer.from(file.bytes)), `${bitDepth}-bit: the downloaded bytes differ from exportPatternBmp on the same pattern`);
            const h = parsed.header;
            lines.push(`${bitDepth}-bit ${file.name}: ${h.width} x ${h.height}, ${h.bitsPerPixel} bpp, ${h.colourCount} colours (${h.colourTableEntries} table entries), ${file.bytes.length} bytes = declared ${h.declaredFileSize}; pixels equal the Diamond pattern`);
          } catch (error) {
            failures.push(error instanceof Error ? error.message : String(error));
          }
        }
        if (failures.length > 0) throw new Error([...failures, ...lines].join('\n'));
        return lines.join('\n');
      },
    },
    {
      name: 'download the printable card PNG (Diamond)',
      async run() {
        await goTo(page, 'weave');
        clearDownloads(ctx.downloadDir);
        const group = `[...document.querySelectorAll('[role="group"]')].find(g=>g.getAttribute('aria-label')===${JSON.stringify(`${EN['tryit.diamond']}: ${EN['print.pick']}`)})`;
        const diamond = generateSample(ctx.profile, 'diamond');
        const punchedIn = (grid: CardGrid): number => grid.flat().filter(Boolean).length;
        let best = 0;
        for (const [index, grid] of diamond.entries()) if (punchedIn(grid) > punchedIn(diamond[best]!)) best = index;
        ctx.printedPickIndex = best;
        await page.waitFor(`(()=>{const i=(${group})?.querySelector('input[type="number"]');if(!i)return false;i.focus();i.select();return true})()`, 'the Diamond pick field');
        await page.cdp.call('Input.insertText', { text: String(best + 1) });
        await page.waitFor(`(${group})?.textContent.includes('(${best + 1} / ${diamond.length})')`, `the pick field to show ${best + 1}`);
        await page.click(`[...(${group})?.querySelectorAll('button')||[]].find(b=>b.textContent.trim()===${JSON.stringify(EN['print.png'])})`, 'the Diamond Download PNG button');
        const file = await takeDownload(ctx.downloadDir);
        const parsed = parsePngInfo(file.bytes);
        expect(parsed.ok, `the downloaded file is not a PNG: ${parsed.ok ? '' : parsed.reason}`);
        const { info } = parsed;
        const profile = ctx.profile;
        const widthPx = Math.round(profile.cardWidthMm * DEFAULT_PIXELS_PER_MM);
        const heightPx = Math.round(profile.cardHeightMm * DEFAULT_PIXELS_PER_MM);
        const pixelsPerMetre = DEFAULT_PIXELS_PER_MM * 1000;
        const problems: string[] = [];
        if (info.width !== widthPx || info.height !== heightPx) {
          problems.push(`size is ${info.width}x${info.height}, expected ${widthPx}x${heightPx} from the Card_Profile at ${DEFAULT_PIXELS_PER_MM} px/mm`);
        }
        if (widthPx !== 720 || heightPx !== 540) problems.push(`profile gives ${widthPx}x${heightPx} at 12 px/mm, not 720x540`);
        if (info.pHYsCount !== 1) problems.push(`${info.pHYsCount} pHYs chunks, expected 1`);
        if (
          info.density === null ||
          info.density.xPixelsPerMetre !== pixelsPerMetre ||
          info.density.yPixelsPerMetre !== pixelsPerMetre ||
          info.density.unit !== 1
        ) {
          problems.push(`pHYs is ${JSON.stringify(info.density)}, expected ${pixelsPerMetre} x ${pixelsPerMetre} per metre, unit 1`);
        }
        if (!info.crcsValid) problems.push('a chunk CRC is wrong');
        expect(problems.length === 0, `${file.name}: ${problems.join('; ')}`);
        const kept = path.join(ctx.tempDir, 'card.png');
        writeFileSync(kept, file.bytes);
        ctx.cardPng = kept;
        return `${file.name}: ${info.width}x${info.height}, pHYs ${info.density?.xPixelsPerMetre} x ${info.density?.yPixelsPerMetre} per metre (unit ${info.density?.unit}), CRCs valid, ${file.bytes.length} bytes`;
      },
    },
    {
      name: 'upload that PNG on Scan; the read grid equals the sample pick',
      async run() {
        const cardPng = need(ctx.cardPng, 'step 9 saved no PNG');
        await goTo(page, 'scan');
        await page.waitFor(`!!document.querySelector('#scan-file')`, 'the file input');
        await page.setFile('#scan-file', cardPng);
        const outcome = await page.waitFor<string>(
          `document.querySelectorAll('button[data-shape]').length>0?'read':(document.querySelector('[role="alert"]')?.textContent.trim()||null)`,
          'the read to finish',
          30_000,
        );
        expect(outcome === 'read', `the read failed with: ${outcome}`);
        const markers = await page.ev<{ shape: string; label: string }[]>(
          `[...document.querySelectorAll('button[data-shape]')].map(b=>({shape:b.dataset.shape,label:b.getAttribute('aria-label')||''}))`,
        );
        const { hookRows, hookColumns, endOrder } = ctx.profile;
        expect(markers.length === hookRows * hookColumns, `${markers.length} markers, expected ${hookRows * hookColumns}`);
        const expected: CardGrid = generateSample(ctx.profile, 'diamond')[ctx.printedPickIndex]!;
        // Each marker names its own hook row and column, so the read state of a hook comes from its accessible
        // name, never from its place in the document. The end index comes from the profile's endOrder
        // (card-geometry.md rule 5), never from a formula.
        const markerLabel = (hookRow: number, hookColumn: number, punched: boolean): string =>
          format(EN['scan.marker.name']!, {
            row: hookRow + 1,
            column: hookColumn + 1,
            state: EN[punched ? 'scan.marker.punched' : 'scan.marker.unpunched']!,
          });
        const shapeByLabel = new Map(markers.map((marker) => [marker.label, marker.shape]));
        const wrong: string[] = [];
        const inOrder: string[] = [];
        for (let hookRow = 0; hookRow < hookRows; hookRow++) {
          for (let hookColumn = 0; hookColumn < hookColumns; hookColumn++) {
            const punchedShape = shapeByLabel.get(markerLabel(hookRow, hookColumn, true));
            const unpunchedShape = shapeByLabel.get(markerLabel(hookRow, hookColumn, false));
            const end = endOrder[hookRow]![hookColumn]!;
            const where = `end ${end} (hook row ${hookRow + 1} column ${hookColumn + 1})`;
            if ((punchedShape === undefined) === (unpunchedShape === undefined)) {
              wrong.push(`${where} has no marker, or one for both states`);
              continue;
            }
            const read = punchedShape !== undefined;
            if ((read ? punchedShape : unpunchedShape) !== (read ? 'filled' : 'ring')) {
              wrong.push(`${where} is named "${read ? 'punched hole' : 'no punched hole'}" but drawn as ${read ? punchedShape : unpunchedShape}`);
            }
            if (read !== expected[hookRow]![hookColumn]) wrong.push(`${where} read ${read ? 'punched' : 'unpunched'}`);
            inOrder.push(markerLabel(hookRow, hookColumn, expected[hookRow]![hookColumn]!));
          }
        }
        expect(wrong.length === 0, `${wrong.length} of ${markers.length} hooks differ from Diamond pick ${ctx.printedPickIndex + 1}: ${wrong.slice(0, 8).join('; ')}`);
        // The arrow keys of R10.8 step through the markers in hook row-major order, so the document order must be that.
        const outOfOrder = markers.findIndex((marker, index) => marker.label !== inOrder[index]);
        expect(outOfOrder === -1, `marker ${outOfOrder + 1} in the document is "${markers[outOfOrder]?.label}", expected "${inOrder[outOfOrder]}"`);
        const corrected = await page.ev<number>(`document.querySelectorAll('button[data-corrected="true"]').length`);
        expect(corrected === 0, `${corrected} markers are marked as corrected before any tap`);
        const punched = expected.flat().filter(Boolean).length;
        expect(punched > 0 && punched < markers.length, `the printed pick has ${punched} punched holes, so it cannot tell a good read from a blank one`);
        await page.clickText('button', EN['scan.accept']!);
        await page.waitFor(`document.querySelectorAll('#scan-batch-title ~ ol > li').length===1`, 'one card in the batch');
        return `all ${markers.length} hooks (ends ${Math.min(...endOrder.flat())} to ${Math.max(...endOrder.flat())} from the profile's endOrder) equal Diamond pick ${ctx.printedPickIndex + 1} (${punched} punched, ${markers.length - punched} not); card accepted into the batch`;
      },
    },
    {
      name: 'blank image: peg holes not found, batch and pattern unchanged',
      async run() {
        const blank = path.join(ctx.tempDir, 'blank.png');
        // A blank image the size of the card from the Card_Profile, at the printable resolution.
        const blankWidthPx = Math.round(ctx.profile.cardWidthMm * DEFAULT_PIXELS_PER_MM);
        const blankHeightPx = Math.round(ctx.profile.cardHeightMm * DEFAULT_PIXELS_PER_MM);
        writeFileSync(blank, encodePngRgba(blankWidthPx, blankHeightPx, new Uint8Array(blankWidthPx * blankHeightPx * 4).fill(255)));
        const weaveSignature = async (): Promise<string> => {
          await goTo(page, 'weave');
          const shown = parsePick(await page.ev<string | null>(PICK_TEXT));
          if (shown !== null && shown.pick < shown.total) await playToEnd(page, shown.total, 60_000);
          const stats = await canvasStats(page);
          return `${await page.ev<string>(PICK_TEXT)} / ${stats.hash}`;
        };
        const before = await weaveSignature();
        await goTo(page, 'scan');
        const batchBefore = await page.ev<number>(`document.querySelectorAll('#scan-batch-title ~ ol > li').length`);
        await page.setFile('#scan-file', blank);
        const message = await page.waitFor<string>(`document.querySelector('[role="alert"]')?.textContent.trim()`, 'the failure message', 30_000);
        expect(message === EN['error.read.peg-holes-not-found'], `the message is "${message}", expected "${EN['error.read.peg-holes-not-found']}"`);
        const markers = await page.ev<number>(`document.querySelectorAll('button[data-shape]').length`);
        expect(markers === 0, `${markers} hook markers are shown after a blank image`);
        const batchAfter = await page.ev<number>(`document.querySelectorAll('#scan-batch-title ~ ol > li').length`);
        expect(batchAfter === batchBefore, `the batch went from ${batchBefore} to ${batchAfter} cards`);
        const after = await weaveSignature();
        expect(after === before, `the Weave pattern changed: "${before}" before, "${after}" after`);
        await goTo(page, 'scan');
        return `"${message}"; batch stays at ${batchAfter}; Weave stays "${after}"`;
      },
    },
    {
      name: 'no horizontal scroll at 320, 390 and 1280 px',
      async run() {
        // Put the widest content on Scan: a card read with its hook markers.
        const cardPng = need(ctx.cardPng, 'step 9 saved no PNG');
        await goTo(page, 'scan');
        await page.setFile('#scan-file', cardPng);
        await page.waitFor(`document.querySelectorAll('button[data-shape]').length>0`, 'the read card on Scan', 30_000);
        const lines: string[] = [];
        const failures: string[] = [];
        try {
          for (const width of [320, 390, 1280]) {
            await page.setViewport(width, 900);
            for (const screen of SCREENS) {
              await goTo(page, screen);
              await sleep(400);
              const measured = await page.ev<{ scrollWidth: number; innerWidth: number; offenders: string[] }>(
                `(()=>{const w=window.innerWidth;const off=[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>w+0.5&&e.getBoundingClientRect().width>0).slice(0,4).map(e=>e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.split(' ')[0]:'')+' right='+Math.round(e.getBoundingClientRect().right));return {scrollWidth:document.documentElement.scrollWidth,innerWidth:w,offenders:off}})()`,
              );
              await page.screenshot(path.join(repoRoot, 'media', 'check', `12-width-${width}-${screen}.png`));
              const verdict = `${screen} at ${width}: scrollWidth ${measured.scrollWidth}, innerWidth ${measured.innerWidth}`;
              if (measured.scrollWidth > measured.innerWidth) {
                failures.push(`${verdict} (wider: ${measured.offenders.join(', ') || 'unknown'})`);
              } else lines.push(verdict);
            }
          }
        } finally {
          await page.setViewport(900, 1000);
        }
        if (failures.length > 0) throw new Error([...failures.map((line) => `OVERFLOW ${line}`), ...lines].join('\n'));
        return lines.join('\n');
      },
    },
    {
      name: 'works with the network off',
      async run() {
        const { cdp } = page;
        const setOffline = (offline: boolean): Promise<unknown> => cdp.call('Network.emulateNetworkConditions', offlineConditions(offline));
        const pending = new Map<string, string>();
        const failedRequests: string[] = [];
        const offs = [
          cdp.on('Network.requestWillBeSent', (params) => {
            const request = params.request as { url?: string } | undefined;
            pending.set(String(params.requestId), request?.url ?? '?');
          }),
          cdp.on('Network.loadingFailed', (params) => {
            failedRequests.push(`${pending.get(String(params.requestId)) ?? '?'} -> ${String(params.errorText)}`);
          }),
        ];
        const run = async (name: string, fn: () => Promise<string>): Promise<OfflineCheck> => {
          try {
            return { name, status: 'pass', note: await fn() };
          } catch (error) {
            return { name, status: 'fail', note: error instanceof Error ? error.message : String(error) };
          }
        };
        const notRun = (name: string, why: string): OfflineCheck => ({ name, status: 'not-run', note: why });
        /**
         * The network is really off for the page: the browser says so, and a request for an address that is in
         * no cache fails. The profile is asked for too: it is precached, so it answers from the service worker
         * and shows that the cache, not the network, is what keeps the app working.
         */
        const confirmOffline = async (): Promise<string> => {
          const seen = await page.ev<{ onLine: boolean; probeFailed: boolean; probeError: string; profileOk: boolean }>(
            `(async()=>{const probe='./never-cached-'+Date.now()+'.txt';let probeFailed=false,probeError='';try{const r=await fetch(probe,{cache:'no-store'});probeError='HTTP '+r.status}catch(e){probeFailed=true;probeError=String(e)}let profileOk=false;try{const r=await fetch('./profiles/demo-12x16.json');profileOk=r.ok&&!!(await r.json()).name}catch(e){profileOk=false}return {onLine:navigator.onLine,probeFailed,probeError,profileOk}})()`,
          );
          expect(
            !seen.onLine && seen.probeFailed,
            `the network is not off for the page (navigator.onLine ${seen.onLine}, a request for an address in no cache ${seen.probeFailed ? 'failed' : `succeeded: ${seen.probeError}`})`,
          );
          expect(seen.profileOk, 'the card profile could not be read from the cache while the network was off');
          return `navigator.onLine false, a request for an uncached address failed (${seen.probeError}), the card profile came from the cache`;
        };
        /** The service worker that must serve the reload: it controls this page and its cache is in place. */
        const confirmWorker = async (): Promise<string> => {
          const seen = await page.waitFor<{ controlled: boolean; caches: string[]; precached: number }>(
            `(async()=>{if(!('serviceWorker' in navigator))return null;const r=await navigator.serviceWorker.ready.catch(()=>null);if(!r||!navigator.serviceWorker.controller)return null;const names=await caches.keys();const name=names.find(n=>n.startsWith('naqsha-'));if(!name)return null;const kept=await (await caches.open(name)).keys();return kept.length>0?{controlled:true,caches:names,precached:kept.length}:null})()`,
            'a service worker in control of the page with a filled cache',
            30_000,
          );
          return `controlled by the worker, caches ${seen.caches.join(', ')}, ${seen.precached} precached responses`;
        };
        /** What the worker's caches hold and what a match for each entry gives: the detail a failed check needs. */
        const cacheReport = async (): Promise<string> => {
          try {
            return await page.ev<string>(
              `(async()=>{const names=await caches.keys();const lines=[];for(const name of names){const cache=await caches.open(name);const keys=await cache.keys();lines.push(name+' holds '+keys.length+' responses');for(const key of keys){const hit=await cache.match(key.url);lines.push('  '+key.url+' [mode '+key.mode+', cache '+key.cache+'] -> '+(hit?('HTTP '+hit.status+', vary '+(hit.headers.get('vary')||'none')):'no match'))}}return lines.join('\\n')})()`,
            );
          } catch (error) {
            return `the caches could not be read: ${error instanceof Error ? error.message : String(error)}`;
          }
        };
        const languageSwitches = async (): Promise<string> => {
          await goTo(page, 'weave');
          await page.clickText('button', EN['language.en']!);
          await page.waitFor(`document.documentElement.lang==='en'`, 'lang en');
          await page.clickText('button', HI['language.hi']!);
          await page.waitFor(`document.documentElement.lang==='hi'`, 'lang hi');
          const hiHeading = await page.ev<string>(`document.querySelector('#screen-title')?.textContent.trim()`);
          await page.clickText('button', EN['language.en']!);
          await page.waitFor(`document.documentElement.lang==='en'`, 'lang back to en');
          const enHeading = await page.ev<string>(`document.querySelector('#screen-title')?.textContent.trim()`);
          expect(hiHeading === HI['nav.weave'], `Hindi heading is "${hiHeading}", expected "${HI['nav.weave']}"`);
          expect(enHeading === EN['nav.weave'], `English heading is "${enHeading}", expected "${EN['nav.weave']}"`);
          return `hi "${hiHeading}", back to en "${enHeading}"`;
        };
        const playDiamond = async (): Promise<string> => {
          const expected = await chooseSample(page, 'diamond');
          const seen = await playToEnd(page, expected);
          return `Diamond counter reached ${expected} of ${expected} (${seen.length} values seen)`;
        };
        /** Opening Scan for the first time on this page: its chunk must come from the cache, and then read a card. */
        const firstScanOpen = async (): Promise<string> => {
          const cardPng = need(ctx.cardPng, 'step 9 saved no PNG');
          const before = await page.ev<boolean>(`!!document.querySelector('#scan-file')`);
          expect(!before, 'the Scan screen was already open, so this is not the first open');
          await goTo(page, 'scan');
          await page.waitFor(`!!document.querySelector('#scan-file')`, 'the Scan screen chunk to arrive from the cache', 20_000);
          await page.setFile('#scan-file', cardPng);
          const outcome = await page.waitFor<string>(
            `document.querySelectorAll('button[data-shape]').length>0?'read':(document.querySelector('[role="alert"]')?.textContent.trim()||null)`,
            'the read to finish',
            30_000,
          );
          expect(outcome === 'read', `the read failed with: ${outcome}`);
          const shapes = await page.ev<string[]>(`[...document.querySelectorAll('button[data-shape]')].map(b=>b.dataset.shape)`);
          const expected = generateSample(ctx.profile, 'diamond')[ctx.printedPickIndex]!.flat();
          const wrong = expected.filter((punched, index) => (shapes[index] === 'filled') !== punched).length;
          expect(shapes.length === expected.length && wrong === 0, `${shapes.length} markers, ${wrong} differ from Diamond pick ${ctx.printedPickIndex + 1}`);
          return `the Scan chunk loaded with no network and all ${shapes.length} hooks equal Diamond pick ${ctx.printedPickIndex + 1}`;
        };
        const exportOneBitBmp = async (): Promise<string> => {
          const picks = generateSample(ctx.profile, 'diamond').length;
          const ends = ctx.profile.hookRows * ctx.profile.hookColumns;
          clearDownloads(ctx.downloadDir);
          await goTo(page, 'keep');
          await page.clickText('label span', EN['keep.export.bitDepth.1']!);
          await page.clickText('button', EN['keep.export.button']!);
          const file = await takeDownload(ctx.downloadDir);
          const parsed = parseBmpHeader(file.bytes);
          expect(parsed.ok, `not a BMP: ${parsed.ok ? '' : parsed.reason}`);
          const problems = bmpMismatches(parsed.header, { width: ends, height: picks, bitsPerPixel: 1 });
          expect(problems.length === 0, `${file.name}: ${problems.join('; ')}`);
          return `${file.name}: ${ends}x${picks}, 1 bit, ${file.bytes.length} bytes`;
        };
        const groups: OfflineGroup[] = [];
        try {
          await cdp.call('Network.enable');
          await cdp.call('Network.setCacheDisabled', { cacheDisabled: false });

          // The site is loaded online once, with a plain navigation: the hard reloads of steps 5 and 7 bypass
          // the service worker, so a page left by one of them is not controlled and could not be served from
          // the cache.
          await page.navigate(ctx.baseUrl);
          await page.waitFor(
            `[...document.querySelectorAll('button')].some(b=>(b.textContent.trim()===${JSON.stringify(EN['tryit.diamond'])}||b.textContent.trim()===${JSON.stringify(HI['tryit.diamond'])})&&!b.disabled)`,
            'the app to load online (Try it enabled)',
            20_000,
          );
          await goTo(page, 'weave');
          const worker = await run('a service worker controls the page before the network goes off', confirmWorker);

          // The network is taken away for real: Chrome is put offline and the preview server is stopped.
          // Chrome's network emulation does not reach the service worker's own requests, so without stopping
          // the server the worker could still answer from the network and the step would prove nothing.
          // Chrome's HTTP cache is left as it is: `Network.setCacheDisabled` makes requests bypass the service
          // worker as well, which would hide the very cache this step is about. What answers instead of the
          // HTTP cache is shown by the marker check below.
          await setOffline(true);
          await ctx.stopPreview();
          const serverGone = await run('the preview server is stopped, so no request can be answered from it', async () => {
            let answered = '';
            try {
              answered = `answered with HTTP ${(await fetch(ctx.baseUrl)).status}`;
            } catch (error) {
              answered = `refused the connection (${error instanceof Error ? error.message : String(error)})`;
            }
            expect(answered.startsWith('refused'), `${ctx.baseUrl} still ${answered}, so the server is still serving`);
            return `${ctx.baseUrl} ${answered}`;
          });
          const cacheAnswers = await run("the worker's cache, and not the network, is what answers a request", async () => {
            const body = `naqsha-cache-marker-${Date.now()}`;
            const seen = await page.ev<{ cache: string | null; body: string; removed: boolean }>(
              `(async()=>{const names=await caches.keys();const name=names.find(n=>n.startsWith('naqsha-'));if(!name)return {cache:null,body:'',removed:false};const cache=await caches.open(name);const url='./cache-only-probe.txt';await cache.put(url,new Response(${JSON.stringify(body)},{status:200}));let body='';try{body=await (await fetch(url)).text()}catch(e){body='fetch failed: '+e}const removed=await cache.delete(url);return {cache:name,body,removed}})()`,
            );
            expect(seen.cache !== null, 'the page has no naqsha cache to put a marker in');
            expect(
              seen.body === body,
              `a response put only in the cache ${seen.cache} came back as ${JSON.stringify(seen.body)}, expected ${JSON.stringify(body)}`,
            );
            return `a response put only in the cache ${seen.cache}, at an address the server never served, came back through fetch (and was removed again: ${seen.removed})`;
          });

          // A: the page stays as it is and the network goes away.
          const keepChecks: OfflineCheck[] = [worker, serverGone, cacheAnswers];
          keepChecks.push(await run('the network is really off', confirmOffline));
          keepChecks.push(await run('a Try it sample plays to its last pick', playDiamond));
          keepChecks.push(await run('language switching works', languageSwitches));
          keepChecks.push(await run('the first Scan open works offline', firstScanOpen));
          keepChecks.push(await run('a BMP export works offline', exportOneBitBmp));
          groups.push({ title: 'A. offline, no reload', checks: keepChecks });

          // B: reload with no network at all; everything must come from the worker's cache.
          const reloadChecks: OfflineCheck[] = [];
          const loaded = await run('the page reloads offline and the app is on screen', async () => {
            const done = new Promise<boolean>((resolve) => {
              const off = cdp.on('Page.loadEventFired', () => {
                off();
                resolve(true);
              });
              setTimeout(() => {
                off();
                resolve(false);
              }, 20_000);
            });
            await cdp.call('Page.reload', { ignoreCache: false });
            const fired = await done;
            const state = await page.ev<{ href: string; title: string; text: string; app: boolean }>(
              `({href:location.href,title:document.title,text:(document.body?.innerText||'').slice(0,160).replace(/\\s+/g,' '),app:!!document.querySelector('#screen-title')})`,
            );
            let app = state.app;
            if (!app && fired) {
              await sleep(1500);
              app = await page.ev<boolean>(`!!document.querySelector('#screen-title')`);
            }
            const failed = failedRequests.length === 0 ? 'none' : failedRequests.join(' | ');
            const held = app ? '' : `; ${await cacheReport()}`;
            expect(app, `the reloaded page has no app: load event ${fired ? 'fired' : 'did not fire in 20 s'}; location ${state.href}; title "${state.title}"; page text "${state.text}"; failed requests: ${failed}${held}`);
            return `app on screen at ${state.href}; failed requests: ${failed}`;
          });
          reloadChecks.push(loaded);
          const afterReload = [
            'the network is really off',
            'Weave renders',
            'a Try it sample plays to its last pick',
            'the first Scan open works offline',
            'a BMP export works offline',
            'language switching works',
          ] as const;
          if (loaded.status === 'pass') {
            reloadChecks.push(await run(afterReload[0], confirmOffline));
            reloadChecks.push(
              await run(afterReload[1], async () => {
                await goTo(page, 'weave');
                await page.waitFor(`!!document.querySelector('canvas')`, 'the cloth canvas', 10_000);
                return 'Weave screen with a canvas';
              }),
            );
            reloadChecks.push(await run(afterReload[2], playDiamond));
            reloadChecks.push(await run(afterReload[3], firstScanOpen));
            reloadChecks.push(await run(afterReload[4], exportOneBitBmp));
            reloadChecks.push(await run(afterReload[5], languageSwitches));
          } else {
            for (const name of afterReload) reloadChecks.push(notRun(name, 'not tested: the page did not load after the reload'));
          }
          groups.push({ title: 'B. offline, then reload the page', checks: reloadChecks });
        } finally {
          try {
            await setOffline(false);
          } catch {
            // Chrome is closed by the cleanup anyway
          }
          for (const off of offs) off();
        }
        const verdict = decideOffline(groups);
        const text = formatOffline(groups);
        if (!verdict.ok) throw new Error(text);
        return text;
      },
    },
  ];
}

function need<T>(value: T | null | undefined, reason: string): T {
  if (value === null || value === undefined) throw new Error(`cannot run: ${reason}`);
  return value;
}

const slug = (name: string): string => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------- main

async function main(): Promise<number> {
  const cleanups: Cleanup[] = [];
  const cleanUp = async (): Promise<void> => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        await cleanup();
      } catch (error) {
        console.error(`cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  };
  process.once('SIGINT', () => {
    void cleanUp().finally(() => process.exit(130));
  });
  try {
    const chrome = findChrome(process.platform, process.env, existsSync);
    if (!chrome.ok) {
      console.error(chrome.message);
      return 1;
    }
    if (!existsSync(path.join(repoRoot, 'dist', 'index.html'))) {
      console.log('dist/ is missing, so I am running `npm run build` first.');
      const built = spawnSync('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32' });
      if (built.status !== 0) {
        console.error('npm run build failed, so there is nothing to check.');
        return 1;
      }
    }
    const titleMatch = /<title>([^<]*)<\/title>/.exec(readFileSync(path.join(repoRoot, 'dist', 'index.html'), 'utf8'));
    expect(titleMatch !== null, 'dist/index.html has no <title>');
    const expectedTitle = titleMatch[1]!.trim();

    const shots = path.join(repoRoot, 'media', 'check');
    rmSync(shots, { recursive: true, force: true });
    mkdirSync(shots, { recursive: true });
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'naqsha-check-'));
    cleanups.push(async () => rmSync(tempDir, { recursive: true, force: true }));
    const downloadDir = path.join(tempDir, 'downloads');
    mkdirSync(downloadDir);

    const { url: baseUrl, stop: stopPreview } = await startPreview(cleanups);
    console.log(`preview: ${baseUrl}`);
    console.log(`chrome:  ${chrome.path}`);
    const { port } = await startChrome(chrome.path, cleanups);
    const cdp = await openPage(port);
    cleanups.push(async () => cdp.close());
    const page = new Page(cdp);
    await page.init(downloadDir);
    await page.navigate(baseUrl);

    const ctx: Context = {
      page,
      profile: await profileOf(),
      baseUrl,
      stopPreview,
      downloadDir,
      tempDir,
      expectedTitle,
      hashes: {},
      saved: null,
      cardPng: null,
      printedPickIndex: 0,
    };
    const steps = buildSteps(ctx);
    const errorsAfterLoad: string[] = [];
    let errorsSeen = 0;
    const results = await runBrowserSteps(steps, {
      after: async (result) => {
        await page.screenshot(path.join(shots, `${String(result.number).padStart(2, '0')}-${slug(result.name)}.png`));
        if (result.number === 1) errorsSeen = page.consoleErrors.length;
      },
      onResult: (result: BrowserResult) => console.log(formatResult(result)),
    });
    errorsAfterLoad.push(...page.consoleErrors.slice(errorsSeen));
    if (errorsAfterLoad.length > 0) {
      console.log(`\nINFO  ${errorsAfterLoad.length} console error(s) after step 1:\n${errorsAfterLoad.map((line) => `        ${line}`).join('\n')}`);
    }
    console.log(formatSummary(results));
    console.log(`screenshots: ${path.relative(repoRoot, shots)}/`);
    return exitCodeFor(results);
  } catch (error) {
    console.error(`check:browser could not run: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await cleanUp();
  }
}

process.exitCode = await main();
