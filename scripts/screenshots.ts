/**
 * `npm run screenshots -- before` or `npm run screenshots -- after`: takes the 24 full-page screenshots of the design
 * pass (six views, Day and Night, 320 and 1280 CSS pixels wide) with headless Chrome over the DevTools protocol, from
 * the built `dist/` served by `vite preview`. Files go to `media/design/before/` or `media/design/after/`.
 *
 * `npm run screenshots -- after-run1` takes the second set: four full-page views of the Landing (`landing-full-<theme>-<width>.png`,
 * Day and Night, 390 and 1280 CSS pixels wide) into `media/design/after-run1/`, with the Theme_Switch like `after`. Like the other
 * modes it emulates prefers-reduced-motion: reduce, so the Process_Loop in the hero shows its one still frame (the finished cloth,
 * the punched holes lit, the hooks lifted) and every capture is the same each time, and the scroll reveal shows every block at once. The
 * reveal itself is covered by its unit tests (tests/ui/components/reveal.test.tsx). The script still scrolls from the top to the bottom of
 * the page and back, waits until every picture is decoded and no block is waiting to be revealed, and only then takes the picture.
 *
 * `npm run screenshots -- after-run2` takes the run 2 set into `media/design/after-run2/`, part by part: the header views
 * (`header-closed`, `header-closed-hi`, `header-menu`, `header-menu-hi`, each `<view>-<theme>-<width>.png`, cropped to the top 700 px)
 * and the full-page Weave views (`weave-sample`, `weave-lost`) at 390 and 1280 px,
 * with `--view <name>` to take one view. The theme, the language and the menu are all pressed by accessible name, and motion is reduced.
 *
 * `npm run screenshots -- after-run3` takes the Demo cards set into `media/design/after-run3/`: the Scan, Keep, Code view and Weave screens
 * (`scan-demo`, `keep-demo`, `code-demo`, `weave-demo`) full-page in the Day loom at 390 and 1280 px, named `<view>-day-<width>.png`.
 * Each screen is shown after pressing its own Demo cards (Keep saves a demo design and an edit, Code loads the Diamond with a
 * breakpoint, Weave shows a lost card), so the page is not empty.
 *
 * Options for working on the script itself: `--out <directory>` writes somewhere else, `--view <name>` (repeatable)
 * takes only that view and ignores the missing files of the others when it checks the set.
 *
 * Needs Chrome (set CHROME_PATH to choose one) and a built `dist/` (`npm run build`). Exit code is non-zero when
 * any file is missing, failed or not a valid PNG of the right width; every file already saved is kept.
 * The pure parts (the 24 names and the checks on a saved set) are in `scripts/checks/screenshots.ts`; the Chrome
 * plumbing is in `scripts/checks/session.ts`.
 *
 * How the theme is chosen. Mode `before`: no Theme_Switch exists, so the script sets `data-theme` to `night` for the
 * Night_Loom files and leaves it unset for the Day_Loom files. Mode `after`: the script activates the Theme_Switch,
 * found by its accessible name, and never sets the attribute itself.
 *
 * Each page is prepared on a fresh load with its saved data cleared, and each preparation ends by waiting for a named
 * element, never for a fixed time. Reduced motion is emulated before the first navigation, so a cloth is shown
 * finished at once and every capture is the same each time.
 */
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findChrome } from './checks/chrome.ts';
import {
  RUN2_FOLDER,
  RUN3_FOLDER,
  RUN3_THEME,
  RUN3_VIEWS,
  RUN3_WIDTHS,
  RUN2_VIEWS,
  LANDING_FULL_FOLDER,
  LANDING_FULL_VIEW,
  LANDING_FULL_WIDTHS,
  SCREENSHOT_THEMES,
  SCREENSHOT_VIEWS,
  SCREENSHOT_WIDTHS,
  landingFullNames,
  landingFullProblems,
  run2Names,
  run2Problems,
  run3Names,
  run3Problems,
  screenshotNames,
  setProblems,
} from './checks/screenshots.ts';
import { Page, byName, byText, closeHeaderMenu, openHeaderMenu, openPage, startChrome, startPreview } from './checks/session.ts';
import type { Cleanup } from './checks/session.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const EN = JSON.parse(readFileSync(path.join(repoRoot, 'src', 'ui', 'i18n', 'en.json'), 'utf8')) as Record<string, string>;

type Mode = 'before' | 'after' | 'after-run1' | 'after-run2' | 'after-run3';
type View = (typeof SCREENSHOT_VIEWS)[number];
type Theme = (typeof SCREENSHOT_THEMES)[number];
type Screen = 'weave' | 'keep' | 'scan' | 'code';
type Design = 'diamond' | 'border' | 'floral';

/** Height of the emulated window; a capture is taller when the page is. */
const WINDOW_HEIGHT = 800;
const HI = JSON.parse(readFileSync(path.join(repoRoot, 'src', 'ui', 'i18n', 'hi.json'), 'utf8')) as Record<string, { text: string }>;
/** The accessible names of the Theme_Switch: the action it offers, "Switch to night loom" or "Switch to day loom"; the state is `aria-checked`. */
const THEME_SWITCH_NAMES: readonly string[] = [EN['theme.toNight']!, EN['theme.toDay']!, HI['theme.toNight']!.text, HI['theme.toDay']!.text];
/** The accessible name of the header menu button, in both languages: pages under 1024 px draw it, and it holds the links and the two switches. */
const MENU_NAMES: readonly string[] = [EN['nav.menu']!, HI['nav.menu']!.text];
/** The accessible names of the Disclosures that may hold a control, in the screens that have them. */
const MORE_NAME = 'More';
/** Names of the two designs saved for the Keep and Code views. */
const FIRST_DESIGN_NAME = 'Diamond';
const SECOND_DESIGN_NAME = 'Border';
const VERSION_NOTE = 'Second version';

