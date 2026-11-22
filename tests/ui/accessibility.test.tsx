import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Shell } from '../../src/ui/App.tsx';
import { alertTexts } from '../support/notices.ts';
import { DICTIONARIES, translator } from '../../src/ui/i18n/messages.ts';
import { CodeViewScreen } from '../../src/ui/screens/code/CodeViewScreen.tsx';
import { KeepView } from '../../src/ui/screens/keep/KeepScreen.tsx';
import type { KeepViewProps } from '../../src/ui/screens/keep/KeepScreen.tsx';
import { ScanView } from '../../src/ui/screens/scan/ScanScreen.tsx';
import type { ScanViewProps } from '../../src/ui/screens/scan/ScanScreen.tsx';
import { generateSample } from '../../src/ui/samples/sampleDesigns.ts';
import { gapPickNumbers } from '../../src/ui/state/cloth.ts';
import { EMPTY_METADATA, initialKeepForm } from '../../src/ui/state/keep.ts';
import { initialAppState } from '../../src/ui/state/appState.ts';
import { initialScanState, readPhoto, scanReducer } from '../../src/ui/state/scan.ts';
import type { Pattern } from '../../src/codec/index.ts';
import type { AppState, Language, ScanState } from '../../src/ui/types.ts';
import { decodePng } from '../support/png.ts';
import { demoProfile } from '../support/profiles.ts';

const ROOT = path.resolve(import.meta.dirname, '../..');
const LANGUAGES: Language[] = ['hi', 'en'];
const noop = (): void => undefined;

function escape(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

function keepView(language: Language, overrides: Partial<KeepViewProps> = {}): string {
  const profile = demoProfile();
  const props: KeepViewProps = {
    profile,
    pattern: generateSample(profile, 'diamond'),
    form: initialKeepForm,
    designs: [{ id: 'a', profileName: 'Other', metadata: { ...EMPTY_METADATA, name: 'Saree' }, createdAt: 1, pickCount: 4 }],
    pendingDeleteId: 'a',
    savedText: null,
    exportDone: false,
    failureKey: null,
    t: translator(DICTIONARIES, language),
    onFormAction: noop,
    onExport: noop,
    onSave: noop,
    onOpen: noop,
    onDeleteRequest: noop,
    onDeleteConfirm: noop,
    onDeleteCancel: noop,
    ...overrides,
  };
  return renderToStaticMarkup(<KeepView {...props} />);
}

function codeView(language: Language, pattern: Pattern): string {
  const state: AppState = {
    ...initialAppState,
    language,
    screen: 'code',
    profile: { status: 'ready', profile: demoProfile() },
    current: { pattern, origin: { kind: 'sample', design: 'diamond' } },
    breakpoints: [1],
  };
  return renderToStaticMarkup(<CodeViewScreen state={state} dispatch={noop} t={translator(DICTIONARIES, language)} />);
}

function scanView(language: Language, scan: ScanState, overrides: Partial<ScanViewProps> = {}): string {
  const props: ScanViewProps = {
    profile: demoProfile(),
    scan,
    batch: [[[true, false]], [[false, true]]],
    pendingRemove: 1,
    replacingIndex: null,
    confirmingDone: true,
    viewWidthPx: 360,
    t: translator(DICTIONARIES, language),
    onFile: noop,
    onToggle: noop,
    onUndo: noop,
    onZoom: noop,
    onAccept: noop,
    onDiscard: noop,
    onRemoveRequest: noop,
    onRemoveConfirm: noop,
    onRemoveCancel: noop,
    onMove: noop,
    onScanAgain: noop,
    onCancelReplacing: noop,
    onDone: noop,
    onCommit: noop,
    onDoneCancel: noop,
    ...overrides,
  };
  return renderToStaticMarkup(<ScanView {...props} />);
}

async function readScan(corrected: boolean): Promise<ScanState> {
  const pixels = decodePng(new Uint8Array(readFileSync(path.join(ROOT, 'tests/fixtures/pick0-clean.png'))));
  const outcome = await readPhoto(demoProfile(), new Blob([new Uint8Array([0])]), () => Promise.resolve(pixels));
  const state = scanReducer(initialScanState, { type: 'finish', outcome, zoom: 2, replacing: null });
  return corrected ? scanReducer(state, { type: 'toggle', position: { hookRow: 0, hookColumn: 0 } }) : state;
}

const textOf = (html: string): string => html.replace(/<[^>]*>/g, '').trim();
const ariaLabel = (attributes: string): string => /aria-label="([^"]*)"/.exec(attributes)?.[1]?.trim() ?? '';

