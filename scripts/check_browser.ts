/**
 * `npm run check:browser`: drives a real headless Chrome over the DevTools protocol against `vite preview`
 * of the built `dist/`, and reports PASS or FAIL for each step (the last one, the network off, stops the server). Needs Chrome (set CHROME_PATH to choose one)
 * and a built `dist/` (it runs `npm run build` itself when `dist/` is missing).
 * Screenshots go to `media/check/` (git-ignored). Exit code is non-zero if any step failed.
 * The pure parts are in `scripts/checks/`: cdp.ts, chrome.ts, bmpHeader.ts, pngHeader.ts, report.ts.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseCardProfile } from '../src/codec/index.ts';
import type { CardGrid, CardProfile } from '../src/codec/index.ts';
import { DEFAULT_EXPORT_OPTIONS, exportPatternBmp, readPatternBmp } from '../src/exporter/index.ts';
import { DEFAULT_PIXELS_PER_MM } from '../src/ui/printable/raster.ts';
import { generateSample } from '../src/ui/samples/sampleDesigns.ts';
import { bmpMismatches, parseBmpHeader } from './checks/bmpHeader.ts';
import { findChrome } from './checks/chrome.ts';
import { parsePngInfo } from './checks/pngHeader.ts';
import { decideOffline, formatOffline, offlineConditions } from './checks/offline.ts';
import type { OfflineCheck, OfflineGroup } from './checks/offline.ts';
import { newPickWatch, stepPickWatch } from './checks/pickWatch.ts';
import { encodePngRgba } from './png_rgba.ts';
import { exitCodeFor, formatResult, formatSummary, runBrowserSteps } from './checks/report.ts';
import type { BrowserResult, BrowserStep } from './checks/report.ts';
import { Page, byText, expect, openPage, sleep, startChrome, startPreview } from './checks/session.ts';
import type { Cleanup } from './checks/session.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const readJson = (relative: string): unknown => JSON.parse(readFileSync(path.join(repoRoot, relative), 'utf8'));
const EN = readJson('src/ui/i18n/en.json') as Record<string, string>;
const HI: Record<string, string> = Object.fromEntries(
  Object.entries(readJson('src/ui/i18n/hi.json') as Record<string, { text: string }>).map(([key, entry]) => [key, entry.text]),
);
const DESIGNS = ['diamond', 'border', 'floral'] as const;
type Design = (typeof DESIGNS)[number];
const SCREENS = ['weave', 'keep', 'scan'] as const;
type Screen = (typeof SCREENS)[number];

function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

// ---------------------------------------------------------------- the page

// ---------------------------------------------------------------- page snippets

const PICK_PATTERN = format(
  EN['weave.pickPosition']!.replace(/[.*+?^$()|[\]\\]/g, '\\$&'),
  { pick: '(\\d+)', total: '(\\d+)' },
);
const PICK_TEXT = `(()=>{const p=[...document.querySelectorAll('p')].find(p=>new RegExp('^'+${JSON.stringify(PICK_PATTERN)}+'$').test(p.textContent.trim()));return p?p.textContent.trim():null})()`;
const CANVAS_STATS = `(()=>{const c=document.querySelector('canvas');if(!c)return null;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let opaque=0,h=2166136261;const colours=new Set();for(let i=0;i<d.length;i+=4){if(d[i+3]>0)opaque++;if(colours.size<64)colours.add((d[i]<<16)|(d[i+1]<<8)|d[i+2]);h=Math.imul(h^d[i],16777619);h=Math.imul(h^d[i+1],16777619);h=Math.imul(h^d[i+2],16777619);h=Math.imul(h^d[i+3],16777619)}return {width:c.width,height:c.height,opaque,colours:colours.size,hash:(h>>>0).toString(16)}})()`;

type CanvasStats = { width: number; height: number; opaque: number; colours: number; hash: string };

// ---------------------------------------------------------------- servers and Chrome

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

/** Clicks the navigation item whose text starts with the label: the Code view item also carries the word "Advanced". */
async function clickNavItem(page: Page, label: string): Promise<void> {
  await page.click(
    `[...document.querySelectorAll('nav button')].find(b=>b.textContent.trim().startsWith(${JSON.stringify(label)}))`,
    `nav button "${label}"`,
  );
}
/**
 * Opens the Disclosure whose accessible name is `name` when it is closed, and leaves it open when it is open already.
 * A Disclosure is a `button[aria-expanded][aria-controls]`; its accessible name is its `aria-label` or its text.
 * When no such button is on the page the step fails with a message that names the Disclosure.
 */
async function openDisclosure(page: Page, name: string): Promise<void> {
  const control = `[...document.querySelectorAll('button[aria-expanded][aria-controls]')].find(b=>(b.getAttribute('aria-label')||b.textContent).trim()===${JSON.stringify(name)})`;
  try {
    await page.waitFor(`!!(${control})`, `the Disclosure "${name}"`);
  } catch {
    throw new Error(`the Disclosure "${name}" was not found`);
  }
  if ((await page.ev<string>(`(${control}).getAttribute('aria-expanded')`)) === 'false') {
    await page.click(control, `the Disclosure "${name}"`);
  }
  await page.waitFor(`(${control}).getAttribute('aria-expanded')==='true'`, `the Disclosure "${name}" to open`);
}
/** Opens the Keep "More" Disclosure when it is closed; the export choices and the details other than the name are inside it. */
async function openMore(page: Page): Promise<void> {
  await openDisclosure(page, EN['disclosure.more']!);
}
async function goTo(page: Page, screen: Screen): Promise<void> {
  await ensureEnglish(page);
  await clickNavItem(page, EN[`nav.${screen}`]!);
  await page.waitFor(`document.querySelector('#screen-title')?.textContent.trim()===${JSON.stringify(EN[`nav.${screen}`])}`, `the ${screen} screen`);
}