const q = JSON.stringify;

function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`));
}

/** Escapes the characters of a regular expression, but not braces, so `{name}` places can still be filled by `format`. */
const escapeRegex = (text: string): string => text.replace(/[.*+?^$()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------- arguments

type Options = { mode: Mode; outDir: string; views: readonly View[]; run2Views: readonly string[] };

function parseArguments(argv: readonly string[]): Options | string {
  const usage = 'usage: npm run screenshots -- before|after|after-run1|after-run2|after-run3 [--out <directory>] [--view <name>]...';
  let mode: Mode | null = null;
  let outDir: string | null = null;
  const views: View[] = [];
  const run2Views: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i]!;
    if (argument === 'before' || argument === 'after' || argument === 'after-run1' || argument === 'after-run2' || argument === 'after-run3') {
      if (mode !== null) return `${usage}\nthe mode was given twice`;
      mode = argument;
    } else if (argument === '--out') {
      const value = argv[++i];
      if (value === undefined) return `${usage}\n--out needs a directory`;
      outDir = path.resolve(value);
    } else if (argument === '--view') {
      const value = argv[++i];
      const run2View = RUN2_VIEWS.find((view) => view.name === value);
      if (run2View !== undefined) {
        if (!run2Views.includes(run2View.name)) run2Views.push(run2View.name);
        continue;
      }
      const view = SCREENSHOT_VIEWS.find((name) => name === value);
      if (view === undefined) return `${usage}\n--view must be one of: ${[...SCREENSHOT_VIEWS, ...RUN2_VIEWS.map((v) => v.name)].join(', ')}`;
      if (!views.includes(view)) views.push(view);
    } else {
      return `${usage}\nunknown argument "${argument}"`;
    }
  }
  if (mode === null) return usage;
  if (mode !== 'after-run2') {
    // A name both sets share (keep-versions, scan, code-diff) belongs to the 24-file set in the older modes.
    for (const name of [...run2Views]) {
      const shared = SCREENSHOT_VIEWS.find((view) => view === name);
      if (shared === undefined) continue;
      run2Views.splice(run2Views.indexOf(name), 1);
      if (!views.includes(shared)) views.push(shared);
    }
  }
  if (mode === 'after-run2' && views.length > 0) return `${usage}\n--view for after-run2 must be one of: ${RUN2_VIEWS.map((v) => v.name).join(', ')}`;
  if (mode !== 'after-run2' && run2Views.length > 0) return `${usage}\n${run2Views.join(', ')} belongs to after-run2`;
  if (mode === 'after-run1' && views.length > 0) return `${usage}\n--view does not apply to after-run1, which takes only the Landing`;
  if (mode === 'after-run3' && (views.length > 0 || run2Views.length > 0)) return `${usage}\n--view does not apply to after-run3, which takes the four Demo card screens`;
  return {
    mode,
    outDir: outDir ?? path.join(repoRoot, 'media', 'design', mode === 'after-run1' ? LANDING_FULL_FOLDER : mode === 'after-run2' ? RUN2_FOLDER : mode === 'after-run3' ? RUN3_FOLDER : mode),
    run2Views: run2Views.length === 0 ? RUN2_VIEWS.map((view) => view.name) : RUN2_VIEWS.map((view) => view.name).filter((name) => run2Views.includes(name)),
    views: views.length === 0 ? SCREENSHOT_VIEWS : SCREENSHOT_VIEWS.filter((view) => views.includes(view)),
  };
}

// ---------------------------------------------------------------- page snippets

const PICK_PATTERN = format(escapeRegex(EN['weave.pickPosition']!), { pick: '(\\d+)', total: '(\\d+)' });

/** The first element with no child element whose text matches the pattern (an expression, null when none). */
const leafMatching = (pattern: string): string =>
  `[...document.querySelectorAll('body *')].find(e=>[...e.children].every(c=>c.localName==='svg')&&new RegExp(${q(`^${pattern}$`)}).test(e.textContent.trim()))`;

/** True once the pick counter reads the last pick of a design with picks. */
const FINISHED_COUNTER = `(()=>{const e=${leafMatching(PICK_PATTERN)};if(!e)return false;const m=new RegExp(${q(`^${PICK_PATTERN}$`)}).exec(e.textContent.trim());return Number(m[1])===Number(m[2])&&Number(m[2])>0})()`;

const isShown = (element: string): string =>
  `(()=>{const e=${element};if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0})()`;

/** A sample control: `[data-sample]` when the page has it, otherwise the button with the sample's visible name. */
const sampleControl = (design: Design): string =>
  `(document.querySelector(${q(`[data-sample="${design}"]`)})??${byText('button', EN[`tryit.${design}`]!)})`;

const sampleReady = (design: Design): string => `(()=>{const e=${sampleControl(design)};return !!e&&!e.disabled})()`;

const buttonNamed = (text: string): string => `(${byText('button', text)})`;
const buttonReady = (text: string): string => `(()=>{const e=${byText('button', text)};return !!e&&!e.disabled})()`;

const fieldInput = (label: string): string =>
  `([...document.querySelectorAll('label')].find(l=>l.querySelector('span')?.textContent.trim()===${q(label)})?.querySelector('input,textarea'))`;

const NAV_TEXT: Record<Screen, string> = { weave: EN['nav.weave']!, keep: EN['nav.keep']!, scan: EN['nav.scan']!, code: EN['nav.code']! };
const HEADING_TEXT: Record<Screen, string> = { weave: EN['nav.weave']!, keep: EN['nav.keep']!, scan: EN['nav.scan']!, code: EN['codeview.title']! };

// ---------------------------------------------------------------- steps shared by the views

/** Opens the Disclosure with this accessible name when the page has one and it is closed. Gives false when there is none. */
async function openDisclosure(page: Page, name: string): Promise<boolean> {
  const control = `[...document.querySelectorAll('button[aria-expanded][aria-controls]')].find(b=>(b.getAttribute('aria-label')||b.textContent).trim()===${q(name)})`;
  const state = await page.ev<string>(`(()=>{const b=${control};return b?b.getAttribute('aria-expanded'):'absent'})()`);
  if (state === 'absent') return false;
  if (state === 'false') {
    await page.click(control, `the "${name}" Disclosure`);
    await page.waitFor(`(${control})?.getAttribute('aria-expanded')==='true'`, `the "${name}" Disclosure to open`);
  }
  return true;
}

/** Waits until the element is shown; when it is not yet, opens the named Disclosures that are present first. */
async function reveal(page: Page, element: string, what: string, disclosures: readonly string[]): Promise<void> {
  if (!(await page.ev<boolean>(isShown(element)))) {
    for (const name of disclosures) await openDisclosure(page, name);
  }
  await page.waitFor(isShown(element), what);
}

async function clickButton(page: Page, text: string): Promise<void> {
  await page.waitFor(buttonReady(text), `the "${text}" button to be enabled`);
  await page.click(buttonNamed(text), `the "${text}" button`);
}

async function fillShownField(page: Page, label: string, value: string, disclosures: readonly string[]): Promise<void> {
  await reveal(page, fieldInput(label), `the "${label}" field`, disclosures);
  await page.fillField(label, value);
}

async function goTo(page: Page, screen: Screen): Promise<void> {
  await openHeaderMenu(page, MENU_NAMES);
  await page.click(
    `[...document.querySelectorAll('nav button')].find(b=>b.textContent.trim().startsWith(${q(NAV_TEXT[screen])}))`,
    `the ${screen} navigation item`,
  );
  await page.waitFor(`document.querySelector('#screen-title')?.textContent.trim()===${q(HEADING_TEXT[screen])}`, `the ${screen} screen heading`);
}

/** A fresh page: the saved data of the site cleared, the app loaded, the language English. */
async function freshPage(page: Page, baseUrl: string): Promise<void> {
  await page.navigate('about:blank');
  await page.cdp.call('Storage.clearDataForOrigin', { origin: new URL(baseUrl).origin, storageTypes: 'indexeddb,local_storage' });
  await page.navigate(baseUrl);
  const english = byName('button', EN['language.en']!);
  await page.waitFor(`!!(${english})`, 'the English language control');
  if (!(await page.ev<boolean>(`(${english}).getAttribute('aria-pressed')==='true'`))) {
    await openHeaderMenu(page, MENU_NAMES);
    await page.click(english, 'the English language control');
  }
  await page.waitFor(
    `document.documentElement.lang==='en'&&(${english}).getAttribute('aria-pressed')==='true'&&document.querySelector('#screen-title')?.textContent.trim()===${q(EN['nav.weave'])}`,
    'the Weave screen in English',
  );
  await closeHeaderMenu(page, MENU_NAMES);
}

/** Starts a sample from the Weave screen and waits for the finished cloth (the pick counter at its last pick). */
async function startSample(page: Page, design: Design): Promise<void> {
  await page.waitFor(sampleReady(design), `the ${design} sample control to be enabled`);
  await page.click(sampleControl(design), `the ${design} sample control`);
  await page.waitFor(FINISHED_COUNTER, `the pick counter at its last pick for ${design}`, 60_000);
}

const savedText = (key: 'keep.saved' | 'keep.saved.version', name: string): string => format(EN[key]!, { name });

async function saveCurrent(page: Page, name: string, note: string | null, key: 'keep.saved' | 'keep.saved.version'): Promise<void> {
  await fillShownField(page, EN['keep.field.name']!, name, [MORE_NAME]);
  if (note !== null) await fillShownField(page, EN['keep.save.note']!, note, [MORE_NAME]);
  await clickButton(page, EN['keep.save.button']!);
  await page.waitFor(
    `document.getElementById('keep-saved')?.textContent.trim()===${q(savedText(key, name))}`,
    `the "${savedText(key, name)}" message`,
  );
}

/** Saves the open sample as a design with this name, through the Keep screen. */
async function saveSampleAs(page: Page, design: Design, name: string): Promise<void> {
  await startSample(page, design);
  await goTo(page, 'keep');
  await saveCurrent(page, name, null, 'keep.saved');
}

// ---------------------------------------------------------------- the six views

async function prepareLanding(page: Page): Promise<void> {
  await page.waitFor(sampleReady('diamond'), 'the diamond sample control to be enabled');
}

async function prepareSample(page: Page): Promise<void> {
  await startSample(page, 'diamond');
}

async function prepareLost(page: Page): Promise<void> {
  await startSample(page, 'diamond');
  const lost = buttonNamed(EN['tryit.lost']!);
  await reveal(page, lost, `the "${EN['tryit.lost']}" button`, [MORE_NAME]);
  await clickButton(page, EN['tryit.lost']!);
  const noticePattern = `(?:${escapeRegex(EN['weave.repair.notice.one']!)}|${format(escapeRegex(EN['weave.repair.notice.other']!), { count: '\\d+' })})`;
  await page.waitFor(`!!${leafMatching(noticePattern)}`, 'the lost cards notice');
  await reveal(page, buttonNamed(EN['weave.repair.suggest']!), `the "${EN['weave.repair.suggest']}" button`, [MORE_NAME]);
  await clickButton(page, EN['weave.repair.suggest']!);
  await page.waitFor(isShown(leafMatching(escapeRegex(EN['repair.heading']!))), `the "${EN['repair.heading']}" text`);
}

async function prepareKeepVersions(page: Page): Promise<void> {
  await saveSampleAs(page, 'diamond', FIRST_DESIGN_NAME);
  // Open the saved design, so the next save continues it as a new version.
  await page.click(`document.querySelector(${q(`button[aria-label="${EN['keep.list.open']}: ${FIRST_DESIGN_NAME}"]`)})`, `the Open button of "${FIRST_DESIGN_NAME}"`);
  await page.waitFor(FINISHED_COUNTER, 'the opened design on the Weave screen', 30_000);
  await goTo(page, 'keep');
  await saveCurrent(page, FIRST_DESIGN_NAME, VERSION_NOTE, 'keep.saved.version');
  const versions = format(EN['keep.list.versionCount.other']!, { count: 2 });
  await page.waitFor(`document.body.innerText.includes(${q(versions)})`, `a design with "${versions}"`);
}

/** The Keep screen with a design of two versions and its version history open (the timeline). */
async function prepareKeepVersionsOpen(page: Page): Promise<void> {
  await prepareKeepVersions(page);
  const label = `${EN['keep.list.showVersions']}: ${FIRST_DESIGN_NAME}`;
  const toggle = `document.querySelector(${q(`button[aria-label="${label}"]`)})`;
  await page.click(toggle, `the "${label}" button`);
  // Once open the button is named "Hide versions: ...", so the open state is read from the history's own group.
  await page.waitFor(`!!document.querySelector('[id^="keep-versions-"][role="group"]')`, 'the version history to open');
}
async function prepareScan(page: Page): Promise<void> {
  await goTo(page, 'scan');
  await page.waitFor(`!!document.querySelector('#scan-file')`, 'the photo chooser on the Scan screen');
}

/** Chooses the saved design whose option text starts with `optionStart` in the chooser with this label. */
async function chooseDesign(page: Page, label: string, optionStart: string): Promise<void> {
  const chooser = `([...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith(${q(label)}))?.control)`;
  const option = `(s=>[...s.options].find(o=>o.textContent.trim().startsWith(${q(optionStart)})))`;
  await page.waitFor(`(()=>{const s=${chooser};return !!s&&!s.disabled&&!!${option}(s)})()`, `"${optionStart}" in the "${label}" chooser`);
  await page.ev(`(()=>{const s=${chooser};s.value=${option}(s).value;s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await page.waitFor(`${chooser}?.selectedOptions[0]?.textContent.trim().startsWith(${q(optionStart)})`, `"${optionStart}" to stay chosen in the "${label}" chooser`);
}

async function prepareCodeDiff(page: Page): Promise<void> {
  await saveSampleAs(page, 'diamond', FIRST_DESIGN_NAME);
  await goTo(page, 'weave');
  await startSample(page, 'border');
  await goTo(page, 'keep');
  await saveCurrent(page, SECOND_DESIGN_NAME, null, 'keep.saved');
  await goTo(page, 'code');
  await chooseDesign(page, EN['codeview.diff.first.label']!, FIRST_DESIGN_NAME);
  await chooseDesign(page, EN['codeview.diff.second.label']!, SECOND_DESIGN_NAME);
  await clickButton(page, EN['codeview.diff.compare']!);
  const changedPattern = format(escapeRegex(EN['codeview.diff.counts.changedHoles']!), { count: '(\\d+)' });
  await page.waitFor(
    `(()=>{const e=${leafMatching(changedPattern)};if(!e)return false;return Number(new RegExp(${q(changedPattern)}).exec(e.textContent.trim())[1])>0})()`,
    'a difference with at least 1 changed pick',
  );
}

/** The Scan screen with a card read from a synthetic fixture photo (clean, no tilt): the marks, Accept and Discard are open. */
async function prepareScanRead(page: Page): Promise<void> {
  await prepareScan(page);
  await page.setFile('#scan-file', path.join(repoRoot, 'tests', 'fixtures', 'pick0-clean.png'));
  await page.waitFor(`document.querySelectorAll('button[data-shape]').length>0`, 'the read card on Scan', 30_000);
}
const PREPARE: Record<View, (page: Page) => Promise<void>> = {
  'weave-landing': prepareLanding,
  'weave-sample': prepareSample,
  'weave-lost': prepareLost,
  'keep-versions': prepareKeepVersions,
  scan: prepareScan,
  'code-diff': prepareCodeDiff,
};

// ---------------------------------------------------------------- theme and capture

async function chooseTheme(page: Page, mode: Mode, theme: Theme): Promise<void> {
  if (mode === 'before') {
    await page.ev(
      theme === 'night'
        ? `document.documentElement.setAttribute('data-theme','night')`
        : `document.documentElement.removeAttribute('data-theme')`,
    );
    return;
  }
  const control = `[...document.querySelectorAll('[role="switch"]')].find(b=>${q(THEME_SWITCH_NAMES)}.includes((b.getAttribute('aria-label')||b.textContent).trim()))`;
  await page.waitFor(`!!(${control})`, 'the theme switch');
  const wantNight = theme === 'night';
  if ((await page.ev<boolean>(`(${control}).getAttribute('aria-checked')==='true'`)) !== wantNight) {
    await openHeaderMenu(page, MENU_NAMES);
    await page.click(control, 'the theme switch');
  }
  await page.waitFor(
    `document.documentElement.getAttribute('data-theme')===${q(theme)}&&(${control}).getAttribute('aria-checked')===${q(String(wantNight))}`,
    `the ${theme} theme to be applied`,
  );
  await closeHeaderMenu(page, MENU_NAMES);
}

type LayoutMetrics = { cssContentSize?: { height: number }; contentSize: { height: number } };

/** Writes one full-page PNG, `width` pixels wide, as soon as it is taken. */
async function capture(page: Page, width: number, file: string, maxHeight = Infinity): Promise<void> {
  // The Code view lists its diff entries with `content-visibility: auto`, so a full-page capture would leave the entries
  // below the 800 px window blank, although a weaver who scrolls to them sees them. The page is painted in full for the capture.
  await page.ev(
    `(()=>{let s=document.getElementById('naqsha-paint-all');if(!s){s=document.createElement('style');s.id='naqsha-paint-all';s.textContent='*{content-visibility:visible !important}';document.head.appendChild(s)}return true})()`,
  );
  // A full-page file shows the header at the top of the page, not stuck in the middle of the capture: the capture (never the app) makes it static.
  await page.ev(
    `(()=>{let s=document.getElementById('naqsha-static-header');if(maxHeight===Infinity){if(!s){s=document.createElement('style');s.id='naqsha-static-header';s.textContent='header{position:static !important}';document.head.appendChild(s)}}else if(s){s.remove()}return true})()`.replace('maxHeight===Infinity', String(maxHeight === Infinity)),
  );
  await page.ev(`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))))`);
  const metrics = await page.cdp.call<LayoutMetrics>('Page.getLayoutMetrics');
  const contentHeight = Math.min(maxHeight, Math.max(WINDOW_HEIGHT, Math.ceil((metrics.cssContentSize ?? metrics.contentSize).height)));
  const shot = await page.cdp.call<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height: contentHeight, scale: 1 },
  });
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
}

