/**
 * The Chrome and page plumbing shared by `scripts/check_browser.ts` and `scripts/screenshots.ts`:
 * the vite preview server, the Chrome launcher, the DevTools page wrapper and the small helpers they use.
 * Moved out of check_browser.ts with no change of behaviour.
 */
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { connectCdp } from './cdp.ts';
import type { CdpClient } from './cdp.ts';
import { chromeArgs, parseDevToolsActivePort } from './chrome.ts';
import { readVercelHeaders } from './headers.ts';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');

export const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Thrown by a step to say what was wrong. */
export function expect(condition: unknown, reason: string): asserts condition {
  if (!condition) throw new Error(reason);
}


// ---------------------------------------------------------------- the page

type Evaluated<T> = { result: { value: T }; exceptionDetails?: { text: string; exception?: { description?: string } } };

export class Page {
  readonly consoleErrors: string[] = [];
  /** Every Content-Security-Policy violation the page reported (the `securitypolicyviolation` event, or a "Refused to" message of the browser). */
  readonly cspViolations: string[] = [];
  readonly cdp: CdpClient;
  constructor(cdp: CdpClient) {
    this.cdp = cdp;
  }

  async init(downloadDir: string): Promise<void> {
    const { cdp } = this;
    cdp.on('Runtime.consoleAPICalled', (params) => {
      const args = Array.isArray(params.args) ? (params.args as { value?: unknown; description?: string }[]) : [];
      const said = args.map((a) => String(a.value ?? a.description ?? '')).join(' ');
      if (/Content Security Policy|Refused to/i.test(said)) this.cspViolations.push(`console.${String(params.type)}: ${said}`);
      if (params.type !== 'error' && params.type !== 'assert') return;
      this.consoleErrors.push(`console.${String(params.type)}: ${args.map((a) => String(a.value ?? a.description ?? '')).join(' ')}`);
    });
    cdp.on('Runtime.exceptionThrown', (params) => {
      const details = params.exceptionDetails as { text?: string; exception?: { description?: string } } | undefined;
      this.consoleErrors.push(`uncaught: ${details?.exception?.description ?? details?.text ?? 'exception'}`);
    });
    cdp.on('Runtime.bindingCalled', (params) => {
      if (params.name === 'naqshaCsp') this.cspViolations.push(String(params.payload));
    });
    cdp.on('Log.entryAdded', (params) => {
      const entry = params.entry as { level?: string; text?: string; url?: string } | undefined;
      if (entry !== undefined && /Content Security Policy|Refused to/i.test(entry.text ?? '')) this.cspViolations.push(`log: ${entry.text ?? ''} ${entry.url ?? ''}`.trim());
      if (entry?.level === 'error') this.consoleErrors.push(`log: ${entry.text ?? ''} ${entry.url ?? ''}`.trim());
    });
    await cdp.call('Page.enable');
    await cdp.call('Runtime.enable');
    // Every document, from its first script on, reports a policy violation through this binding. A script added
    // through the protocol is not itself subject to the page's policy.
    await cdp.call('Runtime.addBinding', { name: 'naqshaCsp' });
    await cdp.call('Page.addScriptToEvaluateOnNewDocument', {
      source: `document.addEventListener('securitypolicyviolation',e=>{window.naqshaCsp(e.violatedDirective+' blocked '+(e.blockedURI||'inline')+' at '+e.documentURI)},true)`,
    });
    await cdp.call('Log.enable');
    await cdp.call('DOM.enable');
    await cdp.call('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
    await this.setViewport(900, 1000);
  }

  /**
   * Sets the window size, then waits until the header has drawn the layout of that width. The header switches between its two
   * layouts in React, after the browser reports the media query, so for a moment the page still draws the old one: a Menu button
   * that is about to go (or one that is about to come) looks present (or absent) to the next step, which then clicks a button
   * that disappears or skips a menu it needed. A page with no header yet (a blank page, the first call) is not waited for.
   */
  async setViewport(width: number, height: number): Promise<void> {
    await this.cdp.call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await this.waitFor(
      `(()=>{const h=document.querySelector('header[data-narrow]');return !h||h.getAttribute('data-narrow')===${JSON.stringify(String(width < HEADER_WIDE_FROM_PX))}})()`,
      `the header to draw its ${width < HEADER_WIDE_FROM_PX ? 'narrow' : 'wide'} layout at ${width} px`,
      5_000,
    );
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

  /**
   * A real mouse click at the centre of the element the expression returns, once the element has held still: its box must be
   * the same at three reads 40 ms apart. The header changes size while the page scrolls or the width and language change (its
   * padding and the fonts move the Menu button), so a box read at one instant can be a few pixels from where the button is
   * when the mouse goes down.
   */
  async click(elementExpression: string, what: string): Promise<void> {
    const point = await this.waitFor<{ x: number; y: number }>(
      `new Promise(done=>{const e=${elementExpression};if(!e){done(null);return}e.scrollIntoView({block:'center'});let last='';let same=0;let reads=0;const read=()=>{const r=e.getBoundingClientRect();const key=[r.x,r.y,r.width,r.height].join();same=key===last?same+1:0;last=key;reads++;if(same>=2)done(r.width>0&&r.height>0?{x:r.x+r.width/2,y:r.y+r.height/2}:null);else if(reads>=25)done(null);else setTimeout(read,40)};read()})`,
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

  /** Clicks the element with this accessible name (its `aria-label`, else its text). */
  clickName(selector: string, name: string): Promise<void> {
    return this.click(byName(selector, name), `${selector} named "${name}"`);
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

/** The width from which the header draws its wide layout: the same number as `WIDE_QUERY` in src/ui/App.tsx (a test keeps the two equal). */
export const HEADER_WIDE_FROM_PX = 1024;
/** The element whose accessible name is `name`: its `aria-label`, else its text (the language segments are named in full and show "EN"). */
export const byName = (selector: string, name: string): string =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.getAttribute('aria-label')||e.textContent).trim()===${JSON.stringify(name)})`;
export const byText = (selector: string, text: string): string =>
  `[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)})`;

/**
 * Opens the menu of the header, found by its accessible name (`nav.menu` in the language the page shows, so pass the
 * name in each language), but only where the page draws it: under 1024 px the navigation, the language
 * switch and the theme switch sit in the sheet behind that button. Where the button is not drawn (the page is 1024 px
 * or wider) or the menu is open already, nothing is clicked, so a control that is always shown is never
 * reached through a menu. Call it before pressing any header control.
 */
export async function openHeaderMenu(page: Page, names: readonly string[]): Promise<void> {
  const control = `[...document.querySelectorAll('header button[aria-expanded][aria-controls]')].find(b=>${JSON.stringify(names)}.includes((b.getAttribute('aria-label')||b.textContent).trim()))`;
  const state = await page.ev<string>(`(()=>{const b=${control};if(!b||b.getClientRects().length===0)return 'absent';return b.getAttribute('aria-expanded')})()`);
  if (state !== 'false') return;
  await page.click(control, 'the header menu button');
  try {
    await page.waitFor(`(${control}).getAttribute('aria-expanded')==='true'`, 'the header menu to open');
  } catch (error) {
    // Say what the page looked like, so a miss of the click is told from a menu that closed itself.
    const seen = await page.ev<string>(
      `(()=>{const b=${control};if(!b)return 'no menu button';const r=b.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return JSON.stringify({scrollY:Math.round(scrollY),innerWidth,expanded:b.getAttribute('aria-expanded'),box:[r.x,r.y,r.width,r.height].map(Math.round),hit:hit?hit.tagName.toLowerCase()+(hit.className&&typeof hit.className==='string'?'.'+hit.className.split(' ')[0]:''):null,onButton:!!hit&&b.contains(hit)})})()`,
    ).catch(() => 'the page could not be read');
    throw new Error(`${error instanceof Error ? error.message : String(error)}; the page then: ${seen}`);
  }
}

/** Closes the menu of the header when the page draws its button and it is open (a capture then shows the page, not the menu over it). */
export async function closeHeaderMenu(page: Page, names: readonly string[]): Promise<void> {
  const control = `[...document.querySelectorAll('header button[aria-expanded][aria-controls]')].find(b=>${JSON.stringify(names)}.includes((b.getAttribute('aria-label')||b.textContent).trim()))`;
  const state = await page.ev<string>(`(()=>{const b=${control};if(!b||b.getClientRects().length===0)return 'absent';return b.getAttribute('aria-expanded')})()`);
  if (state !== 'true') return;
  await page.click(control, 'the header menu button');
  await page.waitFor(`(${control}).getAttribute('aria-expanded')==='false'`, 'the header menu to close');
}

// ---------------------------------------------------------------- servers and Chrome

export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => (typeof address === 'object' && address !== null ? resolve(address.port) : reject(new Error('no port'))));
    });
  });
}

export type Cleanup = () => Promise<void>;

export async function startPreview(cleanups: Cleanup[]): Promise<{ url: string; stop: () => Promise<void> }> {
  const { preview } = await import('vite');
  const port = await freePort();
  const server = await preview({
    root: repoRoot,
    logLevel: 'warn',
    // The headers of vercel.json, so the page runs under the policy it is deployed with.
    preview: { port, strictPort: true, host: '127.0.0.1', open: false, headers: readVercelHeaders(repoRoot) },
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

export async function startChrome(chromePath: string, cleanups: Cleanup[]): Promise<{ port: number }> {
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

export async function openPage(port: number): Promise<CdpClient> {
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