// ---------------------------------------------------------------- language, theme and font helpers (Stage A)

const LANGUAGES = ['en', 'hi'] as const;
type Language = (typeof LANGUAGES)[number];
const THEMES = ['day', 'night'] as const;
type ThemeChoice = (typeof THEMES)[number];
/** The four Screens, the Code view included. */
const ALL_SCREENS = [...SCREENS, 'code'] as const;
type AnyScreen = (typeof ALL_SCREENS)[number];
const WORDS: Record<Language, Record<string, string>> = { en: EN, hi: HI };
/** The key of the text each Screen shows in its `#screen-title`. */
const HEADING_KEY: Record<AnyScreen, string> = { weave: 'nav.weave', keep: 'nav.keep', scan: 'nav.scan', code: 'codeview.title' };
const THEME_STORAGE_KEY = 'naqsha.theme';

async function ensureLanguage(page: Page, language: Language): Promise<void> {
  if ((await page.ev<string>('document.documentElement.lang')) !== language) await page.clickText('button', WORDS[language]['language.' + language]!);
  await page.waitFor(`document.documentElement.lang===${JSON.stringify(language)}`, `the page language to be ${language}`);
}

/** Opens one Screen through the navigation, in the given language. */
async function showScreen(page: Page, screen: AnyScreen, language: Language): Promise<void> {
  await ensureLanguage(page, language);
  await clickNavItem(page, WORDS[language][`nav.${screen}`]!);
  await page.waitFor(
    `document.querySelector('#screen-title')?.textContent.trim()===${JSON.stringify(WORDS[language][HEADING_KEY[screen]])}`,
    `the ${screen} screen in ${language}`,
  );
}

/** The Theme_Switch: a `role="switch"` whose accessible name starts with "Night loom" (or its Hindi text). */
const themeSwitch = (language: Language): string =>
  `[...document.querySelectorAll('[role="switch"]')].find(e=>(e.getAttribute('aria-label')||e.textContent||'').trim().startsWith(${JSON.stringify(WORDS[language]['theme.label'])}))`;

type ThemeReading = { dataTheme: string | null; stored: string | null; checked: string | null; switchFound: boolean };

function readTheme(page: Page, language: Language = 'en'): Promise<ThemeReading> {
  return page.ev<ThemeReading>(
    `(()=>{const s=${themeSwitch(language)};let stored=null;try{stored=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)})}catch(e){}return {dataTheme:document.documentElement.getAttribute('data-theme'),stored,checked:s?s.getAttribute('aria-checked'):null,switchFound:!!s}})()`,
  );
}

/** Puts the page in the given theme by pressing the Theme_Switch, never by setting `data-theme` directly. */
async function chooseTheme(page: Page, theme: ThemeChoice): Promise<void> {
  // The switch is found by its name in the language the page shows now.
  const language: Language = (await page.ev<string>('document.documentElement.lang')) === 'hi' ? 'hi' : 'en';
  const now = await readTheme(page, language);
  if (now.dataTheme !== theme) await page.click(themeSwitch(language), 'the Theme_Switch');
  await page.waitFor(`document.documentElement.getAttribute('data-theme')===${JSON.stringify(theme)}`, `data-theme to be ${theme}`);
}

type FontUse = { declared: number; used: { family: string; weight: number; status: string }[] };

/**
 * Every family and weight the visible text of the shown Screen uses, among the faces the style sheet declares,
 * with the loading status of the face that the browser picks for that weight.
 */
const FONT_USE = `(()=>{const faces=[...document.fonts].map(f=>({family:f.family.replace(/["']/g,''),weight:Number(f.weight),status:f.status}));const declared={};for(const f of faces){(declared[f.family]=declared[f.family]||[]).push(f.weight)}const pick=(list,w)=>{if(list.includes(w))return w;const up=list.filter(x=>x>w).sort((a,b)=>a-b),down=list.filter(x=>x<w).sort((a,b)=>b-a);return w>500?(up[0]??down[0]):(down[0]??up[0])};const used=new Map();for(const e of document.body.querySelectorAll('*')){if(![...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()!==''))continue;if(e.getClientRects().length===0)continue;const cs=getComputedStyle(e);if(cs.visibility==='hidden')continue;const family=cs.fontFamily.split(',')[0].trim().replace(/["']/g,'');const list=declared[family];if(!list)continue;const weight=pick(list,Number(cs.fontWeight)||400);used.set(family+' '+weight,{family,weight})}return {declared:faces.length,used:[...used.values()].map(u=>{const face=faces.find(f=>f.family===u.family&&f.weight===u.weight);return {family:u.family,weight:u.weight,status:face?face.status:'missing'}})}})()`;