// ---------------------------------------------------------------- hints


/** Page expression: the sideways overflow and the overlapping text boxes, as plain data. */
const HINTS_EXPRESSION = `(()=>{
  const root=document.documentElement;
  /* The box a weaver can see: the element's box cut by every ancestor that clips or scrolls, or null when nothing shows. */
  const shown=e=>{
    const b=e.getBoundingClientRect();
    let l=b.left,t=b.top,r=b.right,u=b.bottom;
    for(let p=e.parentElement;p&&p!==root&&p!==document.body;p=p.parentElement){
      const s=getComputedStyle(p);
      if(s.overflowX==='visible'&&s.overflowY==='visible')continue;
      const c=p.getBoundingClientRect();
      if(s.overflowX!=='visible'){l=Math.max(l,c.left);r=Math.min(r,c.right);}
      if(s.overflowY!=='visible'){t=Math.max(t,c.top);u=Math.min(u,c.bottom);}
    }
    return r-l>0&&u-t>0?{left:l,top:t,right:r,bottom:u}:null;
  };
  const texts=[...document.querySelectorAll('body *')].filter(e=>{
    if(e.children.length!==0||e.textContent.trim()==='')return false;
    const s=getComputedStyle(e);
    if(s.visibility==='hidden'||s.display==='none')return false;
    const d=e.closest('details:not([open])');if(d&&!e.closest('summary'))return false;
    return shown(e)!==null;
  }).map(e=>({e,r:shown(e)}));
  const clashes=[];
  for(let i=0;i<texts.length;i++)for(let j=i+1;j<texts.length;j++){
    const a=texts[i].r,b=texts[j].r;
    const w=Math.min(a.right,b.right)-Math.max(a.left,b.left);
    const h=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    if(w>1&&h>1)clashes.push(JSON.stringify(texts[i].e.textContent.trim().slice(0,30))+' / '+JSON.stringify(texts[j].e.textContent.trim().slice(0,30)));
  }
  return {scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,clashes};
})()`;