/** Names the buttons, form controls and images that have no text name. */
function unnamed(html: string): string[] {
  const missing: string[] = [];
  for (const match of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
    if (ariaLabel(match[1]!) === '' && textOf(match[2]!) === '') missing.push(`button ${match[1]}`);
  }
  // A control that a `<label for="id">` with text points at is named by that label text.
  const namedById = new Set<string>();
  for (const match of html.matchAll(/<label\b([^>]*)>([\s\S]*?)<\/label>/g)) {
    const target = /\bfor="([^"]*)"/.exec(match[1]!)?.[1];
    if (target !== undefined && textOf(match[2]!) !== '') namedById.add(target);
  }
  // A control inside a label is named by the label text; other controls need an aria-label.
  const withoutLabels = html.replace(/<label\b[^>]*>([\s\S]*?)<\/label>/g, (_whole, inner: string) => {
    const labelText = textOf(
      inner.replace(/<select\b[\s\S]*?<\/select>/g, '').replace(/<textarea\b[\s\S]*?<\/textarea>/g, '').replace(/<input\b[^>]*>/g, ''),
    );
    if (/<(input|select|textarea)\b/.test(inner) && labelText === '') missing.push(`label without text: ${inner.slice(0, 60)}`);
    return '';
  });
  for (const match of withoutLabels.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    if (/type="hidden"/.test(match[2]!)) continue;
    const id = /\bid="([^"]*)"/.exec(match[2]!)?.[1];
    if (id !== undefined && namedById.has(id)) continue;
    if (ariaLabel(match[2]!) === '') missing.push(`${match[1]} ${match[2]}`);
  }
  for (const match of html.matchAll(/<(canvas|svg|img)\b([^>]*)>(<title>[^<]*<\/title>)?/g)) {
    if (/aria-hidden="true"/.test(match[2]!)) continue;
    // An svg is named by its aria-label or by a non-empty <title> as its first child (the CardDrawing of Weave).
    const titled = match[1] === 'svg' && /<title>[^<]*\S[^<]*<\/title>/.test(match[3] ?? '');
    const named = ariaLabel(match[2]!) !== '' || /\balt="[^"]+"/.test(match[2]!) || titled;
    if (!named) missing.push(`${match[1]} ${match[2]}`);
  }
  return missing;
}

describe('text names in both languages', () => {
  it('R14.4 every button, form control and image on the Weave, Keep, Code view and Scan screens has a text name', async () => {
    // The checker itself finds an unnamed button, an unnamed field and an unnamed image.
    expect(unnamed('<button type="button"></button><input type="text"/><canvas></canvas>')).toHaveLength(3);
    const profile = demoProfile();
    const pattern = generateSample(profile, 'diamond');
    const scanned = await readScan(true);
    for (const language of LANGUAGES) {
      const shell = renderToStaticMarkup(
        <Shell
          state={{ ...initialAppState, screen: 'weave', language, profile: { status: 'ready', profile }, current: { pattern, origin: { kind: 'sample', design: 'diamond' } } }}
          dispatch={noop}
        />,
      );
      const pages = {
        weave: shell,
        keep: keepView(language),
        code: codeView(language, pattern),
        scan: scanView(language, scanned),
        'scan, no photo': scanView(language, initialScanState, { batch: [] }),
      };
      for (const [name, html] of Object.entries(pages)) {
        expect(html.match(/<button\b/g)?.length ?? 0, `${language} ${name} has controls to check`).toBeGreaterThan(3);
        expect(unnamed(html), `${language} ${name}`).toEqual([]);
      }
    }
  });
});

