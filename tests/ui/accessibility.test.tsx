import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Shell } from '../../src/ui/App.tsx';
import { DICTIONARIES, translator } from '../../src/ui/i18n/messages.ts';
import { KeepView } from '../../src/ui/screens/keep/KeepScreen.tsx';
import type { KeepViewProps } from '../../src/ui/screens/keep/KeepScreen.tsx';
import { ScanView } from '../../src/ui/screens/scan/ScanScreen.tsx';
import type { ScanViewProps } from '../../src/ui/screens/scan/ScanScreen.tsx';
import { generateSample } from '../../src/ui/samples/sampleDesigns.ts';
import { gapPickNumbers } from '../../src/ui/state/cloth.ts';
import { EMPTY_METADATA, initialKeepForm } from '../../src/ui/state/keep.ts';
import { initialAppState } from '../../src/ui/state/appState.ts';
import { initialScanState, readPhoto, scanReducer } from '../../src/ui/state/scan.ts';
import type { Language, ScanState } from '../../src/ui/types.ts';
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
    if (ariaLabel(match[2]!) === '') missing.push(`${match[1]} ${match[2]}`);
  }
  for (const match of html.matchAll(/<(canvas|svg|img)\b([^>]*)>/g)) {
    if (/aria-hidden="true"/.test(match[2]!)) continue;
    const named = ariaLabel(match[2]!) !== '' || /\balt="[^"]+"/.test(match[2]!);
    if (!named) missing.push(`${match[1]} ${match[2]}`);
  }
  return missing;
}

describe('text names in both languages', () => {
  it('R14.4 every button, form control and image on the Weave, Keep and Scan screens has a text name', async () => {
    // The checker itself finds an unnamed button, an unnamed field and an unnamed image.
    expect(unnamed('<button type="button"></button><input type="text"/><canvas></canvas>')).toHaveLength(3);
    const profile = demoProfile();
    const pattern = generateSample(profile, 'diamond');
    const scanned = await readScan(true);
    for (const language of LANGUAGES) {
      const shell = renderToStaticMarkup(
        <Shell
          state={{ ...initialAppState, language, profile: { status: 'ready', profile }, current: { pattern, origin: { kind: 'sample', design: 'diamond' } } }}
          dispatch={noop}
        />,
      );
      const pages = {
        weave: shell,
        keep: keepView(language),
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
      expect(keepView(language, { failureKey: 'error.archive.write-failed' })).toMatch(
        new RegExp(`<p role="alert"[^>]*>${escape(t('error.archive.write-failed'))}</p>`),
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
        expect(query[1]!.trim(), `${path.relative(uiDir, file)} has a media query`).toBe('(prefers-reduced-motion: reduce)');
      }
    }
    expect(/(?:^|\n)body\s*\{([^}]*)\}/.exec(tokens)?.[1] ?? '').not.toMatch(/font-size/);
    // Controls take the page font. Buttons, inputs and selects through the token sheet, the Keep text area by its class.
    const inherit = /([^{}]*)\{[^}]*font:\s*inherit[^}]*\}/.exec(tokens)?.[1] ?? '';
    for (const element of ['button', 'input', 'select']) expect(inherit).toContain(element);
    expect(strip(readFileSync(path.join(uiDir, 'screens/keep/KeepScreen.module.css'), 'utf8'))).toMatch(/\.input\s*\{[^}]*font:\s*inherit/);
  });
});