/** Waits until every face the shown Screen uses reports `loaded`, and says which faces those are. */
async function usedFontsLoaded(page: Page, what: string): Promise<string[]> {
  const describe = (seen: FontUse): string[] => seen.used.map((face) => `${face.family} ${face.weight}`);
  try {
    const seen = await page.waitFor<FontUse>(
      `(()=>{const r=${FONT_USE};return r.used.length>0&&r.used.every(u=>u.status==='loaded')?r:null})()`,
      `every font the ${what} uses to report loaded`,
      10_000,
    );
    return describe(seen);
  } catch (error) {
    const seen = await page.ev<FontUse>(FONT_USE);
    const states = seen.used.map((face) => `${face.family} ${face.weight} is ${face.status}`);
    throw new Error(`${what}: ${error instanceof Error ? error.message : String(error)}; ${states.length === 0 ? 'no declared font is used by the visible text' : states.join(', ')}`);
  }
}

/** Opens each of the four Screens in both languages and checks that `document.fonts` reports `loaded` for every face the Screen uses. */
async function fontsLoadedOnEveryScreen(page: Page): Promise<string> {
  const faces = new Set<string>();
  let looked = 0;
  try {
    for (const language of LANGUAGES) {
      for (const screen of ALL_SCREENS) {
        await showScreen(page, screen, language);
        for (const face of await usedFontsLoaded(page, `${screen} screen in ${language}`)) faces.add(face);
        looked++;
      }
    }
  } finally {
    await ensureLanguage(page, 'en');
  }
  return `document.fonts reports loaded for every face used on ${looked} screens (${[...faces].sort().join(', ')})`;
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
  // The Landing tile and the Try it button of the player both carry data-sample; the tile's text also holds "Try it".
  await page.click(`document.querySelector('[data-sample="${design}"]')`, `the ${design} sample control`);
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

// ---------------------------------------------------------------- Landing, Disclosure and navigation checks (Stage B)

/** The size of the phone the Landing, the Disclosures and the primary Button are measured at (R8.10, R10.7, R23.7). */
const PHONE = { width: 390, height: 844 } as const;
/** The Landing's headline, Step_Strip and first Sample_Tile end within this many CSS pixels from the top (R8.10). */
const LANDING_LIMIT_PX = 700;

type KeyName = 'Enter' | 'Space' | 'Tab' | 'Escape';
const KEYS: Record<KeyName, { key: string; code: string; windowsVirtualKeyCode: number; text?: string }> = {
  Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' },
  Space: { key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' },
  Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 },
  Escape: { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 },
};
/** A real key press (down and up) on the focused element, so the browser's own default action runs (a button's click, the Tab move). */
async function pressKey(page: Page, name: KeyName): Promise<void> {
  const { text, ...key } = KEYS[name];
  await page.cdp.call('Input.dispatchKeyEvent', { type: text === undefined ? 'rawKeyDown' : 'keyDown', ...key, ...(text === undefined ? {} : { text }) });
  await page.cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
}
/** Focuses the element the expression returns without scrolling, and says whether it holds focus. */
async function focusElement(page: Page, elementExpression: string, what: string): Promise<void> {
  const focused = await page.ev<boolean>(`(()=>{const e=${elementExpression};if(!e)return false;e.focus({preventScroll:true});return document.activeElement===e})()`);
  expect(focused, `${what} could not take keyboard focus`);
}
/** Waits until the web fonts are ready and the layout has settled, so a measurement does not read a font that is still arriving. */
async function settleLayout(page: Page): Promise<void> {
  await page.ev<boolean>(`document.fonts.ready.then(()=>true)`);
  await sleep(400);
}

/** Every Disclosure control of the shown Screen. */
const DISCLOSURES = `[...document.querySelectorAll('main button[aria-expanded][aria-controls]')]`;
const panelOf = (control: string): string => `document.getElementById((${control}).getAttribute('aria-controls'))`;
const tabbablesOf = (panel: string): string =>
  `[...(${panel}).querySelectorAll('a[href],button,input,select,textarea,[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0)`;

type Box = { top: number; bottom: number; left: number; right: number; width: number; height: number };
const BOX = `(e=>{if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}})`;

/** The element that is the one primary Button of a Screen: the file chooser of Scan (while no card is read), otherwise the first element styled primary. */
const primaryOf = (screen: AnyScreen): string =>
  screen === 'scan'
    ? `document.querySelector('main label[data-emphasis="primary"] input[type="file"]')`
    : `document.querySelector('main [class*="_primary_"]')`;

/** Checks one Disclosure of a Screen: collapsed on arrival, toggled by Enter and Space, out of the Tab order while collapsed, Escape returns focus. */
async function checkDisclosure(page: Page, screen: AnyScreen, index: number): Promise<string> {
  const control = `${DISCLOSURES}[${index}]`;
  const panel = panelOf(control);
  const name = await page.ev<string>(`(${control}).textContent.trim()`);
  const where = `${screen} Disclosure "${name}"`;
  const expanded = (): Promise<string> => page.ev<string>(`(${control}).getAttribute('aria-expanded')`);
  const insidePanel = (): Promise<boolean> => page.ev<boolean>(`(${panel}).contains(document.activeElement)`);
  const toggle = async (key: KeyName, to: 'true' | 'false'): Promise<void> => {
    await focusElement(page, control, `the ${where} control`);
    await pressKey(page, key);
    await page.waitFor(`(${control}).getAttribute('aria-expanded')===${JSON.stringify(to)}`, `the ${where} to have aria-expanded ${to} after ${key}`, 3_000).catch(() => {
      throw new Error(`${where}: after ${key} aria-expanded is not ${to}`);
    });
  };

  // Collapsed on arrival, with its controls out of the Tab order and not drawn.
  expect((await expanded()) === 'false', `${where}: aria-expanded is "${await expanded()}" on arrival, expected "false"`);
  const closed = await page.ev<{ hidden: boolean; tabbable: number; drawn: number }>(
    `(()=>{const p=${panel};const t=${tabbablesOf(panel)};return {hidden:p.hidden,tabbable:t.length,drawn:t.filter(e=>e.getClientRects().length>0).length}})()`,
  );
  expect(closed.hidden && closed.drawn === 0, `${where}: collapsed, the panel is ${closed.hidden ? 'hidden' : 'not hidden'} and ${closed.drawn} of its ${closed.tabbable} controls are drawn`);
  await focusElement(page, control, `the ${where} control`);
  await pressKey(page, 'Tab');
  expect(!(await insidePanel()), `${where}: Tab from the collapsed control moved focus into its panel`);

  // Opening it leaves the primary Button in view, at the scroll position it had.
  await page.ev(`window.scrollTo(0,0)`);
  const primary = primaryOf(screen);
  const inView = async (): Promise<string | null> => {
    const seen = await page.ev<{ box: Box | null; scrollY: number; height: number }>(`({box:${BOX}(${primary}),scrollY:window.scrollY,height:window.innerHeight})`);
    if (seen.box === null) return 'there is no primary Button';
    if (seen.box.height <= 0) return 'the primary Button is not drawn';
    if (seen.box.top < 0 || seen.box.bottom > seen.height) return `the primary Button spans ${Math.round(seen.box.top)} to ${Math.round(seen.box.bottom)} of a ${seen.height} px viewport`;
    return null;
  };
  const before = await inView();
  expect(before === null, `${where}: before it opens, ${before}`);
  const scrollBefore = await page.ev<number>(`window.scrollY`);
  await toggle('Enter', 'true');
  const opened = await page.ev<{ hidden: boolean; scrollY: number; enabled: number }>(
    `(()=>{const p=${panel};return {hidden:p.hidden,scrollY:window.scrollY,enabled:${tabbablesOf(panel)}.filter(e=>e.getClientRects().length>0).length}})()`,
  );
  expect(!opened.hidden, `${where}: Enter opened it but its panel is still hidden`);
  expect(opened.scrollY === scrollBefore, `${where}: opening it moved the scroll position from ${scrollBefore} to ${opened.scrollY}`);
  const after = await inView();
  expect(after === null, `${where}: after it opens, ${after}`);
  // The panel's controls come directly after the Disclosure's own control in the Tab order (R10.9).
  if (opened.enabled > 0) {
    await focusElement(page, control, `the ${where} control`);
    await pressKey(page, 'Tab');
    expect(await insidePanel(), `${where}: Tab from the open control did not move focus to the first control of its panel`);
  }
  // Enter and Space both toggle it, each way.
  await toggle('Enter', 'false');
  await toggle('Space', 'true');
  await toggle('Space', 'false');
  // A collapse with focus on an inner control returns focus to the Disclosure's own control (R10.12).
  let focusReturn = 'its panel holds no control that can take focus';
  if (opened.enabled > 0) {
    await toggle('Enter', 'true');
    await focusElement(page, `${tabbablesOf(panel)}.find(e=>e.getClientRects().length>0)`, `the first control inside the ${where}`);
    await pressKey(page, 'Escape');
    await page.waitFor(`(${control}).getAttribute('aria-expanded')==='false'`, `the ${where} to collapse on Escape`, 3_000).catch(() => {
      throw new Error(`${where}: Escape inside its panel did not collapse it`);
    });
    const onControl = await page.ev<boolean>(`document.activeElement===(${control})`);
    expect(onControl, `${where}: after it collapsed with focus inside, focus is not on the Disclosure's own control`);
    focusReturn = 'focus returns to its control when it collapses from inside';
  }
  return `${where}: collapsed on arrival, ${closed.tabbable} controls out of the Tab order, Enter and Space toggle aria-expanded, the primary Button stays in view when it opens; ${focusReturn}`;
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
          `[...document.querySelectorAll('[data-sample="diamond"]')].some(b=>!b.disabled)`,
          'the card profile to load (Try it buttons enabled)',
        );
        await sleep(500);
        expect(page.consoleErrors.length === 0, `console errors on load:\n${page.consoleErrors.join('\n')}`);
        // The first install of the service worker is not an update: once it controls the page, no "newer Naqsha" notice shows.
        await page.waitFor(`navigator.serviceWorker.controller!==null`, 'the first service worker to take control of the page');
        await sleep(300);
        const notice = await page.ev<boolean>(
          `(()=>{const text=document.body.innerText;return ${JSON.stringify([EN['update.ready'], HI['update.ready']])}.some(m=>m&&text.includes(m))})()`,
        );
        expect(!notice, 'the "newer Naqsha is ready" notice is shown on a first visit');
        return `title "${title}", "${heading}" visible, Try it enabled, no console errors, no update notice on the first visit`;
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
        await openMore(page);
        await page.fillField(EN['keep.field.place']!, place);
        await page.clickText('button', EN['keep.save.button']!);
        const saved = await page.waitFor<string>(`document.getElementById('keep-saved')?.textContent.trim()`, 'the "Saved" message');
        expect(saved === format(EN['keep.saved']!, { name }), `saved message is "${saved}", expected "${format(EN['keep.saved']!, { name })}"`);
        const list = await page.waitFor<string>(`(()=>{const t=${KEEP_LIST_TEXT};return t&&t.includes(${JSON.stringify(name)})?t:null})()`, 'the design in the list');
        expect(list.includes(place) && list.includes(format(EN['keep.list.picks.other']!, { count: picks })), `the list row lacks the place or "${picks} picks":\n${list}`);
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
        await openMore(page);
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
          `document.querySelectorAll('button[data-shape]').length>0?'read':(document.querySelector('[data-variant="error"] > div')?.textContent.trim()||null)`,
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
        const message = await page.waitFor<string>(`document.querySelector('[data-variant="error"] > div')?.textContent.trim()`, 'the failure message', 30_000);
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
        // The Code view, Hindi and the Night loom are measured as well (R23.2, R7.7): 3 widths x 2 themes x 2 languages x 4 Screens.
        const startTheme = (await readTheme(page)).dataTheme === 'night' ? 'night' : 'day';
        try {
          for (const width of [320, 390, 1280]) {
            await page.setViewport(width, 900);
            for (const theme of THEMES) {
              await chooseTheme(page, theme);
              for (const language of LANGUAGES) {
                for (const screen of ALL_SCREENS) {
                  await showScreen(page, screen, language);
                  await sleep(400);
                  const measured = await page.ev<{ scrollWidth: number; innerWidth: number; offenders: string[] }>(
                    `(()=>{const w=window.innerWidth;const off=[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>w+0.5&&e.getBoundingClientRect().width>0).slice(0,4).map(e=>e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.split(' ')[0]:'')+' right='+Math.round(e.getBoundingClientRect().right));return {scrollWidth:document.documentElement.scrollWidth,innerWidth:w,offenders:off}})()`,
                  );
                  const original = language === 'en' && theme === 'day' && screen !== 'code';
                  const shotName = original ? `12-width-${width}-${screen}.png` : `12-width-${width}-${screen}-${language}-${theme}.png`;
                  await page.screenshot(path.join(repoRoot, 'media', 'check', shotName));
                  const verdict = `${screen} at ${width} (${language}, ${theme}): scrollWidth ${measured.scrollWidth}, innerWidth ${measured.innerWidth}`;
                  if (measured.scrollWidth > measured.innerWidth) {
                    failures.push(`${verdict} (wider: ${measured.offenders.join(', ') || 'unknown'})`);
                  } else lines.push(verdict);
                }
              }
            }
          }
        } finally {
          await page.setViewport(900, 1000);
          try {
            await ensureLanguage(page, 'en');
            await chooseTheme(page, startTheme);
          } catch (error) {
            failures.push(`could not put the page back in English and the ${startTheme} theme: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        if (failures.length > 0) throw new Error([...failures.map((line) => `OVERFLOW ${line}`), ...lines].join('\n'));
        return lines.join('\n');
      },
    },
    {
      name: 'theme switch: data-theme and localStorage survive a reload',
      async run() {
        await ensureEnglish(page);
        await page.waitFor(`!!${themeSwitch('en')}`, 'the Theme_Switch (a role="switch" named "Night loom")');
        const start = await readTheme(page);
        expect(start.dataTheme === 'day' || start.dataTheme === 'night', `data-theme is ${JSON.stringify(start.dataTheme)} at the start, expected day or night`);
        const first: ThemeChoice = start.dataTheme === 'night' ? 'day' : 'night';
        const lines: string[] = [`start: data-theme ${start.dataTheme}, aria-checked ${start.checked}`];
        const headingOf = (): Promise<string> => page.ev<string>(`document.querySelector('#screen-title')?.textContent.trim()`);
        // Press the switch to the other theme, reload, press it back, reload: each reload must show the stored choice.
        for (const target of [first, start.dataTheme as ThemeChoice]) {
          // A reload starts on Weave again, so the Screen is read again before each press.
          const headingBefore = await headingOf();
          await chooseTheme(page, target);
          const pressed = await readTheme(page);
          expect(pressed.dataTheme === target, `after pressing the switch data-theme is ${JSON.stringify(pressed.dataTheme)}, expected ${target}`);
          expect(pressed.stored === target, `after pressing the switch localStorage ${THEME_STORAGE_KEY} is ${JSON.stringify(pressed.stored)}, expected the text ${target}`);
          expect(pressed.checked === String(target === 'night'), `after pressing the switch aria-checked is ${pressed.checked}, expected ${target === 'night'}`);
          expect((await headingOf()) === headingBefore, 'pressing the switch changed the Screen');
          await page.hardReload();
          await page.waitFor(`!!document.querySelector('#screen-title')`, 'the app after the reload');
          await ensureEnglish(page);
          const reloaded = await readTheme(page);
          expect(reloaded.dataTheme === target, `after a reload data-theme is ${JSON.stringify(reloaded.dataTheme)}, expected ${target}`);
          expect(reloaded.stored === target, `after a reload localStorage ${THEME_STORAGE_KEY} is ${JSON.stringify(reloaded.stored)}, expected the text ${target}`);
          expect(reloaded.checked === String(target === 'night'), `after a reload aria-checked is ${reloaded.checked}, expected ${target === 'night'}`);
          lines.push(`${target}: pressed, then reloaded: data-theme ${reloaded.dataTheme}, localStorage "${reloaded.stored}", aria-checked ${reloaded.checked}`);
        }
        return lines.join('\n');
      },
    },
    {
      name: 'network log: own origin only, and no image request but the favicon and manifest icons',
      async run() {
        const { cdp } = page;
        const base = new URL(ctx.baseUrl);
        const manifest = readJson('public/manifest.webmanifest') as { icons?: { src: string }[] };
        const allowedImages = new Set(
          ['./favicon.svg', ...(manifest.icons ?? []).map((icon) => icon.src)].map((file) => new URL(file, base).href),
        );
        const imageName = /\.(svg|png|jpe?g|gif|webp|ico)$/i;
        const requests: { url: string; type: string }[] = [];
        await cdp.call('Network.enable');
        const stop = cdp.on('Network.requestWillBeSent', (params) => {
          const request = params.request as { url?: string } | undefined;
          requests.push({ url: request?.url ?? '', type: typeof params.type === 'string' ? params.type : '' });
        });
        const startTheme = (await readTheme(page)).dataTheme === 'night' ? 'night' : 'day';
        const combinations: string[] = [];
        try {
          for (const theme of THEMES) {
            for (const language of LANGUAGES) {
              // A fresh load each time, so the fonts, the style sheet and the Screen chunks are asked for again.
              await page.hardReload();
              await page.waitFor(`!!document.querySelector('#screen-title')`, 'the app after the reload');
              await chooseTheme(page, theme);
              await ensureLanguage(page, language);
              for (const screen of ALL_SCREENS) await showScreen(page, screen, language);
              combinations.push(`${language}/${theme}`);
            }
          }
        } finally {
          stop();
          try {
            await ensureLanguage(page, 'en');
            await chooseTheme(page, startTheme);
          } catch {
            // the problems below are what matters
          }
          await cdp.call('Network.disable').catch(() => undefined);
        }
        const problems: string[] = [];
        const origins = new Set<string>();
        let images = 0;
        let fonts = 0;
        for (const { url, type } of requests) {
          let parsed: URL;
          try {
            parsed = new URL(url);
          } catch {
            problems.push(`a request for an address that is not a URL: ${url}`);
            continue;
          }
          // data: and blob: addresses carry their content and make no network request.
          if (parsed.protocol === 'data:' || parsed.protocol === 'blob:' || parsed.protocol === 'about:') continue;
          origins.add(parsed.origin);
          if (parsed.origin !== base.origin) problems.push(`${type || 'request'} to another origin: ${url}`);
          if (type === 'Font') fonts++;
          if (type === 'Image' || imageName.test(parsed.pathname)) {
            images++;
            if (!allowedImages.has(parsed.href)) problems.push(`an image request that is neither the favicon nor a manifest icon: ${url}`);
          }
        }
        expect(requests.length > 0 && fonts > 0, `the log holds ${requests.length} requests and ${fonts} font requests, so it did not see the page load`);
        expect(problems.length === 0, [...new Set(problems)].join('\n'));
        return `${requests.length} requests over ${combinations.join(', ')} on all four Screens; origins: ${[...origins].join(', ')}; ${fonts} font requests; ${images} image requests, all the favicon or a manifest icon`;
      },
    },
    {
      name: 'Landing: headline, steps and first tile within 700 px at 390 by 844, one primary Button, a tile starts a sample',
      async run() {
        const lines: string[] = [];
        try {
          // A reload empties the Current_Pattern, so the Weave screen shows the Landing.
          await page.hardReload();
          await page.waitFor(`!!document.querySelector('#screen-title')`, 'the app after the reload');
          await page.setViewport(PHONE.width, PHONE.height);
          for (const language of LANGUAGES) {
            await showScreen(page, 'weave', language);
            await page.waitFor(`!!document.querySelector('[data-hero-slot]')&&document.querySelectorAll('main [data-sample]').length===3`, `the Landing with its three Sample_Tiles in ${language}`);
            await settleLayout(page);
            const words = WORDS[language];
            const seen = await page.ev<{ scrollY: number; headline: Box | null; strip: Box | null; tile: Box | null; primaries: string[]; secondaries: number; firstIsPrimary: boolean }>(
              `(()=>{window.scrollTo(0,0);const box=${BOX};const m=document.querySelector('main');const heading=[...m.querySelectorAll('h1,h2,h3')].find(e=>e.textContent.trim()===${JSON.stringify(words['landing.headline'])});const strip=m.querySelector('ol[aria-label='+${JSON.stringify(JSON.stringify(words['landing.steps.name']))}+']');const tiles=[...m.querySelectorAll('[data-sample]')];const primaries=[...m.querySelectorAll('[class*="_primary_"]')];return {scrollY:window.scrollY,headline:box(heading),strip:box(strip),tile:box(tiles[0]),primaries:primaries.map(e=>e.tagName.toLowerCase()+(e.dataset.sample?'[data-sample='+e.dataset.sample+']':'')),secondaries:tiles.slice(1).filter(e=>/_secondary_/.test(e.className)).length,firstIsPrimary:primaries.length===1&&primaries[0]===tiles[0]}})()`,
            );
            for (const [label, box] of [['headline', seen.headline], ['Step_Strip', seen.strip], ['first Sample_Tile', seen.tile]] as const) {
              expect(box !== null && box.height > 0, `${language}: the Landing ${label} is not on the page`);
              expect(box.top >= 0 && box.bottom <= LANDING_LIMIT_PX, `${language}: the Landing ${label} spans ${Math.round(box.top)} to ${Math.round(box.bottom)} px, expected to end within ${LANDING_LIMIT_PX} px at ${PHONE.width} by ${PHONE.height}`);
            }
            expect(seen.primaries.length === 1, `${language}: the Landing has ${seen.primaries.length} primary Buttons (${seen.primaries.join(', ') || 'none'}), expected exactly 1`);
            expect(seen.firstIsPrimary, `${language}: the one primary Button of the Landing is ${seen.primaries[0]}, expected the first Sample_Tile`);
            expect(seen.secondaries === 2, `${language}: ${seen.secondaries} of the other two Sample_Tiles are styled secondary, expected 2`);
            lines.push(
              `${language}: headline ends at ${Math.round(seen.headline!.bottom)}, Step_Strip at ${Math.round(seen.strip!.bottom)}, first tile at ${Math.round(seen.tile!.bottom)} px (limit ${LANDING_LIMIT_PX}); one primary Button, the first tile`,
            );
          }
          // A tile starts its sample: the Landing goes and the first pick plays.
          await ensureLanguage(page, 'en');
          const design = await page.ev<string>(`document.querySelector('main [data-sample]').dataset.sample`);
          expect((DESIGNS as readonly string[]).includes(design), `the first Sample_Tile is "${design}", not a Sample_Design`);
          const total = generateSample(ctx.profile, design as Design).length;
          const started = Date.now();
          await page.click(`document.querySelector('main [data-sample]')`, 'the first Sample_Tile');
          await page.waitFor(`!!(${PICK_TEXT})`, 'the pick counter after choosing a tile', 5_000);
          const shownAfter = Date.now() - started;
          const landingGone = await page.ev<boolean>(`!document.querySelector('[data-hero-slot]')`);
          expect(landingGone, 'the Landing is still shown after a Sample_Tile was chosen');
          const seen = await playToEnd(page, total);
          expect(seen.length >= 3 && seen.every((value, index) => index === 0 || value > seen[index - 1]!), `the pick counter did not advance after a tile was chosen (values seen: ${seen.join(', ')})`);
          lines.push(`the first tile (${design}) replaced the Landing with the player ${shownAfter} ms after the click; the counter went ${seen[0]} -> ${total} of ${total}`);
        } finally {
          await page.setViewport(900, 1000);
          await ensureLanguage(page, 'en');
        }
        return lines.join('\n');
      },
    },
    {
      name: 'Disclosures: collapsed on arrival, Enter and Space toggle, out of the Tab order, focus returns, primary Button stays in view',
      async run() {
        const lines: string[] = [];
        const failures: string[] = [];
        try {
          await page.setViewport(PHONE.width, PHONE.height);
          for (const screen of ['weave', 'keep', 'scan'] as const) {
            // Leave and come back, so the Screen mounts again and its Disclosures are collapsed (R10.6).
            await showScreen(page, 'code', 'en');
            await showScreen(page, screen, 'en');
            await page.waitFor(`${DISCLOSURES}.length>0`, `a Disclosure on the ${screen} screen`);
            await settleLayout(page);
            const count = await page.ev<number>(`${DISCLOSURES}.length`);
            for (let index = 0; index < count; index++) {
              try {
                lines.push(await checkDisclosure(page, screen, index));
              } catch (error) {
                failures.push(error instanceof Error ? error.message : String(error));
              }
              // The next Disclosure is checked on a Screen that has just arrived.
              await showScreen(page, 'code', 'en');
              await showScreen(page, screen, 'en');
              await page.waitFor(`${DISCLOSURES}.length===${count}`, `the ${count} Disclosures of the ${screen} screen`);
              await settleLayout(page);
            }
          }
        } finally {
          await page.setViewport(900, 1000);
        }
        if (failures.length > 0) throw new Error([...failures.map((line) => `FAIL ${line}`), ...lines].join('\n'));
        return lines.join('\n');
      },
    },
    {
      name: 'navigation: aria-current on the current item, and no clipped label at 320 px in English and Hindi',
      async run() {
        const lines: string[] = [];
        const failures: string[] = [];
        const startTheme = (await readTheme(page)).dataTheme === 'night' ? 'night' : 'day';
        try {
          await page.setViewport(900, 1000);
          for (const screen of ALL_SCREENS) {
            await showScreen(page, screen, 'en');
            // Every item that carries aria-current at all, with its value: only the current one may, and the value is "page".
            const marked = await page.ev<{ current: string[]; items: number }>(
              `(()=>{const items=[...document.querySelectorAll('nav button')];return {current:items.filter(b=>b.hasAttribute('aria-current')).map(b=>b.textContent.trim()+'='+b.getAttribute('aria-current')),items:items.length}})()`,
            );
            const label = WORDS.en[`nav.${screen}`]!;
            if (marked.current.length !== 1 || !marked.current[0]!.startsWith(label) || !marked.current[0]!.endsWith('=page') || marked.items !== 4) {
              failures.push(`on the ${screen} screen aria-current is on [${marked.current.join(', ')}] of ${marked.items} items, expected only the "${label}" item, with the value "page", of 4`);
            } else lines.push(`${screen}: only the "${label}" item has aria-current="page"`);
          }
          await page.setViewport(320, 700);
          for (const theme of THEMES) {
            await chooseTheme(page, theme);
            for (const language of LANGUAGES) {
              await showScreen(page, 'weave', language);
              await settleLayout(page);
              const result = await page.ev<{ count: number; problems: string[] }>(
                `(()=>{const controls=[...document.querySelectorAll('header nav button,header [role="group"] button,header [role="switch"]')];const vw=window.innerWidth;const problems=[];const rects=controls.map(c=>c.getBoundingClientRect());controls.forEach((c,i)=>{const name=(c.getAttribute('aria-label')||c.textContent).trim();const r=rects[i];if(c.scrollWidth>c.clientWidth+1||c.scrollHeight>c.clientHeight+1)problems.push('"'+name+'" scrolls '+c.scrollWidth+'x'+c.scrollHeight+' in '+c.clientWidth+'x'+c.clientHeight);const walker=document.createTreeWalker(c,NodeFilter.SHOW_TEXT);for(let n=walker.nextNode();n;n=walker.nextNode()){if(!n.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(n);for(const t of range.getClientRects()){if(t.left<r.left-1||t.right>r.right+1||t.top<r.top-1||t.bottom>r.bottom+1||t.left<-0.5||t.right>vw+0.5){problems.push('the text "'+n.textContent.trim()+'" of "'+name+'" is outside its control');break}}}});for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){const a=rects[i],b=rects[j];if(a.left<b.right-0.5&&b.left<a.right-0.5&&a.top<b.bottom-0.5&&b.top<a.bottom-0.5)problems.push('"'+(controls[i].getAttribute('aria-label')||controls[i].textContent).trim()+'" overlaps "'+(controls[j].getAttribute('aria-label')||controls[j].textContent).trim()+'"')}return {count:controls.length,problems}})()`,
              );
              const verdict = `at 320 (${language}, ${theme}): ${result.count} header controls`;
              if (result.count !== 7) failures.push(`${verdict}, expected 7 (4 navigation items, 2 languages, the Theme_Switch)`);
              else if (result.problems.length > 0) failures.push(`${verdict}: ${result.problems.join('; ')}`);
              else lines.push(`${verdict}: every label inside its control, no overlap`);
            }
          }
        } finally {
          await page.setViewport(900, 1000);
          try {
            await ensureLanguage(page, 'en');
            await chooseTheme(page, startTheme);
          } catch (error) {
            failures.push(`could not put the page back in English and the ${startTheme} theme: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        if (failures.length > 0) throw new Error([...failures.map((line) => `FAIL ${line}`), ...lines].join('\n'));
        return lines.join('\n');
      },
    },
    {
      name: 'the primary Button of each Screen is within the first 844 px at 390 by 844',
      async run() {
        const lines: string[] = [];
        const failures: string[] = [];
        try {
          await page.setViewport(PHONE.width, PHONE.height);
          for (const language of LANGUAGES) {
            for (const screen of ALL_SCREENS) {
              await showScreen(page, screen, language);
              try {
                await page.waitFor(`!!(${primaryOf(screen)})`, `the primary Button of the ${screen} screen`);
              } catch (error) {
                failures.push(`${screen} (${language}): ${error instanceof Error ? error.message : String(error)}`);
                continue;
              }
              await settleLayout(page);
              const seen = await page.ev<{ box: Box; scrollY: number; hidden: boolean; name: string }>(
                `(()=>{window.scrollTo(0,0);const e=${primaryOf(screen)};const r=e.getBoundingClientRect();return {box:{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height},scrollY:window.scrollY,hidden:!!e.closest('[hidden]'),name:(e.getAttribute('aria-label')||e.textContent||e.id).trim()}})()`,
              );
              const verdict = `${screen} (${language}): the primary Button "${seen.name}"`;
              if (seen.hidden || seen.box.height <= 0) failures.push(`${verdict} is hidden or in a collapsed Disclosure`);
              else if (seen.box.top < 0 || seen.box.bottom + seen.scrollY > PHONE.height) {
                failures.push(`${verdict} spans ${Math.round(seen.box.top)} to ${Math.round(seen.box.bottom)} px, expected to end within the first ${PHONE.height} px`);
              } else lines.push(`${verdict} ends at ${Math.round(seen.box.bottom)} px`);
            }
          }
        } finally {
          await page.setViewport(900, 1000);
          await ensureLanguage(page, 'en');
        }
        if (failures.length > 0) throw new Error([...failures.map((line) => `FAIL ${line}`), ...lines].join('\n'));
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
            `document.querySelectorAll('button[data-shape]').length>0?'read':(document.querySelector('[data-variant="error"] > div')?.textContent.trim()||null)`,
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
          await openMore(page);
          await page.clickText('label span', EN['keep.export.bitDepth.1']!);
          await page.clickText('button', EN['keep.export.button']!);
          const file = await takeDownload(ctx.downloadDir);
          const parsed = parseBmpHeader(file.bytes);
          expect(parsed.ok, `not a BMP: ${parsed.ok ? '' : parsed.reason}`);
          const problems = bmpMismatches(parsed.header, { width: ends, height: picks, bitsPerPixel: 1 });
          expect(problems.length === 0, `${file.name}: ${problems.join('; ')}`);
          return `${file.name}: ${ends}x${picks}, 1 bit, ${file.bytes.length} bytes`;
        };
        /** R1.10: with the network off, `document.fonts` reports loaded for every face the shown Screens use, and no font request failed. */
        const fontsLoaded = async (): Promise<string> => {
          const note = await fontsLoadedOnEveryScreen(page);
          const failedFonts = failedRequests.filter((line) => line.includes('/fonts/'));
          expect(failedFonts.length === 0, `font requests failed: ${failedFonts.join(' | ')}`);
          return `${note}; no font request failed`;
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
            `[...document.querySelectorAll('[data-sample="diamond"]')].some(b=>!b.disabled)`,
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
          keepChecks.push(await run('every font the shown Screens use is loaded', fontsLoaded));
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
            'every font the shown Screens use is loaded',
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
            reloadChecks.push(await run(afterReload[6], fontsLoaded));
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
