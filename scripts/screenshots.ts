/**
 * `npm run screenshots -- before` or `npm run screenshots -- after`: takes the 24 full-page screenshots of the design
 * pass (six views, Day and Night, 320 and 1280 CSS pixels wide) with headless Chrome over the DevTools protocol, from
 * the built `dist/` served by `vite preview`. Files go to `media/design/before/` or `media/design/after/`.
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
import { SCREENSHOT_THEMES, SCREENSHOT_VIEWS, SCREENSHOT_WIDTHS, screenshotNames, setProblems } from './checks/screenshots.ts';
import { Page, byText, openPage, startChrome, startPreview } from './checks/session.ts';
import type { Cleanup } from './checks/session.ts';

const repoRoot = path.resolve(import.meta.dirname, '..');
const EN = JSON.parse(readFileSync(path.join(repoRoot, 'src', 'ui', 'i18n', 'en.json'), 'utf8')) as Record<string, string>;

type Mode = 'before' | 'after';
type View = (typeof SCREENSHOT_VIEWS)[number];
type Theme = (typeof SCREENSHOT_THEMES)[number];
type Screen = 'weave' | 'keep' | 'scan' | 'code';
type Design = 'diamond' | 'border' | 'floral';

/** Height of the emulated window; a capture is taller when the page is. */
const WINDOW_HEIGHT = 800;
/** The accessible name of the Theme_Switch (the visible label `theme.label`); the state is `aria-checked`. */
const THEME_SWITCH_NAME = 'Night loom';
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

type Options = { mode: Mode; outDir: string; views: readonly View[] };

function parseArguments(argv: readonly string[]): Options | string {
  const usage = 'usage: npm run screenshots -- before|after [--out <directory>] [--view <name>]...';
  let mode: Mode | null = null;
  let outDir: string | null = null;
  const views: View[] = [];
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i]!;
    if (argument === 'before' || argument === 'after') {
      if (mode !== null) return `${usage}\nthe mode was given twice`;
      mode = argument;
    } else if (argument === '--out') {
      const value = argv[++i];
      if (value === undefined) return `${usage}\n--out needs a directory`;
      outDir = path.resolve(value);
    } else if (argument === '--view') {
      const value = argv[++i];
      const view = SCREENSHOT_VIEWS.find((name) => name === value);
      if (view === undefined) return `${usage}\n--view must be one of: ${SCREENSHOT_VIEWS.join(', ')}`;
      if (!views.includes(view)) views.push(view);
    } else {
      return `${usage}\nunknown argument "${argument}"`;
    }
  }
  if (mode === null) return usage;
  return {
    mode,
    outDir: outDir ?? path.join(repoRoot, 'media', 'design', mode),
    views: views.length === 0 ? SCREENSHOT_VIEWS : SCREENSHOT_VIEWS.filter((view) => views.includes(view)),
  };
}

// ---------------------------------------------------------------- page snippets

const PICK_PATTERN = format(escapeRegex(EN['weave.pickPosition']!), { pick: '(\\d+)', total: '(\\d+)' });

/** The first element with no child element whose text matches the pattern (an expression, null when none). */
const leafMatching = (pattern: string): string =>
  `[...document.querySelectorAll('body *')].find(e=>e.children.length===0&&new RegExp(${q(`^${pattern}$`)}).test(e.textContent.trim()))`;

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
  const english = `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${q(EN['language.en'])})`;
  await page.waitFor(`!!(${english})`, 'the English language control');
  if (!(await page.ev<boolean>(`(${english}).getAttribute('aria-pressed')==='true'`))) await page.click(english, 'the English language control');
  await page.waitFor(
    `document.documentElement.lang==='en'&&(${english}).getAttribute('aria-pressed')==='true'&&document.querySelector('#screen-title')?.textContent.trim()===${q(EN['nav.weave'])}`,
    'the Weave screen in English',
  );
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
  const control = `[...document.querySelectorAll('[role="switch"]')].find(b=>(b.getAttribute('aria-label')||b.textContent).trim().startsWith(${q(THEME_SWITCH_NAME)}))`;
  await page.waitFor(`!!(${control})`, `the "${THEME_SWITCH_NAME}" switch`);
  const wantNight = theme === 'night';
  if ((await page.ev<boolean>(`(${control}).getAttribute('aria-checked')==='true'`)) !== wantNight) {
    await page.click(control, `the "${THEME_SWITCH_NAME}" switch`);
  }
  await page.waitFor(
    `document.documentElement.getAttribute('data-theme')===${q(theme)}&&(${control}).getAttribute('aria-checked')===${q(String(wantNight))}`,
    `the ${theme} theme to be applied`,
  );
}

type LayoutMetrics = { cssContentSize?: { height: number }; contentSize: { height: number } };

/** Writes one full-page PNG, `width` pixels wide, as soon as it is taken. */
async function capture(page: Page, width: number, file: string): Promise<void> {
  await page.ev(`document.fonts.ready.then(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r(true)))))`);
  const metrics = await page.cdp.call<LayoutMetrics>('Page.getLayoutMetrics');
  const contentHeight = Math.max(WINDOW_HEIGHT, Math.ceil((metrics.cssContentSize ?? metrics.contentSize).height));
  const shot = await page.cdp.call<{ data: string }>('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: true,
    clip: { x: 0, y: 0, width, height: contentHeight, scale: 1 },
  });
  writeFileSync(file, Buffer.from(shot.data, 'base64'));
}

// ---------------------------------------------------------------- main

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function main(): Promise<number> {
  const options = parseArguments(process.argv.slice(2));
  if (typeof options === 'string') {
    console.error(options);
    return 2;
  }
  const { mode, outDir, views } = options;
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

    for (const width of SCREENSHOT_WIDTHS) {
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
  const skipped = screenshotNames().filter((name) => !views.some((view) => name.startsWith(`${view}-`)));
  const problems = setProblems(files).filter((problem) => !skipped.some((name) => problem.startsWith(`${name} `)));
  for (const failure of failures) console.error(`FAIL  ${failure}`);
  for (const problem of problems) console.error(`FAIL  ${problem}`);
  if (failures.length === 0 && problems.length === 0) {
    console.log(`OK    ${screenshotNames().length - skipped.length} files in ${outDir} are valid PNG files of the right width`);
    return 0;
  }
  return 1;
}

process.exitCode = await main();