describe('statuses are not shown by colour alone', () => {
  it('R14.6 error, success, punched, unpunched, corrected and gap statuses each carry a word or a shape', async () => {
    const corrected = await readScan(true);
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      // Error: the message is text inside an alert, and the failure kind is not the text.
      const failed = scanView(language, { status: 'failed', failure: { reason: 'peg-holes-not-found' } });
      expect(failed).toContain(escape(t('error.read.peg-holes-not-found')));
      expect(alertTexts(keepView(language, { failureKey: 'error.archive.write-failed' }))).toContain(
        escape(t('error.archive.write-failed')),
      );
      // Success: a sentence.
      expect(keepView(language, { exportDone: true })).toContain(escape(t('keep.export.done')));
      expect(keepView(language, { savedText: t('keep.saved', { name: 'Saree' }) })).toContain(escape(t('keep.saved', { name: 'Saree' })));
      // Punched, unpunched, corrected: a shape (filled or ring), a word in the name of each marker, a legend, a badge.
      const html = scanView(language, corrected);
      expect(html).toContain('data-shape="filled"');
      expect(html).toContain('data-shape="ring"');
      const names = [...html.matchAll(/class="[^"]*marker[^"]*"[^>]*aria-label="([^"]*)"/g)].map((match) => match[1]);
      expect(names.some((name) => name!.includes(escape(t('scan.marker.punched'))))).toBe(true);
      expect(names.some((name) => name!.includes(escape(t('scan.marker.unpunched'))))).toBe(true);
      const correctedName = names.find((name) => name!.includes(escape(t('scan.marker.corrected'))));
      expect(correctedName, `${language} a corrected marker names the change in words`).toBeDefined();
      expect(html).toContain('data-corrected="true"');
      for (const key of ['scan.legend.punched', 'scan.legend.unpunched', 'scan.legend.corrected']) {
        expect(html).toContain(escape(t(key)));
      }
      // Missing or damaged card: the Weave screen lists the picks in text (the hatching is drawn by the simulator).
      const gaps = gapPickNumbers([
        { pick: 2, kind: 'missing', violations: [] },
        { pick: 6, kind: 'damaged', violations: [] },
      ]);
      expect(gaps).toEqual([3, 7]);
      expect(t('weave.gaps', { picks: gaps.join(', ') })).toContain('3, 7');
    }
    // The unverified-profile notice has a word and an icon (also checked in profileNotice.test.tsx).
    expect(keepView('en')).toContain('aria-hidden="true"');
  });
});

describe('base text size', () => {
  const uiDir = path.join(ROOT, 'src/ui');
  function cssFiles(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return cssFiles(full);
      return entry.name.endsWith('.css') ? [full] : [];
    });
  }
  const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');

  it('R14.11 the base text size is 18 px or more for every viewport width, and form controls inherit it', () => {
    const tokens = strip(readFileSync(path.join(uiDir, 'theme/tokens.css'), 'utf8'));
    const root = /(?:^|\n)html\s*\{([^}]*)\}/.exec(tokens)?.[1] ?? '';
    const size = /font-size:\s*([\d.]+)px/.exec(root);
    expect(size, 'html sets its font size in px').not.toBeNull();
    expect(Number(size![1])).toBeGreaterThanOrEqual(18);
    // No media query can change the size at a narrow width, and body does not override it.
    for (const file of cssFiles(uiDir)) {
      const css = strip(readFileSync(file, 'utf8'));
      for (const query of css.matchAll(/@media\s*([^{]*)\{/g)) {
        const condition = query[1]!.trim();
        if (/^\(min-width:\s*\d+px\)$/.test(condition)) {
          // A width query may lay a screen out, and may not touch a font: its block holds no `font` property.
          let depth = 1;
          let end = query.index! + query[0].length;
          while (depth > 0 && end < css.length) depth += css[end] === '{' ? 1 : css[end] === '}' ? -1 : 0, end++;
          const block = css.slice(query.index! + query[0].length, end);
          expect(block, `${path.relative(uiDir, file)} sets a font inside ${condition}`).not.toMatch(/font/);
          continue;
        }
        expect(condition, `${path.relative(uiDir, file)} has a media query`).toBe('(prefers-reduced-motion: reduce)');
      }
    }
    expect(/(?:^|\n)body\s*\{([^}]*)\}/.exec(tokens)?.[1] ?? '').not.toMatch(/font-size/);
    // Controls take the page font. Buttons, inputs and selects through the token sheet, the text area through the shared Field.
    const inherit = /([^{}]*)\{[^}]*font:\s*inherit[^}]*\}/.exec(tokens)?.[1] ?? '';
    for (const element of ['button', 'input', 'select']) expect(inherit).toContain(element);
    expect(strip(readFileSync(path.join(uiDir, 'components/Field.module.css'), 'utf8'))).toMatch(/\.field textarea\s*\{[^}]*font:\s*inherit/);
  });
});

