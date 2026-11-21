import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { suggestRepairs } from '../../../src/repair/index.ts';
import type { RepairResult } from '../../../src/repair/index.ts';
import { DICTIONARIES, translator } from '../../../src/ui/i18n/messages.ts';
import { LineItem } from '../../../src/ui/screens/code/LineRow.tsx';
import { KeepView } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import type { KeepViewProps } from '../../../src/ui/screens/keep/KeepScreen.tsx';
import { RepairNotice } from '../../../src/ui/screens/weave/RepairNotice.tsx';
import { RepairPanelView, skipKey } from '../../../src/ui/screens/weave/RepairPanel.tsx';
import { highConfidenceItems } from '../../../src/ui/screens/weave/repairText.ts';
import { TryIt } from '../../../src/ui/screens/weave/TryIt.tsx';
import { generateSample, sampleWithLostCards } from '../../../src/ui/samples/sampleDesigns.ts';
import { initialKeepForm } from '../../../src/ui/state/keep.ts';
import type { Language } from '../../../src/ui/types.ts';
import { alertTexts } from '../../support/notices.ts';
import { demoProfile } from '../../support/profiles.ts';
const profile = demoProfile();
const noop = (): void => undefined;
const lost = sampleWithLostCards(profile);
const result = suggestRepairs(lost, profile);
function panel(language: Language, overrides: Partial<Parameters<typeof RepairPanelView>[0]> = {}, shown: RepairResult = result): string {
  return renderToStaticMarkup(
    <RepairPanelView
      result={shown}
      profile={profile}
      skipped={new Set()}
      t={translator(DICTIONARIES, language)}
      onAccept={noop}
      onAcceptAllHigh={noop}
      onSkip={noop}
      onShowAgain={noop}
      {...overrides}
    />,
  );
}
function notice(language: Language, overrides: Partial<Parameters<typeof RepairNotice>[0]> = {}): string {
  return renderToStaticMarkup(
    <RepairNotice
      gapCount={3}
      repairedPicks={[]}
      canUndo={false}
      profile={profile}
      pattern={lost}
      t={translator(DICTIONARIES, language)}
      dispatch={noop}
      {...overrides}
    />,
  );
}
describe('R3.1 the notice on Weave', () => {
  const t = translator(DICTIONARIES, 'en');
  it('R3.1 N gaps show "N cards could not be read" and a Suggest repairs button', () => {
    const html = notice('en');
    expect(html).toContain('3 cards could not be read');
    expect(html).toContain(`>${t('weave.repair.suggest')}<`);
    expect(html).toContain('aria-expanded="false"');
    expect(notice('en', { gapCount: 1 })).toContain('1 card could not be read');
  });
  it('R3.1 no gaps and no repairs show nothing at all', () => {
    expect(notice('en', { gapCount: 0 })).toBe('');
  });
  it('R3.1 the button is disabled until the card profile is loaded', () => {
    expect(notice('en', { profile: null })).toMatch(/<button[^>]*disabled=""[^>]*>Suggest repairs/);
  });
  it('R4.2 accepted repairs are listed from pick 1 with an Undo, enabled only when there is something to undo', () => {
    const html = notice('en', { gapCount: 1, repairedPicks: [4, 15], canUndo: true });
    expect(html).toContain(t('weave.repair.repaired', { picks: '5, 16' }));
    expect(html).toMatch(/<button(?![^>]*disabled)[^>]*>Undo the last accepted repair/);
    expect(notice('en', { gapCount: 0, repairedPicks: [4], canUndo: false })).toMatch(/<button[^>]*disabled=""[^>]*>Undo the last accepted repair/);
    expect(notice('en', { gapCount: 0, repairedPicks: [4], canUndo: false })).not.toContain(t('weave.repair.suggest'));
  });
  it('R6.1 the notice reads in Hindi from the translation file', () => {
    const hi = translator(DICTIONARIES, 'hi');
    const html = notice('hi');
    expect(html).toContain(hi('weave.repair.suggest'));
    expect(hi('weave.repair.suggest')).not.toBe(t('weave.repair.suggest'));
  });
});
describe('R3.2 the panel', () => {
  const t = translator(DICTIONARIES, 'en');
  it('R3.2 it lists every gap with kind and confidence in words, evidence, a drawing, Accept and Skip, and the honest sentence once', () => {
    const html = panel('en');
    if (!result.ok) throw new Error('failed');
    expect(result.gaps).toHaveLength(3);
    expect(html.split(t('repair.guesses')).length - 1).toBe(1);
    for (const gap of result.gaps) expect(html).toContain(t('repair.gap', { pick: gap.pick + 1, state: t(`repair.gap.${gap.gapKind}`) }));
    const suggestions = result.gaps.flatMap((gap) => gap.suggestions);
    expect(html.split('role="img"').length - 1).toBe(suggestions.length);
    expect(html.split(`>${t('repair.accept')}<`).length - 1).toBe(suggestions.length);
    expect(html.split(`>${t('repair.skip')}<`).length - 1).toBe(suggestions.length);
    expect(html).toContain(t('repair.confidence.high'));
    expect(html).toContain(t('repair.kind.repeat'));
    expect(html).toContain(t('repair.kind.mirror'));
    expect(html).toContain('Cards repeat every 12 picks');
  });
  it('R3.2 each drawing uses a filled circle for a punched hole and a ring for one that is not, and says how many are punched', () => {
    const html = panel('en');
    if (!result.ok) throw new Error('failed');
    const cards = result.gaps.flatMap((gap) => gap.suggestions.map((suggestion) => suggestion.card));
    const punched = cards.reduce((sum, card) => sum + card.flat().filter(Boolean).length, 0);
    const unpunched = cards.reduce((sum, card) => sum + card.flat().filter((hole) => !hole).length, 0);
    const classCount = (name: string): number => (html.match(new RegExp(`<circle[^>]*class="[^"]*${name}[^"]*"`, 'g')) ?? []).length;
    expect(classCount('punchedHole')).toBe(punched);
    expect(classCount('unpunchedMark')).toBe(unpunched);
    expect(html).toMatch(/aria-label="Proposed card: \d+ of 192 hook positions punched"/);
    expect(html).toContain(t('repair.legend'));
  });
  it('R6.1 every control and drawing has a non-empty accessible name, and nothing is a div with a click', () => {
    const html = panel('en');
    for (const match of html.matchAll(/<button[^>]*aria-label="([^"]*)"/g)) expect(match[1]!.trim()).not.toBe('');
    for (const match of html.matchAll(/<button[^>]*>([^<]*)<\/button>/g)) expect(match[1]!.trim()).not.toBe('');
    expect(html).not.toMatch(/<div[^>]*onclick/i);
    expect(html).toContain('aria-label="Accept this guess: pick 5, The design repeats"');
  });
  it('R6.1 the panel reads in Hindi', () => {
    const hi = translator(DICTIONARIES, 'hi');
    const html = panel('hi');
    expect(html).toContain(hi('repair.guesses'));
    expect(html).toContain(hi('repair.accept'));
  });
  it('R4.3 "Accept all high-confidence" is a separate secondary button, disabled when nothing is high', () => {
    const html = panel('en');
    expect(html).toContain(`>${t('repair.acceptAll')}<`);
    expect(html).toMatch(/<button[^>]*class="[^"]*secondary[^"]*"[^>]*>Accept all high-confidence/);
    const lowOnly = suggestRepairs([null, 1, null].map((v) => (v === null ? null : lost[0])), profile);
    expect(panel('en', {}, lowOnly)).toMatch(/<button[^>]*disabled=""[^>]*>Accept all high-confidence/);
  });
  it('R2.2 a conflicting gap says so and shows both suggestions', () => {
    const diamond = generateSample(profile, 'diamond');
    const [a, b, c] = [diamond[0]!, diamond[3]!, diamond[6]!];
    // a b a _ a b a c a b a c: the repeat says c, the neighbours of the lost pick say a.
    const conflicting = suggestRepairs([a, b, a, null, a, b, a, c, a, b, a, c], profile);
    if (!conflicting.ok) throw new Error('failed');
    const gap = conflicting.gaps[0]!;
    expect(gap.conflict).toBe(true);
    const html = panel('en', {}, conflicting);
    expect(html).toContain(t('repair.conflict'));
    expect(html.split(`>${t('repair.accept')}<`).length - 1).toBe(gap.suggestions.length);
    expect(gap.suggestions.length).toBeGreaterThanOrEqual(2);
  });
  it('R1.2 a gap with no suggestion says why, and an invalid input is an alert', () => {
    const none = suggestRepairs([null, [], null], profile);
    expect(panel('en', {}, none)).toContain(t('repair.none.no-readable-cards'));
    const failed = suggestRepairs(lost, {});
    expect(alertTexts(panel('en', {}, failed)).some((text) => text.startsWith('The card profile is not valid'))).toBe(true);
  });
  it('R2.1 the kinds that did not apply are explained in words', () => {
    const html = panel('en');
    expect(html).toContain(t('repair.why'));
    expect(html).toContain(t('repair.notApplied.at-chain-edge'));
  });
  it('R3.2 a skipped suggestion shows that nothing changed and offers to show it again', () => {
    if (!result.ok) throw new Error('failed');
    const gap = result.gaps[0]!;
    const html = panel('en', { skipped: new Set([skipKey(gap.pick, gap.suggestions[0]!.kind)]) });
    expect(html).toContain(t('repair.skipped'));
    expect(html).toContain(`>${t('repair.showAgain')}<`);
  });
  it('R4.3 the high-confidence list takes the first suggestion of each gap that is high and not conflicting', () => {
    if (!result.ok) throw new Error('failed');
    const items = highConfidenceItems(result.gaps);
    expect(items.map((item) => item.pick)).toEqual(result.gaps.map((gap) => gap.pick));
    const conflicted = result.gaps.map((gap) => ({ ...gap, conflict: true }));
    expect(highConfidenceItems(conflicted)).toEqual([]);
    const low = result.gaps.map((gap) => ({ ...gap, suggestions: gap.suggestions.map((s) => ({ ...s, confidence: 'low' as const })) }));
    expect(highConfidenceItems(low)).toEqual([]);
  });
});
describe('marks and notices elsewhere', () => {
  const t = translator(DICTIONARIES, 'en');
  const line = { kind: 'bits' as const, pick: 4, bits: '0101' };
  function lineHtml(repaired: boolean): string {
    return renderToStaticMarkup(
      <ol>
        <LineItem line={line} selected={false} breakpoint={false} pickWidth={2} hookColumns={4} t={t} onToggleBreakpoint={noop} repaired={repaired} />
      </ol>,
    );
  }
  it('R4.1 a repaired pick says "repaired (a guess)" in words and in its accessible name; a read pick does not', () => {
    const marked = lineHtml(true);
    expect(marked).toContain('>repaired (a guess)<');
    expect(marked).toMatch(/aria-label="[^"]*, repaired \(a guess\)"/);
    expect(lineHtml(false)).not.toContain('repaired');
  });
  it('R5.2 Keep shows one line about guesses next to the export only when there are repaired picks', () => {
    const props = (repairedCount: number): KeepViewProps => ({
      profile,
      pattern: lost,
      form: initialKeepForm,
      designs: [],
      pendingDeleteId: null,
      savedText: null,
      exportDone: false,
      failureKey: null,
      t,
      onFormAction: noop,
      onExport: noop,
      onSave: noop,
      onOpen: noop,
      onDeleteRequest: noop,
      onDeleteConfirm: noop,
      onDeleteCancel: noop,
      repairedCount,
    });
    expect(renderToStaticMarkup(<KeepView {...props(2)} />)).toContain(t('keep.export.guesses'));
    expect(renderToStaticMarkup(<KeepView {...props(0)} />)).not.toContain(t('keep.export.guesses'));
  });
  it('R7.1 Try it offers the design with lost cards and says what to press next', () => {
    const html = renderToStaticMarkup(<TryIt profile={profile} confirm={null} dispatch={noop} t={t} />);
    expect(html).toContain(`>${t('tryit.lost')}<`);
    expect(html).toContain(t('tryit.lost.hint'));
  });
});
describe('R8.1 the repair code stays out of the entry chunk', () => {
  const root = path.resolve(import.meta.dirname, '../../../src/ui');
  function files(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)],
    );
  }
  it('R8.1 only the panel and its text helper import src/repair as code, and the notice loads the panel with import()', () => {
    const importers = files(root)
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => /^\s*import\s+(?!type\b)[^;]*from\s+['"][./]*repair\/index\.ts['"]/m.test(readFileSync(file, 'utf8')))
      .map((file) => path.relative(root, file));
    expect(importers).toEqual(['screens/weave/RepairPanel.tsx']);
    const staticPanelImports = files(root).filter((file) =>
      /^\s*import\s+(?!type\b)[^;]*from\s+['"]\.\/RepairPanel\.tsx['"]/m.test(readFileSync(file, 'utf8')),
    );
    expect(staticPanelImports).toEqual([]);
    expect(readFileSync(path.join(root, 'screens/weave/RepairNotice.tsx'), 'utf8')).toContain("import('./RepairPanel.tsx')");
  });
  it('R6.1 the panel styles wrap long text and keep drawings inside the page', () => {
    const css = readFileSync(path.join(root, 'screens/weave/Repair.module.css'), 'utf8');
    expect(css).toMatch(/\.drawing\s*{[^}]*max-width:\s*100%/);
    // The panel's buttons are the shared Button, whose height is the touch target.
    expect(readFileSync(path.join(root, 'components/Button.module.css'), 'utf8')).toMatch(/\.button\s*{[^}]*min-height:\s*var\(--touch-target\)/);
    expect(css).toMatch(/\.evidence\s*{[^}]*overflow-wrap:\s*anywhere/);
  });
});