type Hints = { scrollWidth: number; clientWidth: number; clashes: string[] };

/** Prints the automatic hints for the page as it is shown. They are hints only and never change the exit status. */
async function printHints(page: Page, name: string): Promise<void> {
  const hints = await page.ev<Hints>(HINTS_EXPRESSION);
  const fits = hints.scrollWidth <= hints.clientWidth;
  console.log(`hint  ${name}: scrollWidth ${hints.scrollWidth} ${fits ? '<=' : '>'} clientWidth ${hints.clientWidth}; ${hints.clashes.length} overlapping text box pair(s)`);
  for (const pair of hints.clashes.slice(0, 10)) console.log(`hint  ${name}:   overlap ${pair}`);
}

// ---------------------------------------------------------------- the full-page Landing set

/** True once every picture of the page has loaded and has a size (a lazy picture only loads when it is near the screen). */
const PICTURES_DECODED = `[...document.images].every(i=>i.complete&&i.naturalWidth>0)`;
/** True when no block waits to be revealed, and no CSS transition or animation of finite length is still running. */
const REVEALS_FINAL = `document.querySelectorAll('[data-reveal="pending"]').length===0&&document.getAnimations().every(a=>a.playState!=='running'||a.effect?.getComputedTiming().iterations===Infinity)`;