// The Code view styles are read as text: a style rule cannot be computed in Node, so what is checked is what the
// rules say. Focus visibility against the real layout, real contrast and the 320, 390 and 1280 px widths need
// `check:browser`.
describe('Code view styles', () => {
  const codeDir = path.join(ROOT, 'src/ui/screens/code');
  const files = readdirSync(codeDir)
    .filter((name) => name.endsWith('.module.css'))
    .sort();
  const sheets = new Map(files.map((name) => [name, readFileSync(path.join(codeDir, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')]));
  const OPT_IN = '@media (prefers-reduced-motion: no-preference)';

  /** Every transition, animation, keyframes rule and smooth scroll that is not inside the no-preference media query. */
  function motionOutsideOptIn(css: string): string[] {
    const open: string[] = [];
    const found: string[] = [];
    let buffer = '';
    const check = (): void => {
      const declaration = buffer.trim().replace(/\s+/g, ' ');
      buffer = '';
      const moves =
        /^(transition|animation)(-[a-z-]+)?\s*:(?!\s*none\s*$)/.test(declaration) || /^scroll-behavior\s*:\s*smooth/.test(declaration);
      if (moves && !open.includes(OPT_IN)) found.push(declaration);
    };
    for (const character of css) {
      if (character === '{') {
        const prelude = buffer.trim().replace(/\s+/g, ' ');
        if (prelude.startsWith('@keyframes') && !open.includes(OPT_IN)) found.push(prelude);
        open.push(prelude);
        buffer = '';
      } else if (character === '}') {
        check();
        open.pop();
      } else if (character === ';') {
        check();
      } else {
        buffer += character;
      }
    }
    return found;
  }

  /** The declarations of the first rule whose selector is exactly `selector`, or null. */
  function ruleBody(css: string, selector: string): string | null {
    for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (match[1]!.trim() === selector) return match[2]!;
    }
    return null;
  }

  it('R11.9 every transition, animation and smooth scroll sits inside the no-preference media query, so reduced motion gets none', () => {
    // The checker finds a move outside the opt-in and accepts one inside it.
    expect(motionOutsideOptIn('.a { transition: opacity 1s; }')).toHaveLength(1);
    expect(motionOutsideOptIn('.a { scroll-behavior: smooth; }')).toHaveLength(1);
    expect(motionOutsideOptIn('@keyframes spin { from { opacity: 0; } }')).toHaveLength(1);
    expect(motionOutsideOptIn(`${OPT_IN} { .a { transition: opacity 1s; animation: spin 1s; } }`)).toEqual([]);
    expect(motionOutsideOptIn('.a { transition: none; scroll-behavior: auto; }')).toEqual([]);
    expect(files.length).toBeGreaterThanOrEqual(4);
    for (const [name, css] of sheets) expect(motionOutsideOptIn(css), name).toEqual([]);
  });

  it('R11.2 no rule removes the focus ring, and the controls at the edge of a scroll region draw it inside', () => {
    for (const [name, css] of sheets) {
      expect(css, name).not.toMatch(/outline(-style|-width)?\s*:\s*(none|0)\b/);
    }
    const lineRow = sheets.get('LineRow.module.css')!;
    // The listing clips at its edge: the breakpoint control and the Bit_Line region keep the global ring, offset inwards.
    const inside = ruleBody(lineRow, '.breakpoint:focus-visible,\n.bits:focus-visible');
    expect(inside).not.toBeNull();
    expect(inside).toMatch(/outline-offset:\s*-\d+px/);
    expect(inside).not.toMatch(/outline\s*:/);
    // The global ring it keeps is 3 px, in the zari token (its contrast is checked in tests/ui/theme).
    const tokens = readFileSync(path.join(ROOT, 'src/ui/theme/tokens.css'), 'utf8');
    expect(tokens).toMatch(/:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--zari\)/);
  });

  it('R11.10 every button, field, select, breakpoint control and Bit_Line region is at least the Touch_Target tall, and a Line is as tall', () => {
    // The buttons and fields of the Code view are the shared Button and Field; their height comes from those modules.
    const components = path.join(ROOT, 'src/ui/components');
    const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '');
    const buttonSheet = strip(readFileSync(path.join(components, 'Button.module.css'), 'utf8'));
    const fieldSheet = strip(readFileSync(path.join(components, 'Field.module.css'), 'utf8'));
    expect(ruleBody(buttonSheet, '.button'), 'Button .button').toMatch(/min-height:\s*var\(--touch-target\)/);
    expect(ruleBody(fieldSheet, ".field input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']),\n.field select,\n.field textarea"), 'Field controls').toMatch(/min-height:\s*var\(--touch-target\)/);
    for (const [file, tag] of [
      ['CodeViewScreen.tsx', '<Button'],
      ['DiffPanel.tsx', '<Button'],
      ['CodeViewScreen.tsx', '<Field'],
      ['DiffPanel.tsx', '<Field'],
      ['LineRow.tsx', '<Button'],
    ] as const) {
      expect(readFileSync(path.join(codeDir, file), 'utf8'), `${file} uses ${tag}`).toContain(tag);
      expect(readFileSync(path.join(codeDir, file), 'utf8'), `${file} has no raw button`).not.toMatch(/<button\b/);
    }
    for (const [name, selector] of [['LineRow.module.css', '.bits']] as const) {
      const body = ruleBody(sheets.get(name)!, selector);
      expect(body, `${name} ${selector}`).not.toBeNull();
      expect(body, `${name} ${selector}`).toMatch(/min-height:\s*var\(--touch-target\)/);
    }
    expect(ruleBody(sheets.get('CodeViewScreen.module.css')!, '.screen')).toMatch(/--code-line-height:\s*var\(--touch-target\)/);
    const line = ruleBody(sheets.get('LineRow.module.css')!, '.line')!;
    expect(line).toMatch(/height:\s*var\(--code-line-height\)/);
    // A border would take a pixel of the row from its controls; the separator is a shadow.
    expect(line).not.toMatch(/(^|[;\s])border(-[a-z]+)?\s*:/);
  });

  it('R11.8 no container is a fixed width wider than 320 px, and only the Bit_Line region and the entries region scroll sideways', () => {
    for (const [name, css] of sheets) {
      for (const match of css.matchAll(/(?:^|[;{\s])(width|min-width)\s*:\s*([\d.]+)px/g)) {
        expect(Number(match[2]), `${name} ${match[1]}: ${match[2]}px`).toBeLessThanOrEqual(320);
      }
    }
    const sideways = (css: string): string[] =>
      [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .filter((match) => /overflow(-x)?\s*:\s*(auto|scroll)/.test(match[2]!))
        .map((match) => match[1]!.trim());
    expect(sideways(sheets.get('LineRow.module.css')!)).toEqual(['.bits']);
    expect(sideways(sheets.get('DiffPanel.module.css')!)).toEqual(['.entries', '.textArea']);
    // The Bit_Line region and the entries region shrink to their column, and the listing never grows past it.
    expect(ruleBody(sheets.get('LineRow.module.css')!, '.bits')).toMatch(/min-width:\s*0/);
    expect(ruleBody(sheets.get('DiffPanel.module.css')!, '.entries')).toMatch(/max-width:\s*100%/);
    expect(ruleBody(sheets.get('Listing.module.css')!, '.scroller')).toMatch(/max-width:\s*100%/);
    // The Bit_Line text never wraps onto a second visual row.
    expect(ruleBody(sheets.get('LineRow.module.css')!, '.bitsText')).toMatch(/white-space:\s*pre\b/);
  });
});