/**
 * Scrolls from the top to the bottom of the page, a little less than a window at a time, a frame or two between steps so the
 * browser can start the lazy pictures and tell the page which blocks came into view, then back to the top. It only scrolls: the
 * page is not touched.
 */
async function scrollThrough(page: Page): Promise<void> {
  await page.ev(
    `(async()=>{const frames=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const step=Math.max(200,Math.floor(innerHeight*0.6));for(let y=0;;y+=step){window.scrollTo(0,y);await frames();if(window.scrollY+innerHeight>=document.documentElement.scrollHeight-1)break}window.scrollTo(0,0);await frames();return true})()`,
  );
  await page.waitFor(`window.scrollY===0`, 'the page to be back at the top');
  await page.waitFor(PICTURES_DECODED, 'every picture of the page to be decoded', 30_000);
  await page.waitFor(REVEALS_FINAL, 'every block to be revealed and no transition to be running', 30_000);
}

/** The four files of the second set, with motion left on; returns the failures. */
async function captureLandingFull(page: Page, baseUrl: string, outDir: string): Promise<string[]> {
  const failures: string[] = [];
  await page.cdp.call('Emulation.setEmulatedMedia', {
    features: [
      { name: 'prefers-reduced-motion', value: 'reduce' },
      { name: 'prefers-color-scheme', value: 'light' },
    ],
  });
  for (const width of LANDING_FULL_WIDTHS) {
    const names = SCREENSHOT_THEMES.map((theme) => `${LANDING_FULL_VIEW}-${theme}-${width}.png`);
    try {
      await page.setViewport(width, WINDOW_HEIGHT);
      await freshPage(page, baseUrl);
      await prepareLanding(page);
      await scrollThrough(page);
      for (const theme of SCREENSHOT_THEMES) {
        await chooseTheme(page, 'after', theme);
        const name = `${LANDING_FULL_VIEW}-${theme}-${width}.png`;
        await capture(page, width, path.join(outDir, name));
        console.log(`saved ${name}`);
        try {
          await printHints(page, name);
        } catch (error) {
          console.log(`hint  ${name}: could not be computed: ${messageOf(error)}`);
        }
      }
    } catch (error) {
      const lost = names.filter((name) => !existsSync(path.join(outDir, name)));
      failures.push(`${LANDING_FULL_VIEW} at ${width} failed: ${messageOf(error)} (not saved: ${lost.join(', ') || 'none'})`);
      console.error(failures[failures.length - 1]);
    }
  }
  return failures;
}

// ---------------------------------------------------------------- the header set (run 2, part 0)

/** The height of the strip of the page the header views keep: the header and the sheet under it, with some of the page. */
const HEADER_CROP_PX = 700;

/** Switches the page to Hindi or English through the language segments, found by their accessible names. */
async function chooseLanguage(page: Page, language: 'en' | 'hi'): Promise<void> {
  if ((await page.ev<string>('document.documentElement.lang')) === language) return;
  await openHeaderMenu(page, MENU_NAMES);
  await page.click(byName('button', language === 'hi' ? HI['language.hi']!.text : EN['language.en']!), `the ${language} language control`);
  await page.waitFor(`document.documentElement.lang===${q(language)}`, `the page language to be ${language}`);
  await closeHeaderMenu(page, MENU_NAMES);
}

/** The header views of run 2: each width on a fresh page; English, then Hindi; each theme; the sheet closed, and where the page has one, open. */
async function captureHeader(page: Page, baseUrl: string, outDir: string, wanted: readonly string[]): Promise<string[]> {
  const failures: string[] = [];
  const widths = [...new Set(RUN2_VIEWS.filter((view) => view.name.startsWith('header-') && wanted.includes(view.name)).flatMap((view) => view.widths))].sort((a, b) => b - a);
  for (const width of widths) {
    try {
      await page.setViewport(width, WINDOW_HEIGHT);
      await freshPage(page, baseUrl);
      await prepareLanding(page);
      for (const language of ['en', 'hi'] as const) {
        await chooseLanguage(page, language);
        const suffix = language === 'hi' ? '-hi' : '';
        for (const theme of SCREENSHOT_THEMES) {
          await chooseTheme(page, 'after', theme);
          for (const kind of ['closed', 'menu']) {
            const view = RUN2_VIEWS.find((candidate) => candidate.name === `header-${kind}${suffix}`);
            if (view === undefined || !wanted.includes(view.name) || !view.widths.includes(width)) continue;
            if (kind === 'menu') await openHeaderMenu(page, MENU_NAMES);
            const name = `${view.name}-${theme}-${width}.png`;
            await capture(page, width, path.join(outDir, name), HEADER_CROP_PX);
            console.log(`saved ${name}`);
            try {
              await printHints(page, name);
            } catch (error) {
              console.log(`hint  ${name}: could not be computed: ${messageOf(error)}`);
            }
            if (kind === 'menu') await closeHeaderMenu(page, MENU_NAMES);
          }
        }
      }
    } catch (error) {
      failures.push(`the header at ${width} failed: ${messageOf(error)}`);
      console.error(failures[failures.length - 1]);
    }
  }
  return failures;
}

// ---------------------------------------------------------------- the full-page screens (run 2, parts 1 to 3)

/** The full-page views of run 2 that are a screen with a design loaded, by name. */
const RUN2_SCREEN_VIEWS: Readonly<Record<string, (page: Page) => Promise<void>>> = {
  'weave-sample': prepareSample,
  'weave-lost': prepareLost,
  'keep-versions': prepareKeepVersionsOpen,
  scan: prepareScan,
  'scan-read': prepareScanRead,
  'code-diff': prepareCodeDiff,
};

/** One view of a screen at each of its widths: a fresh page, the screen made ready, then both themes as full-page files. */
async function captureScreens(page: Page, baseUrl: string, outDir: string, wanted: readonly string[]): Promise<string[]> {
  const failures: string[] = [];
  for (const view of RUN2_VIEWS) {
    const prepare = RUN2_SCREEN_VIEWS[view.name];
    if (prepare === undefined || !wanted.includes(view.name)) continue;
    for (const width of view.widths) {
      try {
        await page.setViewport(width, WINDOW_HEIGHT);
        await freshPage(page, baseUrl);
        await prepare(page);
        for (const theme of SCREENSHOT_THEMES) {
          await chooseTheme(page, 'after', theme);
          const name = `${view.name}-${theme}-${width}.png`;
          await capture(page, width, path.join(outDir, name));
          console.log(`saved ${name}`);
          try {
            await printHints(page, name);
          } catch (error) {
            console.log(`hint  ${name}: could not be computed: ${messageOf(error)}`);
          }
        }
      } catch (error) {
        failures.push(`${view.name} at ${width} failed: ${messageOf(error)}`);
        console.error(failures[failures.length - 1]);
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------- the Demo cards set (judges' demo kit)

/** Opens the page's Demo cards by pressing their own buttons, so each screenshot shows a screen that is in use. */
const pressDemo = async (page: Page, kind: string, what: string): Promise<void> => {
  const button = `document.querySelector('[data-demo="${kind}"]')`;
  await page.waitFor(`(()=>{const e=${button};return !!e&&!e.disabled})()`, `the ${what} button to be enabled`);
  await page.click(button, `the ${what} button`);
};

const RUN3_PREPARE: Readonly<Record<(typeof RUN3_VIEWS)[number], (page: Page) => Promise<void>>> = {
  'scan-demo': async (page) => {
    await prepareScan(page);
    await page.waitFor(`!!document.querySelector('[data-demo="card-1-clean.png"]')`, 'the Demo cards of the Scan screen');
  },
  'keep-demo': async (page) => {
    await goTo(page, 'keep');
    await pressDemo(page, 'save', 'Save a demo design');
    await page.waitFor(`document.body.innerText.includes(${q(EN['keep.demo.saved']!)})`, 'the demo design to be saved');
    await pressDemo(page, 'edit', 'Make a demo edit');
    await page.waitFor(`document.body.innerText.includes(${q(EN['keep.demo.edited']!)})`, 'the demo edit to be saved');
  },
  'code-demo': async (page) => {
    await goTo(page, 'code');
    await pressDemo(page, 'load', 'Load the Diamond card as code');
    await pressDemo(page, 'breakpoint', 'Add a breakpoint');
    await page.waitFor(`document.body.innerText.includes(${q(format(EN['codeview.demo.breakpointSet']!, { pick: 3 }))})`, 'the breakpoint on pick 3');
  },
  'weave-demo': async (page) => {
    // The Demo strip is in the Try it section, which Weave draws in "More" once a cloth is shown.
    await startSample(page, 'diamond');
    const lost = `document.querySelector('[data-demo-gap="missing"]')`;
    await reveal(page, lost, 'the "Show a lost card" button', [MORE_NAME]);
    await page.click(lost, 'the "Show a lost card" button');
    const noticePattern = `(?:${escapeRegex(EN['weave.repair.notice.one']!)}|${format(escapeRegex(EN['weave.repair.notice.other']!), { count: '\\d+' })})`;
    await page.waitFor(`!!${leafMatching(noticePattern)}`, 'the lost card notice');
    // The Demo strip sits in the "More" Disclosure once a cloth is shown.
    await openDisclosure(page, MORE_NAME);
    await page.waitFor(isShown(lost), 'the Demo strip');
  },
};

/** The eight files of the Demo cards set, each screen at each width on a fresh page, Day loom; returns the failures. */
async function captureRun3(page: Page, baseUrl: string, outDir: string): Promise<string[]> {
  const failures: string[] = [];
  for (const view of RUN3_VIEWS) {
    for (const width of RUN3_WIDTHS) {
      try {
        await page.setViewport(width, WINDOW_HEIGHT);
        await freshPage(page, baseUrl);
        await RUN3_PREPARE[view](page);
        await scrollThrough(page);
        await chooseTheme(page, 'after', RUN3_THEME);
        const name = `${view}-${RUN3_THEME}-${width}.png`;
        await capture(page, width, path.join(outDir, name));
        console.log(`saved ${name}`);
        try {
          await printHints(page, name);
        } catch (error) {
          console.log(`hint  ${name}: could not be computed: ${messageOf(error)}`);
        }
      } catch (error) {
        failures.push(`${view} at ${width} failed: ${messageOf(error)}`);
        console.error(failures[failures.length - 1]);
      }
    }
  }
  return failures;
}

// ---------------------------------------------------------------- main

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function main(): Promise<number> {
  const options = parseArguments(process.argv.slice(2));
  if (typeof options === 'string') {
    console.error(options);
    return 2;
  }
  const { mode, outDir, views, run2Views } = options;
  const cleanups: Cleanup[] = [];
  const cleanUp = async (): Promise<void> => {
    for (const cleanup of cleanups.splice(0).reverse()) {
      try {
        await cleanup();
      } catch (error) {
        console.error(`cleanup failed: ${messageOf(error)}`);
      }
    }
  };
  process.once('SIGINT', () => {
    void cleanUp().finally(() => process.exit(130));
  });
  const failures: string[] = [];
  try {
    const chrome = findChrome(process.platform, process.env, existsSync);
    if (!chrome.ok) {
      console.error(chrome.message);
      return 1;
    }
    if (!existsSync(path.join(repoRoot, 'dist', 'index.html'))) {
      console.error('dist/ is missing. Run `npm run build` first.');
      return 1;
    }
    mkdirSync(outDir, { recursive: true });
    const tempDir = mkdtempSync(path.join(os.tmpdir(), 'naqsha-screenshots-'));
    cleanups.push(async () => rmSync(tempDir, { recursive: true, force: true }));

    const { url: baseUrl } = await startPreview(cleanups);
    console.log(`mode ${mode}, preview ${baseUrl}, writing to ${outDir}`);
    const { port } = await startChrome(chrome.path, cleanups);
    const cdp = await openPage(port);
    cleanups.push(async () => cdp.close());
    const page = new Page(cdp);
    await page.init(tempDir);
    // Before the first navigation: a cloth is shown finished at once, and the Day_Loom is the default theme.
    await cdp.call('Emulation.setEmulatedMedia', {
      features: [
        { name: 'prefers-reduced-motion', value: 'reduce' },
        { name: 'prefers-color-scheme', value: 'light' },
      ],
    });

    if (mode === 'after-run1') {
      // A file of an earlier run must not stand in for one that fails now.
      for (const name of landingFullNames()) rmSync(path.join(outDir, name), { force: true });
      failures.push(...(await captureLandingFull(page, baseUrl, outDir)));
    }
    if (mode === 'after-run2') {
      // A file of an earlier run must not stand in for one that fails now.
      for (const name of run2Names(run2Views)) rmSync(path.join(outDir, name), { force: true });
      failures.push(...(await captureHeader(page, baseUrl, outDir, run2Views)));
      failures.push(...(await captureScreens(page, baseUrl, outDir, run2Views)));
    }
    if (mode === 'after-run3') {
      // A file of an earlier run must not stand in for one that fails now.
      for (const name of run3Names()) rmSync(path.join(outDir, name), { force: true });
      failures.push(...(await captureRun3(page, baseUrl, outDir)));
    }
    for (const width of mode === 'after-run1' || mode === 'after-run2' || mode === 'after-run3' ? [] : SCREENSHOT_WIDTHS) {
      for (const view of views) {
        const names = SCREENSHOT_THEMES.map((theme) => `${view}-${theme}-${width}.png`);
        // A file of an earlier run must not stand in for one that fails now.
        for (const name of names) rmSync(path.join(outDir, name), { force: true });
        try {
          await page.setViewport(width, WINDOW_HEIGHT);
          await freshPage(page, baseUrl);
          await PREPARE[view](page);
          for (const theme of SCREENSHOT_THEMES) {
            await chooseTheme(page, mode, theme);
            const name = `${view}-${theme}-${width}.png`;
            await capture(page, width, path.join(outDir, name));
            console.log(`saved ${name}`);
            try {
              await printHints(page, name);
            } catch (error) {
              console.log(`hint  ${name}: could not be computed: ${messageOf(error)}`);
            }
          }
        } catch (error) {
          const lost = names.filter((name) => !existsSync(path.join(outDir, name)));
          failures.push(`${view} at ${width} failed: ${messageOf(error)} (not saved: ${lost.join(', ') || 'none'})`);
          console.error(failures[failures.length - 1]);
        }
      }
    }
  } catch (error) {
    failures.push(`the screenshots could not run: ${messageOf(error)}`);
  } finally {
    await cleanUp();
  }

  // The directory is checked as it is on disk, so a file that failed or is not a valid PNG is named.
  const files = new Map<string, Uint8Array>();
  if (existsSync(outDir)) {
    for (const name of readdirSync(outDir)) {
      if (!name.startsWith('.')) files.set(name, new Uint8Array(readFileSync(path.join(outDir, name))));
    }
  }
  const landing = mode === 'after-run1';
  const run2 = mode === 'after-run2';
  const run3 = mode === 'after-run3';
  const skipped = landing || run2 || run3 ? [] : screenshotNames().filter((name) => !views.some((view) => name.startsWith(`${view}-`)));
  const problems = (run3 ? run3Problems(files) : run2 ? run2Problems(files, run2Views) : landing ? landingFullProblems(files) : setProblems(files)).filter((problem) => !skipped.some((name) => problem.startsWith(`${name} `)));
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  for (const problem of problems) console.error(`FAIL  ${problem}`);
  if (failures.length === 0 && problems.length === 0) {
    console.log(`OK    ${(run3 ? run3Names() : run2 ? run2Names(run2Views) : landing ? landingFullNames() : screenshotNames()).length - skipped.length} files in ${outDir} are valid PNG files of the right width`);
    return 0;
  }
  return 1;
}

process.exitCode = await main();
