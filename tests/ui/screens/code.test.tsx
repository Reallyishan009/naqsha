import { lazy, Suspense } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ScreenBoundary, Shell, screenErrorKey } from '../../../src/ui/App.tsx';
import { DICTIONARIES, EN, HI, translator } from '../../../src/ui/i18n/messages.ts';
import { generateSample } from '../../../src/ui/samples/sampleDesigns.ts';
import {
  CODE_VIEW_MARKER,
  ClothFailure,
  CodeViewScreen,
  createStillPlayer,
  currentLineSetOf,
  showSelectedPick,
} from '../../../src/ui/screens/code/CodeViewScreen.tsx';
import { scrollLeftAfterKey } from '../../../src/ui/screens/code/LineRow.tsx';
import {
  firstVisiblePickAt,
  listingWindow,
  scrollTopToShowPick,
} from '../../../src/ui/screens/code/Listing.tsx';
import { WINDOW_SIZE, pickControlOutcome } from '../../../src/ui/state/codeView.ts';
import type { PickControl } from '../../../src/ui/state/codeView.ts';
import { focusTargetAfterWindowMove, lineAccessibleName } from '../../../src/ui/state/codeView.ts';
import {
  DIFF_MARKERS,
  DIFF_PICK_LIMIT,
  GROUP_SEPARATOR,
  diffPatterns,
  diffToText,
  groupBits,
  patternToLines,
} from '../../../src/codec-view/index.ts';
import type { Diff, Line, LineSet } from '../../../src/codec-view/index.ts';
import { saveDesign } from '../../../src/archive/index.ts';
import type { ArchiveDeps, DesignSummary, SavedDesign } from '../../../src/archive/index.ts';
import { endsPerPick } from '../../../src/codec/index.ts';
import type { CardProfile, Pattern } from '../../../src/codec/index.ts';
import {
  CHANGED_MARK,
  DiffPanelView,
  compareDesigns,
  diffControlState,
  endTextIndex,
  isSameDesign,
  keepIfListed,
  loadSummaries,
  lowestDamagedPick,
  markerLine,
  needsFreshList,
  refusalMessage,
  runComparison,
} from '../../../src/ui/screens/code/DiffPanel.tsx';
import type { Comparison, DiffPanelViewProps, Summaries } from '../../../src/ui/screens/code/DiffPanel.tsx';
import {
  DIFF_TEXT_FILE_NAME,
  DIFF_TEXT_MIME_TYPE,
  copyDiffText,
  diffTextBytes,
  diffTextStatusKey,
  downloadDiffText,
} from '../../../src/ui/screens/code/diffText.ts';
import type { DiffTextDeps } from '../../../src/ui/screens/code/diffText.ts';
import { diffEntryAccessibleName } from '../../../src/ui/state/codeView.ts';
import { EMPTY_METADATA } from '../../../src/ui/state/keep.ts';
import type { SimFailure, SimImage } from '../../../src/simulator/index.ts';
import { appReducer, initialAppState } from '../../../src/ui/state/appState.ts';
import { buildReadyCloth } from '../../../src/ui/state/cloth.ts';
import { FakeArchiveStore, FakeDownloadDeps, FakeScheduler } from '../../support/fakes.ts';
import { demoProfile } from '../../support/profiles.ts';
import type { AppAction, AppState, Language, Screen } from '../../../src/ui/types.ts';

const SCREENS: Screen[] = ['weave', 'keep', 'scan', 'code'];
const LANGUAGES: Language[] = ['hi', 'en'];

function navHtml(state: AppState): string {
  const html = renderToStaticMarkup(<Shell state={state} dispatch={() => undefined} />);
  return /<nav[^>]*>(.*?)<\/nav>/.exec(html)?.[1] ?? '';
}

function codeLabel(language: Language): string {
  return language === 'en' ? (EN['nav.code'] as string) : (HI['nav.code']?.text as string);
}

describe('Code view screen', () => {
  it('R2.1 a fourth navigation control, labelled Code, sits beside Weave, Keep and Scan on every screen', () => {
    for (const screen of SCREENS) {
      for (const language of LANGUAGES) {
        const nav = navHtml({ ...initialAppState, screen, language });
        expect(nav.match(/<button/g)?.length, `${screen} ${language}`).toBe(4);
        expect(nav, `${screen} ${language}`).toContain(`>${codeLabel(language)}<`);
      }
    }
  });

  it('R2.1 activating the Code control shows the Code view screen with its listing', () => {
    const t = translator(DICTIONARIES, 'en');
    const ready: AppState = { ...initialAppState, language: 'en', profile: { status: 'ready', profile: demoProfile() } };
    const opened = appReducer(ready, { type: 'navigate', screen: 'code' });
    expect(opened.screen).toBe('code');
    // The shell marks the Code control as the current page; the screen itself arrives from its own chunk.
    expect(/aria-current="page"[^>]*>Code</.test(navHtml(opened))).toBe(true);

    const empty = renderToStaticMarkup(<CodeViewScreen state={opened} dispatch={() => undefined} t={t} />);
    expect(empty).toContain(`>${EN['codeview.title']}</h2>`);
    expect(empty).toContain(EN['codeview.empty'] as string);
    expect(empty).not.toContain(CODE_VIEW_MARKER);

    const pattern = generateSample(demoProfile(), 'diamond');
    const withPicks: AppState = { ...opened, current: { pattern, origin: { kind: 'sample', design: 'diamond' } } };
    const html = renderToStaticMarkup(<CodeViewScreen state={withPicks} dispatch={() => undefined} t={t} />);
    expect(html).toContain(`id="${CODE_VIEW_MARKER}"`);
    expect(html).toContain(t('codeview.profile', { name: demoProfile().name }));
    expect(html).toContain(t('codeview.pickCount', { count: pattern.length }));
    expect(html).not.toContain(EN['codeview.empty'] as string);
  });

  it('R9.10 a rejecting lazy import shows the Code view load message and leaves the navigation operable', async () => {
    for (const language of LANGUAGES) {
      const t = translator(DICTIONARIES, language);
      const message = t(screenErrorKey('code'));
      expect(message).toBe(language === 'en' ? EN['error.codeview.load'] : HI['error.codeview.load']?.text);
      expect(screenErrorKey('weave')).toBe('error.generic');

      // React rethrows a rejected lazy import while rendering: the first render waits, the next one throws.
      const Failing = lazy(() => Promise.reject(new Error('chunk failed')));
      renderToStaticMarkup(
        <Suspense fallback={null}>
          <Failing />
        </Suspense>,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(() => renderToStaticMarkup(<Failing />)).toThrow('chunk failed');

      // The boundary turns that throw into the message. Server rendering cannot run a boundary, so its failed state is set directly.
      const boundary = new ScreenBoundary({ message, children: null });
      boundary.state = ScreenBoundary.getDerivedStateFromError();
      expect(renderToStaticMarkup(boundary.render())).toContain(message.replaceAll("'", '&#x27;'));

      // The navigation sits outside the boundary, so all four controls remain.
      const nav = navHtml({ ...initialAppState, screen: 'code', language });
      expect(nav.match(/<button/g)?.length).toBe(4);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The listing and one Line. These render on the server: the test environment is Node with no DOM, so what a
// scroll event or a keydown does in a browser is not exercised here; the pure functions behind them are.
// ---------------------------------------------------------------------------------------------------------------

const en = translator(DICTIONARIES, 'en');

function readyState(pattern: Pattern, extra: Partial<AppState> = {}): AppState {
  return {
    ...initialAppState,
    language: 'en',
    screen: 'code',
    profile: { status: 'ready', profile: demoProfile() },
    current: { pattern, origin: { kind: 'sample', design: 'diamond' } },
    ...extra,
  };
}

function render(state: AppState): string {
  return renderToStaticMarkup(<CodeViewScreen state={state} dispatch={() => undefined} t={en} />);
}

/** A pattern of `pickCount` picks made of the sample's cards repeated. */
function patternOf(pickCount: number): Pattern {
  const base = generateSample(demoProfile(), 'diamond');
  return Array.from({ length: pickCount }, (_, pick) => base[pick % base.length]!);
}

/** The markup of each Line of the listing, from its opening tag to the next one. */
function lineItems(html: string): string[] {
  return html.split('<li ').slice(1);
}

function pickOf(item: string): number {
  return Number(/data-pick="(\d+)"/.exec(item)?.[1]);
}

/** The aria-hidden spans of a Line, in order: the marks column, then the pick number. */
function hiddenSpans(item: string): string[] {
  return [...item.matchAll(/<span[^>]*aria-hidden="true"[^>]*>([^<]*)<\/span>/g)].map((match) => match[1]!);
}

function bitsRegion(item: string): string | undefined {
  return /<div[^>]*role="group"[^>]*>\s*<span[^>]*>([^<]*)<\/span>/.exec(item)?.[1];
}

describe('Code view listing', () => {
  it('R2.2 a Line shows its pick number and its Bit_Line with a Group_Separator between groups only', () => {
    const profile = demoProfile();
    const pattern = patternOf(6);
    const result = patternToLines(profile, pattern);
    if (!result.ok) throw new Error('the sample pattern must give Lines');
    const html = render(readyState(pattern));
    const items = lineItems(html);
    expect(items.map(pickOf)).toEqual([0, 1, 2, 3, 4, 5]);

    for (const [index, item] of items.entries()) {
      const line = result.lineSet.lines[index]!;
      if (line.kind !== 'bits') throw new Error('the sample cards are valid');
      const text = bitsRegion(item)!;
      expect(text).toBe(groupBits(line.bits, profile.hookColumns));
      const groups = text.split('|');
      expect(groups).toHaveLength(profile.hookRows);
      expect(groups.every((group) => group.length === profile.hookColumns && /^[01]+$/.test(group))).toBe(true);
      expect(text.replaceAll('|', '')).toHaveLength(profile.hookRows * profile.hookColumns);
      expect(item).toContain(`aria-label="Pick ${index} bits"`);
      expect(item).toMatch(/role="group"[^>]*tabindex="0"[^>]*aria-label="Pick \d+ bits"/);
      expect(item).toContain('aria-pressed="false"');
      expect(item).toContain(`aria-label="Breakpoint on pick ${index}"`);
      const ends = [...line.bits].flatMap((bit, end) => (bit === '1' ? [end] : []));
      expect(item).toContain(
        ends.length === 0 ? `aria-label="Pick ${index}: no end punched"` : `aria-label="Pick ${index}: punched at ends ${ends.join(', ')}"`,
      );
    }
    // The Selected_Pick is pick 0 and carries aria-current; no other Line does.
    expect(items.map((item) => item.includes('aria-current="true"'))).toEqual([true, false, false, false, false, false]);
  });

  it('R2.3 pick numbers are padded to the width of the largest pick index at 9, 10, 11 and 10,000 picks', () => {
    for (const [pickCount, width] of [
      [9, 1],
      [10, 1],
      [11, 2],
      [10_000, 4],
      [10_001, 5],
    ] as const) {
      const html = render(readyState(patternOf(pickCount), { selectedPick: 0 }));
      const items = lineItems(html);
      expect(items.length).toBeLessThanOrEqual(WINDOW_SIZE);
      for (const item of items) {
        const [marks, pickNumber] = hiddenSpans(item);
        expect(pickNumber, `${pickCount} picks`).toBe(String(pickOf(item)).padStart(width, ' '));
        // The marks column and the pick number take the same width on every Line, so every Bit_Line starts at one offset.
        expect(marks!.length + pickNumber!.length).toBe(3 + width);
      }
    }
    const last = lineItems(render(readyState(patternOf(10_000), { selectedPick: 9_999 }))).at(-1)!;
    expect(hiddenSpans(last)[1]).toBe('9999');
  });

  it('R2.4 R2.7 a 10,000-pick pattern keeps at most Window_Size Lines and moves the Window to the Selected_Pick', () => {
    const pattern = patternOf(10_000);
    for (const selectedPick of [0, 40, 5_000, 9_999, 3]) {
      const html = render(readyState(pattern, { selectedPick }));
      const items = lineItems(html);
      const picks = items.map(pickOf);
      expect(items.length).toBeLessThanOrEqual(WINDOW_SIZE);
      expect(picks).toContain(selectedPick);
      expect(picks).toEqual(picks.map((_, offset) => picks[0]! + offset));
      expect(items.filter((item) => item.includes('aria-current="true"'))).toHaveLength(1);
      // The Window is offset by its first pick, and the spacer is as tall as every Line.
      expect(html).toContain(`translateY(calc(var(--code-line-height) * ${picks[0]}))`);
      expect(html).toContain('height:calc(var(--code-line-height) * 10000)');
    }
    // Fewer picks than Window_Size: every Line is in the document.
    expect(lineItems(render(readyState(patternOf(WINDOW_SIZE - 1)))).map(pickOf)).toHaveLength(WINDOW_SIZE - 1);
  });

  it('R2.11 while the user scrolls, every Line inside the viewport is in the Window, and the Window stays small', () => {
    for (const [selectedPick, firstVisiblePick, visiblePicks] of [
      [0, 0, 12],
      [0, 5_000, 12],
      [9_999, 40, 20],
      [5_000, 5_030, 40],
    ] as const) {
      const shown = listingWindow(null, 10_000, selectedPick, firstVisiblePick, visiblePicks);
      expect(shown.count).toBeLessThanOrEqual(WINDOW_SIZE);
      expect(shown.from).toBeLessThanOrEqual(firstVisiblePick);
      expect(shown.from + shown.count).toBeGreaterThanOrEqual(firstVisiblePick + visiblePicks);
    }
    // Scroll position and Line height give the first Line in view; a Selected_Pick below the viewport is scrolled to.
    expect(firstVisiblePickAt(0, 48)).toBe(0);
    expect(firstVisiblePickAt(48 * 7 + 5, 48)).toBe(7);
    expect(scrollTopToShowPick(100, 48, 0, 480)).toBe(100 * 48 + 48 - 480);
    expect(scrollTopToShowPick(2, 48, 480, 480)).toBe(96);
    expect(scrollTopToShowPick(12, 48, 480, 480)).toBe(480);
  });

  it('R2.9 a damaged card shows its pick number and the damaged label with no Bit_Line, and the other Lines keep theirs', () => {
    const pattern = patternOf(6).map((card, pick) => (pick === 2 ? card.slice(1) : card));
    const items = lineItems(render(readyState(pattern)));
    expect(items).toHaveLength(6);
    for (const item of items) {
      if (pickOf(item) === 2) {
        expect(item).toContain('aria-label="Pick 2: damaged card"');
        expect(item).toContain('>Damaged card</p>');
        expect(bitsRegion(item)).toBeUndefined();
        expect(item).not.toContain('tabindex');
        expect(hiddenSpans(item)[1]).toBe('2');
      } else {
        expect(bitsRegion(item)).toMatch(/^[01|]+$/);
      }
    }
  });

  it('R2.8 the header shows the number of picks as a numeral and the Card_Profile name', () => {
    const profile = demoProfile();
    const html = render(readyState(patternOf(10_000)));
    expect(html).toContain(en('codeview.pickCount', { count: 10_000 }));
    expect(html).toContain('10000 picks');
    expect(html).toContain(profile.name);
    expect(lineItems(html).length).toBeGreaterThan(0);
  });

  it('R2.11 R11.11 Home and End take a Bit_Line region to its first and last end, and the arrows move one character cell', () => {
    // A real keydown needs a DOM, which the Node test environment does not have, so the key-to-scroll function is checked.
    const scrollWidth = 1_000;
    const cell = 8;
    expect(scrollLeftAfterKey('Home', 400, scrollWidth, cell)).toBe(0);
    expect(scrollLeftAfterKey('End', 400, scrollWidth, cell)).toBe(scrollWidth);
    expect(scrollLeftAfterKey('ArrowRight', 400, scrollWidth, cell)).toBe(408);
    expect(scrollLeftAfterKey('ArrowLeft', 400, scrollWidth, cell)).toBe(392);
    expect(scrollLeftAfterKey('ArrowLeft', 3, scrollWidth, cell)).toBe(0);
    expect(scrollLeftAfterKey('ArrowRight', 998, scrollWidth, cell)).toBe(scrollWidth);
    expect(scrollLeftAfterKey('Tab', 400, scrollWidth, cell)).toBeNull();
    expect(scrollLeftAfterKey('ArrowDown', 400, scrollWidth, cell)).toBeNull();
  });

  it('R3.7 R3.11 a Breakpoint and the Selected_Pick are each marked with a shape, and both show on one Line', () => {
    const items = lineItems(render(readyState(patternOf(6), { selectedPick: 1, breakpoints: [1, 3] })));
    const marks = items.map((item) => hiddenSpans(item)[0]);
    const none = '   ';
    expect(marks).toEqual([none, '▶ ●', none, '  ●', none, none]);
    expect(items.map((item) => item.includes('aria-pressed="true"'))).toEqual([false, true, false, true, false, false]);
    expect(items.map((item) => item.includes('aria-current="true"'))).toEqual([false, true, false, false, false, false]);
  });

  it('R3.13 a Breakpoint on a pick whose Line left the Window is kept and shown again when the Line returns', () => {
    const pattern = patternOf(10_000);
    const opened = readyState(pattern, { breakpoints: [5] });
    const shows = (state: AppState): boolean =>
      lineItems(render(state)).some((item) => pickOf(item) === 5 && hiddenSpans(item)[0]!.includes('●'));

    expect(shows(opened)).toBe(true);
    const away = appReducer(opened, { type: 'select-pick', pick: 5_000 });
    expect(lineItems(render(away)).map(pickOf)).not.toContain(5);
    expect(away.breakpoints).toEqual([5]);
    const back = appReducer(away, { type: 'select-pick', pick: 5 });
    expect(back.breakpoints).toEqual([5]);
    expect(shows(back)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Step, jump and run to next breakpoint. The test environment is Node with server rendering only, so a click
// cannot be simulated. Each handler of the screen is `pickControlOutcome` followed by a dispatch of its actions,
// so these tests run that function, feed its actions through `appReducer`, and check the rendered controls.
// ---------------------------------------------------------------------------------------------------------------

/** The opening tag of the first `<button>` whose text is `label`. */
function buttonTag(html: string, label: string): string {
  const found = new RegExp(`<button[^>]*>${label}</button>`).exec(html);
  if (found === null) throw new Error(`no button labelled "${label}"`);
  return found[0];
}

/** Runs one control on `state` as the screen does: take its actions, then dispatch each through the reducer. */
function activate(state: AppState, control: PickControl, jumpText?: string) {
  const outcome = pickControlOutcome({
    control,
    selectedPick: state.selectedPick,
    pickCount: state.current.pattern.length,
    breakpoints: state.breakpoints,
    ...(jumpText === undefined ? {} : { jumpText }),
  });
  const after = outcome.actions.reduce<AppState>((current, action) => appReducer(current, action), state);
  return { outcome, after };
}

function announcements(actions: ReadonlyArray<AppAction>): AppAction[] {
  return actions.filter((action) => action.type === 'announce');
}

describe('Code view controls', () => {
  it('R3.3 R3.12 step back is disabled on pick 0 and step forward on the last pick index, and neither does anything there', () => {
    const pattern = patternOf(5);
    const first = render(readyState(pattern, { selectedPick: 0 }));
    expect(buttonTag(first, en('codeview.step.back'))).toContain('disabled=""');
    expect(buttonTag(first, en('codeview.step.forward'))).not.toContain('disabled');
    const last = render(readyState(pattern, { selectedPick: 4 }));
    expect(buttonTag(last, en('codeview.step.forward'))).toContain('disabled=""');
    expect(buttonTag(last, en('codeview.step.back'))).not.toContain('disabled');
    const middle = render(readyState(pattern, { selectedPick: 2 }));
    expect(buttonTag(middle, en('codeview.step.back'))).not.toContain('disabled');
    expect(buttonTag(middle, en('codeview.step.forward'))).not.toContain('disabled');

    // Activating a disabled control: no action at all, so no pick change and no announcement or error.
    for (const [control, selectedPick] of [
      ['step-back', 0],
      ['step-forward', 4],
    ] as const) {
      const state = readyState(pattern, { selectedPick, breakpoints: [1, 3] });
      const { outcome, after } = activate(state, control);
      expect(outcome).toEqual({ actions: [], jumpRejected: false, noFurtherBreakpoint: false });
      expect(after).toBe(state);
    }
  });

  it('R3.1 R3.2 step forward and step back move the Selected_Pick by one and leave the pattern and the Breakpoints alone', () => {
    const state = readyState(patternOf(5), { selectedPick: 2, breakpoints: [1, 3] });
    const forward = activate(state, 'step-forward');
    expect(forward.outcome.actions[0]).toEqual({ type: 'select-pick', pick: 3 });
    expect(forward.after.selectedPick).toBe(3);
    expect(forward.after.current).toBe(state.current);
    expect(forward.after.breakpoints).toEqual([1, 3]);

    const back = activate(state, 'step-back');
    expect(back.outcome.actions[0]).toEqual({ type: 'select-pick', pick: 1 });
    expect(back.after.selectedPick).toBe(1);
    expect(back.after.current).toBe(state.current);
    expect(back.after.breakpoints).toEqual([1, 3]);
  });

  it('R3.4 R3.5 the jump control is an input with a numeric keypad inside a form, so Enter applies it', () => {
    const html = render(readyState(patternOf(5)));
    expect(html).toMatch(/<form[^>]*>.*<label[^>]*>Go to pick number<\/label><input[^>]*inputMode="numeric"[^>]*\/><button type="submit"[^>]*>Go<\/button><\/form>/);
    // The label names the input, and no error shows before the first application.
    const labelFor = /<label for="([^"]+)"/.exec(html)?.[1];
    expect(html).toContain(`id="${labelFor}"`);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('aria-describedby');
  });

  it('R3.4 a jump to a pick from 0 to the last pick index sets the Selected_Pick and clears the error flag', () => {
    const state = readyState(patternOf(10), { selectedPick: 4, breakpoints: [2, 7] });
    for (const [text, pick] of [
      ['0', 0],
      ['9', 9],
      [' 6 ', 6],
    ] as const) {
      const { outcome, after } = activate(state, 'jump', text);
      expect(outcome.jumpRejected, text).toBe(false);
      expect(outcome.actions[0], text).toEqual({ type: 'select-pick', pick });
      expect(after.selectedPick, text).toBe(pick);
      expect(after.breakpoints, text).toEqual([2, 7]);
    }
  });

  it('R3.5 a blank, fractional or out-of-range jump changes nothing and asks for the message naming 0 and the last pick index', () => {
    const state = readyState(patternOf(10), { selectedPick: 4, breakpoints: [2, 7] });
    for (const text of ['', '   ', '2.5', '-1', '10', '99999999999999999999', 'abc', '1e1']) {
      const { outcome, after } = activate(state, 'jump', text);
      expect(outcome.jumpRejected, JSON.stringify(text)).toBe(true);
      expect(outcome.actions, JSON.stringify(text)).toEqual([]);
      expect(after, JSON.stringify(text)).toBe(state);
    }
    // The message the screen shows for it names 0 and the last pick index, in both languages.
    expect(en('codeview.jump.range', { first: 0, last: 9 })).toBe('Choose a pick number from 0 to 9.');
    expect(translator(DICTIONARIES, 'hi')('codeview.jump.range', { first: 0, last: 9 })).toMatch(/0.*9/);
    // A valid application after a rejected one reports no rejection, which is what removes the message.
    expect(activate(state, 'jump', '3').outcome.jumpRejected).toBe(false);
  });

  it('R3.6 the Line breakpoint control toggles a Breakpoint through the reducer, one for each pick index', () => {
    const state = readyState(patternOf(5), { breakpoints: [] });
    const set = appReducer(state, { type: 'toggle-breakpoint', pick: 3 });
    expect(set.breakpoints).toEqual([3]);
    expect(appReducer(set, { type: 'toggle-breakpoint', pick: 3 }).breakpoints).toEqual([]);
    // The control is a button on every Line of the listing, wired to that action by the listing.
    expect(lineItems(render(state)).every((item) => /<button[^>]*aria-pressed="false"/.test(item))).toBe(true);
  });

  it('R3.8 run to next breakpoint goes straight to the lowest Breakpoint above, in one select-pick', () => {
    const state = readyState(patternOf(20), { selectedPick: 2, breakpoints: [1, 9, 5, 14] });
    const { outcome, after } = activate(state, 'run-to-next-breakpoint');
    const selects = outcome.actions.filter((action) => action.type === 'select-pick');
    // One select-pick, to pick 5: pick 3 and pick 4 never become the Selected_Pick on the way.
    expect(selects).toEqual([{ type: 'select-pick', pick: 5 }]);
    expect(outcome.noFurtherBreakpoint).toBe(false);
    expect(after.selectedPick).toBe(5);
    expect(after.breakpoints).toEqual([1, 9, 5, 14]);
    expect(announcements(outcome.actions)).toEqual([
      { type: 'announce', kind: 'confirmation', messageKey: 'codeview.announce.pick', params: { pick: 5 } },
    ]);
  });

  it('R3.9 with no Breakpoint above it stops at the last pick index and announces that none was found', () => {
    for (const breakpoints of [[], [0, 2]]) {
      const state = readyState(patternOf(20), { selectedPick: 2, breakpoints });
      const { outcome, after } = activate(state, 'run-to-next-breakpoint');
      expect(outcome.noFurtherBreakpoint).toBe(true);
      expect(outcome.actions.filter((action) => action.type === 'select-pick')).toEqual([{ type: 'select-pick', pick: 19 }]);
      expect(after.selectedPick).toBe(19);
      expect(after.breakpoints).toEqual(breakpoints);
      expect(after.announcement?.messageKey).toBe('codeview.announce.noBreakpoint');
      expect(en(after.announcement!.messageKey, after.announcement!.params)).toBe(
        'No further breakpoint. Stopped at the last pick.',
      );
    }
    // Already on the last pick index, the message and the announcement still come.
    const atEnd = readyState(patternOf(20), { selectedPick: 19 });
    const stayed = activate(atEnd, 'run-to-next-breakpoint');
    expect(stayed.outcome.noFurtherBreakpoint).toBe(true);
    expect(stayed.after.selectedPick).toBe(19);
    expect(stayed.after.announcement?.messageKey).toBe('codeview.announce.noBreakpoint');
  });

  it('R11.6 the live region gets one announcement for each deliberate move, and none for a Window move or playback', () => {
    let state = readyState(patternOf(10_000), { selectedPick: 0, breakpoints: [30] });
    expect(state.announcement).toBeNull();
    const idOf = (current: AppState): number => current.announcement?.id ?? 0;

    const run = (control: PickControl, jumpText?: string): AppState => {
      const { outcome, after } = activate(state, control, jumpText);
      // At most one announcement in each handler, and the live region's counter rises by exactly that many.
      expect(announcements(outcome.actions).length).toBeLessThanOrEqual(1);
      expect(idOf(after) - idOf(state)).toBe(announcements(outcome.actions).length);
      return after;
    };

    state = run('step-forward');
    expect(state.announcement).toMatchObject({ messageKey: 'codeview.announce.pick', params: { pick: 1 } });
    expect(idOf(state)).toBe(1);
    state = run('step-back');
    expect(state.announcement).toMatchObject({ params: { pick: 0 } });
    expect(idOf(state)).toBe(2);
    state = run('jump', '5000');
    expect(state.announcement).toMatchObject({ params: { pick: 5000 } });
    expect(idOf(state)).toBe(3);
    state = run('jump', 'nonsense');
    expect(idOf(state)).toBe(3);
    state = run('step-back'); // pick 4999
    state = { ...state, selectedPick: 0 };
    state = run('run-to-next-breakpoint');
    expect(state.selectedPick).toBe(30);
    expect(state.announcement).toMatchObject({ params: { pick: 30 } });
    const settled = idOf(state);

    // Playback of the Weave_Screen moves the pick by `select-pick` alone, and the Window follows the pick: no announcement.
    for (const pick of [31, 32, 8_000, 9_999, 0]) {
      state = appReducer(state, { type: 'select-pick', pick });
    }
    expect(idOf(state)).toBe(settled);

    // Rendering a Window move dispatches nothing: the screen derives no announcement from `selectedPick`.
    const dispatched: AppAction[] = [];
    for (const selectedPick of [0, 40, 5_000, 9_999]) {
      renderToStaticMarkup(
        <CodeViewScreen
          state={{ ...state, selectedPick }}
          dispatch={(action) => {
            dispatched.push(action);
          }}
          t={en}
        />,
      );
    }
    expect(dispatched).toEqual([]);
  });

  it('R3.3 R7.1 the controls are present and disabled while the Current_Pattern is empty or the Card_Profile has not loaded', () => {
    const labels = [
      en('codeview.step.back'),
      en('codeview.step.forward'),
      en('codeview.run.next'),
      en('codeview.jump.button'),
    ];
    const empty = render(readyState([]));
    expect(empty).toContain(`aria-label="${en('codeview.controls.name')}"`);
    expect(empty).toContain(en('codeview.empty'));
    const notLoaded = render({ ...readyState(patternOf(5)), profile: { status: 'loading' } });
    for (const html of [empty, notLoaded]) {
      for (const label of labels) expect(buttonTag(html, label), label).toContain('disabled=""');
      expect(/<input[^>]*disabled=""/.test(html)).toBe(true);
    }
    // Nothing happens on an empty pattern whichever control is activated.
    for (const control of ['step-back', 'step-forward', 'jump', 'run-to-next-breakpoint'] as const) {
      expect(pickControlOutcome({ control, selectedPick: 0, pickCount: 0, breakpoints: [], jumpText: '0' }).actions).toEqual([]);
    }
  });

  it('R3.1 the controls are a named group and show the Selected_Pick as a numeral', () => {
    const html = render(readyState(patternOf(12), { selectedPick: 7 }));
    expect(html).toContain(`role="group" aria-label="${en('codeview.controls.name')}"`);
    expect(html).toContain(en('codeview.selected', { pick: 7 }));
    expect(en('codeview.selected', { pick: 7 })).toBe('Selected pick: 7');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The cloth beside the current card. Server rendering runs no effect, so the effect that calls `seek` on a real
// mount and the canvas itself are not exercised here. The pure decisions are: which branch the screen shows, and
// what the player does when it is handed the Selected_Pick, with a FakeScheduler and a fake paint.
// ---------------------------------------------------------------------------------------------------------------

const FAILURES: ReadonlyArray<SimFailure> = [
  { reason: 'invalid-profile', violations: [] },
  { reason: 'invalid-settings', setting: 'warpColour', message: 'not a colour' },
  { reason: 'pick-out-of-range', pick: 9, pickCount: 3 },
];

function clothHarness() {
  const profile = demoProfile();
  const pattern = patternOf(8);
  const built = buildReadyCloth(profile, pattern, initialAppState.clothChoices, 320, 192);
  if (!built.ok) throw new Error(`cloth failed: ${built.failure.reason}`);
  const scheduler = new FakeScheduler();
  const images: SimImage[] = [];
  const player = createStillPlayer({ ready: built.value, paint: (image) => images.push(image), scheduler });
  return { scheduler, images, player };
}

/** What the pick controls would show with the controls of the screen at `state`: every control not disabled. */
function expectControlsOperable(html: string): void {
  for (const label of [en('codeview.step.back'), en('codeview.step.forward'), en('codeview.run.next'), en('codeview.jump.button')]) {
    expect(buttonTag(html, label), label).not.toContain('disabled');
  }
  expect(/<input[^>]*disabled=""/.test(html)).toBe(false);
}

describe('Code view cloth', () => {
  it('R4.1 a cloth shows in one canvas with a text alternative naming the Selected_Pick, under its heading', () => {
    const html = render(readyState(patternOf(8), { selectedPick: 3 }));
    expect(html.match(/<canvas/g)).toHaveLength(1);
    expect(html).toMatch(/<canvas[^>]*role="img"[^>]*aria-label="Woven cloth at pick 3"/);
    expect(html).toContain(`>${en('codeview.cloth.heading')}</h3>`);
    expect(html).not.toContain('role="alert"');
  });

  it('R4.4 each Sim_Failure kind has its own message, from simFailureKey', () => {
    const messages = FAILURES.map((failure) => renderToStaticMarkup(<ClothFailure failure={failure} t={en} />));
    expect(messages[0]).toContain(EN['error.sim.invalid-profile'] as string);
    expect(messages[1]).toContain(EN['error.sim.invalid-settings'] as string);
    expect(messages[2]).toContain(EN['error.sim.pick-out-of-range'] as string);
    expect(new Set(messages).size).toBe(3);
    for (const message of messages) expect(message).toContain('role="alert"');
  });

  it('R4.4 an invalid cloth choice shows its message, paints no cloth, and leaves the Lines and every control operable', () => {
    const state = readyState(patternOf(6), {
      selectedPick: 2,
      clothChoices: { ...initialAppState.clothChoices, warpColour: 'not-a-colour' },
    });
    const html = render(state);
    expect(html).toContain(EN['error.sim.invalid-settings'] as string);
    expect(html).not.toContain('<canvas');
    expect(lineItems(html).map(pickOf)).toEqual([0, 1, 2, 3, 4, 5]);
    expectControlsOperable(html);
    expect(html).toContain(en('codeview.selected', { pick: 2 }));
  });

  it('R4.4 an invalid Card_Profile shows its message, paints no cloth, and leaves the Lines and every control operable', () => {
    // holeDiameterMm below zero fails the simulator's profile check but still gives the Lines their Bit_Lines.
    const profile = { ...demoProfile(), holeDiameterMm: -1 };
    const html = render(readyState(patternOf(6), { selectedPick: 2, profile: { status: 'ready', profile } }));
    expect(html).toContain(EN['error.sim.invalid-profile'] as string);
    expect(html).not.toContain('<canvas');
    expect(lineItems(html).map(pickOf)).toEqual([0, 1, 2, 3, 4, 5]);
    expectControlsOperable(html);
  });

  it('R4.4 pick-out-of-range cannot come from the screen: the player clamps any pick it is handed to the cloth', () => {
    // buildReadyCloth cannot return pick-out-of-range: the player clamps every pick it is handed to the cloth.
    const { images, player } = clothHarness();
    showSelectedPick(player, 9_999);
    expect(images).toHaveLength(1);
    expect(player.current().phase).toBe('rest');
  });

  it('R4.5 a Current_Pattern with no picks shows the empty-design message and no cloth', () => {
    const html = render(readyState([]));
    expect(html).toContain(en('codeview.empty'));
    expect(html).not.toContain('<canvas');
    expect(html).not.toContain(en('codeview.cloth.heading'));
    expect(html).not.toContain('role="alert"');
  });

  it('R4.3 every change of the Selected_Pick paints that pick once as a rest frame and starts no playback', () => {
    const { scheduler, images, player } = clothHarness();
    expect('play' in player).toBe(false);
    const picks = [0, 3, 7, 3, 0];
    for (const [index, pick] of picks.entries()) {
      showSelectedPick(player, pick);
      expect(images, `after pick ${pick}`).toHaveLength(index + 1);
      expect(player.current()).toEqual({ pick, phase: 'rest' });
    }
    // A play would ask the scheduler for a tick; none was ever asked for.
    expect(scheduler.requests()).toBe(0);
    expect(scheduler.pending()).toBe(0);
    expect(scheduler.run(1_000)).toBe(false);
    expect(images).toHaveLength(picks.length);
  });

  it('R4.3 no cloth means nothing to seek, and the seek of one pick twice is not a playback either', () => {
    expect(() => showSelectedPick(null, 4)).not.toThrow();
    const { scheduler, images, player } = clothHarness();
    showSelectedPick(player, 2);
    showSelectedPick(player, 2);
    expect(images).toHaveLength(2);
    expect(images[1]?.data).toEqual(images[0]?.data);
    expect(scheduler.requests()).toBe(0);
  });

  it('R4.3 the cloth reports no frame back as a select-pick: rendering with a scheduler dispatches nothing', () => {
    const dispatched: AppAction[] = [];
    for (const selectedPick of [0, 4, 7]) {
      renderToStaticMarkup(
        <CodeViewScreen
          state={readyState(patternOf(8), { selectedPick })}
          dispatch={(action) => {
            dispatched.push(action);
          }}
          t={en}
          scheduler={new FakeScheduler()}
        />,
      );
    }
    expect(dispatched).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The diff panel. The test environment is Node with server rendering only: no effect runs and no click can be made,
// so the mount-time `listDesigns`, the selects' change events and the compare button's click are not exercised.
// What they call is: `loadSummaries`, `compareDesigns`, `markerLine` and the markup of `DiffPanelView` for a given
// state, with a fake `ArchiveStore` behind the Archive calls.
// ---------------------------------------------------------------------------------------------------------------

/** A fake store that counts `get` calls, so a test can see how many Saved_Designs one comparison fetched. */
class CountingStore extends FakeArchiveStore {
  gets = 0;
  override async get(id: string): Promise<SavedDesign | undefined> {
    this.gets += 1;
    return super.get(id);
  }
}

function archiveWith(store: FakeArchiveStore): ArchiveDeps {
  let counter = 0;
  let clock = 1000;
  return { store, now: () => clock++, newId: () => `id-${counter++}` };
}

async function saveNamed(deps: ArchiveDeps, profile: CardProfile, pattern: Pattern, name: string): Promise<string> {
  const saved = await saveDesign({ pattern, profileName: profile.name, metadata: { ...EMPTY_METADATA, name } }, deps);
  if (!saved.ok) throw new Error('save failed');
  return saved.value;
}

/** A Bit_Line as long as the profile's ends, with a `1` at each of `ends`. */
function bitsAt(profile: CardProfile, ends: ReadonlyArray<number>): string {
  return Array.from({ length: endsPerPick(profile) }, (_, end) => (ends.includes(end) ? '1' : '0')).join('');
}

/** A Line_Set of the profile with one card for each list of punched ends. */
function lineSetOf(profile: CardProfile, cards: ReadonlyArray<ReadonlyArray<number>>): LineSet {
  const lines: Line[] = cards.map((ends, pick) => ({ kind: 'bits', pick, bits: bitsAt(profile, ends) }));
  return {
    profileName: profile.name,
    hookRows: profile.hookRows,
    hookColumns: profile.hookColumns,
    endsPerPick: endsPerPick(profile),
    lines,
  };
}

/**
 * Two designs whose Diff holds an entry of each of the four kinds: pick 1 changes at ends 2 and 5, a card is added
 * as the second design's pick 3, and the first design's last card (pick 4) is removed.
 */
function fourKinds(profile: CardProfile): { first: LineSet; second: LineSet; diff: Diff } {
  const first = lineSetOf(profile, [[0], [1, 2], [3], [4], [7]]);
  const second = lineSetOf(profile, [[0], [1, 5], [3], [6], [4]]);
  return { first, second, diff: diffPatterns(first, second) };
}

function summaryOf(id: string, name: string, pickCount = 7): DesignSummary {
  return { id, profileName: demoProfile().name, metadata: { ...EMPTY_METADATA, name }, createdAt: 1, pickCount };
}

function panelHtml(overrides: Partial<DiffPanelViewProps> = {}, translate = en): string {
  const props: DiffPanelViewProps = {
    summaries: { status: 'ready', list: [summaryOf('a', 'Kota'), summaryOf('b', 'Banarasi')] },
    first: null,
    second: null,
    comparison: { status: 'idle' },
    currentAvailable: true,
    t: translate,
    onFirstChange: () => undefined,
    onSecondChange: () => undefined,
    onCompare: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(<DiffPanelView {...props} />);
}

function readyComparison(profile: CardProfile): Comparison {
  const { first, second, diff } = fourKinds(profile);
  return { status: 'ready', first: { name: 'First', lineSet: first }, second: { name: 'Second', lineSet: second }, diff };
}

/** The markup of each Diff_Entry, from its opening tag on. */
function entryItems(html: string): string[] {
  return html.split('<li ').slice(1).filter((item) => item.includes('data-kind='));
}

function kindOf(item: string): string | undefined {
  return /data-kind="([a-z]+)"/.exec(item)?.[1];
}

function markerRowOf(item: string): string | undefined {
  return /data-marker-line="true">([^<]*)</.exec(item)?.[1];
}

describe('Code view diff panel', () => {
  it('R6.7 the ^ row has a column for each character of the grouped Bit_Line, Group_Separators included', () => {
    const profile = demoProfile();
    const total = endsPerPick(profile);
    const bits = bitsAt(profile, [0, 3]);
    const holes = [0, 1, profile.hookColumns - 1, profile.hookColumns, total - 1];
    // Group sizes that divide the Bit_Line, that are one, and that leave a short last group.
    const sizes = [profile.hookColumns, 1, Math.max(1, Math.floor(profile.hookColumns / 2)), profile.hookColumns + 1];
    for (const hookColumns of sizes) {
      const grouped = groupBits(bits, hookColumns);
      // The expected row comes from the grouped text itself: walk it, counting the bit characters past each separator.
      let end = 0;
      const expected = [...grouped].map((character) => (character === GROUP_SEPARATOR ? ' ' : holes.includes(end++) ? CHANGED_MARK : ' ')).join('');
      const row = markerLine(bits, holes, hookColumns);
      expect(row, `hookColumns ${hookColumns}`).toBe(expected);
      expect(row).toHaveLength(grouped.length);
      for (const hole of holes) {
        const column = endTextIndex(hole, hookColumns);
        expect(column).toBe(hole + Math.floor(hole / hookColumns));
        expect(row[column]).toBe(CHANGED_MARK);
        expect(grouped[column]).toMatch(/^[01]$/);
      }
      // A Group_Separator column never holds a ^.
      for (const [column, character] of [...grouped].entries()) {
        if (character === GROUP_SEPARATOR) expect(row[column]).toBe(' ');
      }
    }
    // An end that is no position of the Bit_Line is ignored, and an empty Bit_Line has an empty row.
    expect(markerLine(bits, [-1, total, 1.5, Number.NaN], profile.hookColumns).trim()).toBe('');
    expect(markerLine('', [0], profile.hookColumns)).toBe('');
  });

  it('R6.7 R11.5 R11.7 each kind shows its marker, its kind word, its picks and its Bit_Line, and only changed has a ^ row', () => {
    const profile = demoProfile();
    const { first, second, diff } = fourKinds(profile);
    if (!diff.ok) throw new Error('the two designs must compare');
    const html = panelHtml({ comparison: readyComparison(profile), first: { kind: 'current' }, second: { kind: 'current' } });
    const items = entryItems(html);
    expect(items.map(kindOf)).toEqual(['unchanged', 'changed', 'unchanged', 'added', 'unchanged', 'removed']);
    expect(new Set(items.map(kindOf))).toEqual(new Set(['unchanged', 'changed', 'added', 'removed']));

    const bitsOfPick = (lineSet: LineSet, pick: number): string => {
      const line = lineSet.lines[pick];
      if (line === undefined || line.kind !== 'bits') throw new Error('a bits Line is expected');
      return line.bits;
    };
    const grouped = (lineSet: LineSet, pick: number): string => groupBits(bitsOfPick(lineSet, pick), profile.hookColumns);
    const expectations = [
      { kind: 'unchanged', picks: '0/0', text: grouped(first, 0) },
      { kind: 'changed', picks: '1/1', text: grouped(second, 1) },
      { kind: 'unchanged', picks: '2/2', text: grouped(first, 2) },
      { kind: 'added', picks: '-/3', text: grouped(second, 3) },
      { kind: 'unchanged', picks: '3/4', text: grouped(first, 3) },
      { kind: 'removed', picks: '4/-', text: grouped(first, 4) },
    ] as const;
    for (const [index, item] of items.entries()) {
      const want = expectations[index]!;
      const entry = diff.entries[index]!;
      const [marker, picks, caretRow] = hiddenSpans(item);
      // The marker character is the module's, the kind is also written as a word, and the pick numbers are numerals.
      expect(marker).toBe(DIFF_MARKERS[want.kind]);
      expect(item).toContain(`>${en(`codeview.diff.kind.${want.kind}`)}</span>`);
      expect(picks).toBe(want.picks);
      expect(item).toContain(`aria-label="${diffEntryAccessibleName(en, entry)}"`);
      expect(item).toContain(`>${want.text}</span>`);
      // The Bit_Line of an entry is a named group and not a tab stop: the one entries region is (R11.1).
      expect(item).toMatch(/role="group"[^>]*aria-label="Pick \d+ bits"/);
      expect(item).not.toContain('tabindex');
      // The ^ row exists for a changed entry only, is hidden from assistive technology, and sits in the same region.
      if (want.kind === 'changed') {
        expect(markerRowOf(item)).toBe(markerLine(bitsOfPick(second, 1), [2, 5], profile.hookColumns));
        expect(caretRow).toBe(markerRowOf(item));
        expect(/<div[^>]*role="group"[^>]*>(.*?)<\/div>/.exec(item)?.[1]).toMatch(/<span[^>]*>[01|]+<\/span><span[^>]*aria-hidden="true"[^>]*>[ ^]+<\/span>/);
        expect(markerRowOf(item)!.split(CHANGED_MARK)).toHaveLength(3);
      } else {
        expect(markerRowOf(item)).toBeUndefined();
        expect(item).not.toContain(CHANGED_MARK);
      }
    }
    expect(diffEntryAccessibleName(en, diff.entries[1]!)).toBe('Changed: pick 1 and pick 1, ends 2, 5');
    expect(diffEntryAccessibleName(en, diff.entries[3]!)).toBe('Added: pick 3');
    expect(diffEntryAccessibleName(en, diff.entries[5]!)).toBe('Removed: pick 4');
  });

  it('R6.7 the kind word comes from the Translation_File in each language, and the marker and Bit_Line text are the same in both', () => {
    const profile = demoProfile();
    const hi = translator(DICTIONARIES, 'hi');
    const markup = (translate: typeof en): string => panelHtml({ comparison: readyComparison(profile), t: translate });
    const english = entryItems(markup(en));
    const hindi = entryItems(markup(hi));
    expect(hindi).toHaveLength(english.length);
    for (const [index, item] of hindi.entries()) {
      const kind = kindOf(item)!;
      expect(item).toContain(`>${hi(`codeview.diff.kind.${kind}`)}</span>`);
      expect(hi(`codeview.diff.kind.${kind}`)).not.toBe(en(`codeview.diff.kind.${kind}`));
      expect(hiddenSpans(item)[0]).toBe(hiddenSpans(english[index]!)[0]);
      expect(markerRowOf(item)).toBe(markerRowOf(english[index]!));
    }
  });

  it('R6.3 the three Diff_Counts are shown as numerals through the count keys', () => {
    const html = panelHtml({ comparison: readyComparison(demoProfile()) });
    expect(html).toContain('Changed holes: 2');
    expect(html).toContain('Added cards: 1');
    expect(html).toContain('Removed cards: 1');
    const hi = translator(DICTIONARIES, 'hi');
    const hindi = panelHtml({ comparison: readyComparison(demoProfile()), t: hi });
    expect(hindi).toContain(hi('codeview.diff.counts.changedHoles', { count: 2 }));
    expect(hindi).toContain(hi('codeview.diff.counts.addedCards', { count: 1 }));
    expect(hindi).toContain(hi('codeview.diff.counts.removedCards', { count: 1 }));
    // The entries sit in one labelled region a keyboard can reach.
    expect(html).toMatch(new RegExp(`<div[^>]*role="region"[^>]*tabindex="0"[^>]*aria-label="${en('codeview.diff.entries.name')}"`));
  });

  it('R6.16 an empty Archive disables both choosers and the compare control and shows the no-saved-design message', () => {
    const empty = panelHtml({ summaries: { status: 'ready', list: [] } });
    expect(empty).toContain(en('codeview.diff.noSaved'));
    expect(empty.match(/<select[^>]*disabled=""/g)).toHaveLength(2);
    expect(buttonTag(empty, en('codeview.diff.compare'))).toContain('disabled=""');
    // Each chooser keeps its visible label.
    expect(empty).toMatch(/<label for="[^"]+"[^>]*>Earlier design<\/label>/);
    expect(empty).toMatch(/<label for="[^"]+"[^>]*>Later design<\/label>/);
    // While the list is still loading nothing can be chosen either, and the loading text shows instead.
    const loading = panelHtml({ summaries: { status: 'loading' } });
    expect(loading).toContain(en('codeview.diff.loading'));
    expect(loading).not.toContain(en('codeview.diff.noSaved'));
    expect(loading.match(/<select[^>]*disabled=""/g)).toHaveLength(2);
    // A failed listing shows its message from archiveFailureKey and disables the choosers too.
    const failed: Summaries = { status: 'failed', failure: { reason: 'storage-unavailable', detail: 'x' } };
    const unreachable = panelHtml({ summaries: failed });
    expect(unreachable).toContain(en('error.archive.storage-unavailable'));
    expect(unreachable.match(/<select[^>]*disabled=""/g)).toHaveLength(2);
  });

  it('R6.6 the choosers offer the Current_Pattern and every Saved_Design, and compare waits for both choices', () => {
    const html = panelHtml();
    expect(html).not.toMatch(/<select[^>]*disabled/);
    expect(html).not.toContain(en('codeview.diff.noSaved'));
    for (const text of [en('codeview.diff.current'), 'Kota (7 picks)', 'Banarasi (7 picks)', en('codeview.diff.choose')]) {
      expect(html.split(`>${text}</option>`).length - 1, text).toBe(2);
    }
    expect(buttonTag(html, en('codeview.diff.compare'))).toContain('disabled=""');
    const chosen = panelHtml({ first: { kind: 'saved', id: 'a' }, second: { kind: 'current' } });
    expect(buttonTag(chosen, en('codeview.diff.compare'))).not.toContain('disabled');
    expect(chosen).toContain('<option value="saved:a" selected="">Kota (7 picks)</option>');
    expect(chosen).toContain('<option value="current" selected="">');
    // While a comparison runs the control is disabled and says so.
    const running = panelHtml({ first: { kind: 'current' }, second: { kind: 'current' }, comparison: { status: 'loading' } });
    expect(buttonTag(running, en('codeview.diff.comparing'))).toContain('disabled=""');
    // Without a Line_Set for the Current_Pattern it is no option, and nothing can be chosen.
    const noCurrent = panelHtml({ currentAvailable: false });
    expect(noCurrent).not.toContain(en('codeview.diff.current'));
    expect(noCurrent.match(/<select[^>]*disabled=""/g)).toHaveLength(2);
  });

  it('R6.6 the design chosen first is the first Line_Set, so added means present only in the second', async () => {
    const profile = demoProfile();
    const store = new CountingStore();
    const deps = archiveWith(store);
    const full = generateSample(profile, 'diamond');
    const shorter = full.slice(0, full.length - 1);
    const id = await saveNamed(deps, profile, full, 'Kota');
    const current = patternToLines(profile, shorter);
    if (!current.ok) throw new Error('the pattern must give Lines');
    const named = { name: 'The design open now', lineSet: current.lineSet };
    const base = { profile, untitled: 'untitled', current: named };

    // Current_Pattern first, Saved_Design second: the extra card is only in the second, so it is added.
    const forward = await compareDesigns({ ...base, first: { kind: 'current' }, second: { kind: 'saved', id } }, deps);
    if (forward.status !== 'ready' || !forward.diff.ok) throw new Error('the comparison must succeed');
    expect(forward.diff.counts).toEqual({ changedHoles: 0, addedCards: 1, removedCards: 0 });
    expect(forward.first.name).toBe('The design open now');
    expect(forward.second.name).toBe('Kota');
    expect(store.gets).toBe(1);

    // The other way round, the same card is only in the first, so it is removed.
    const backward = await compareDesigns({ ...base, first: { kind: 'saved', id }, second: { kind: 'current' } }, deps);
    if (backward.status !== 'ready' || !backward.diff.ok) throw new Error('the comparison must succeed');
    expect(backward.diff.counts).toEqual({ changedHoles: 0, addedCards: 0, removedCards: 1 });
    expect(store.gets).toBe(2);
  });

  it('R6.6 two Saved_Designs are each fetched once, and the same design on both sides gives an all-unchanged Diff', async () => {
    const profile = demoProfile();
    const store = new CountingStore();
    const deps = archiveWith(store);
    const diamond = generateSample(profile, 'diamond');
    const idA = await saveNamed(deps, profile, diamond, 'Kota');
    const idB = await saveNamed(deps, profile, diamond.slice(1), '');
    const base = { profile, untitled: 'untitled', current: null };

    const two = await compareDesigns({ ...base, first: { kind: 'saved', id: idA }, second: { kind: 'saved', id: idB } }, deps);
    if (two.status !== 'ready' || !two.diff.ok) throw new Error('the comparison must succeed');
    expect(store.gets).toBe(2);
    expect([two.first.name, two.second.name]).toEqual(['Kota', 'untitled']);
    expect(two.diff.counts.removedCards).toBe(1);
    expect(two.diff.counts.addedCards).toBe(0);

    store.gets = 0;
    const same = await compareDesigns({ ...base, first: { kind: 'saved', id: idA }, second: { kind: 'saved', id: idA } }, deps);
    if (same.status !== 'ready' || !same.diff.ok) throw new Error('the comparison must succeed');
    expect(store.gets).toBe(1);
    expect(same.diff.counts).toEqual({ changedHoles: 0, addedCards: 0, removedCards: 0 });
    expect(same.diff.entries.every((entry) => entry.kind === 'unchanged')).toBe(true);
    expect(same.diff.entries).toHaveLength(diamond.length);
    // The panel shows every one of them, each as an unchanged entry.
    const html = panelHtml({ comparison: same });
    expect(entryItems(html)).toHaveLength(diamond.length);
    expect(entryItems(html).every((item) => kindOf(item) === 'unchanged')).toBe(true);
  });

  it('R6.6 the Archive is listed into a ready value, and a failing Archive is a value in the comparison, not a throw', async () => {
    const profile = demoProfile();
    const store = new CountingStore();
    const deps = archiveWith(store);
    const id = await saveNamed(deps, profile, generateSample(profile, 'diamond'), 'Kota');
    const listed = await loadSummaries(deps);
    expect(listed).toMatchObject({ status: 'ready', list: [{ id, pickCount: generateSample(profile, 'diamond').length }] });

    const base = { profile, untitled: 'untitled', current: null, first: { kind: 'saved', id } as const, second: { kind: 'saved', id } as const };
    const missing = await compareDesigns({ ...base, first: { kind: 'saved', id: 'gone' } }, deps);
    expect(missing).toEqual({ status: 'blocked', blocked: { kind: 'archive', failure: { reason: 'not-found', id: 'gone' } } });
    expect(entryItems(panelHtml({ comparison: missing }))).toEqual([]);
    expect(panelHtml({ comparison: missing })).toContain(en('error.archive.not-found'));

    store.failOn('get');
    const failedGet = await compareDesigns(base, deps);
    expect(failedGet).toMatchObject({ status: 'blocked', blocked: { kind: 'archive', failure: { reason: 'storage-unavailable' } } });
    store.clearFailures();
    store.failOn('list');
    expect(await loadSummaries(deps)).toMatchObject({ status: 'failed', failure: { reason: 'storage-unavailable' } });
    store.clearFailures();

    // Choosing the Current_Pattern when it has no Line_Set gives nothing to show, and no Archive call.
    store.gets = 0;
    expect(await compareDesigns({ ...base, first: { kind: 'current' } }, deps)).toEqual({ status: 'idle' });
  });

  it('R6.6 R6.16 the screen shows the panel below the listing with its choosers, loading until the Archive answers', () => {
    const store = new FakeArchiveStore();
    const html = renderToStaticMarkup(
      <CodeViewScreen state={readyState(patternOf(6))} dispatch={() => undefined} t={en} archiveDeps={archiveWith(store)} />,
    );
    expect(html).toContain(`>${en('codeview.diff.heading')}</h3>`);
    expect(html).toContain(en('codeview.diff.loading'));
    expect(html.indexOf(en('codeview.diff.heading'))).toBeGreaterThan(html.indexOf(CODE_VIEW_MARKER));
    expect(html.indexOf(en('codeview.diff.heading'))).toBeGreaterThan(html.indexOf(en('codeview.cloth.heading')));
    // The panel comes after every Line, so the Tab order reaches it last.
    expect(html.indexOf(en('codeview.diff.heading'))).toBeGreaterThan(html.lastIndexOf('data-pick='));
    // Without a ready Card_Profile the Current_Pattern has no Line_Set, so nothing can be chosen.
    const loading = renderToStaticMarkup(
      <CodeViewScreen state={{ ...readyState(patternOf(6)), profile: { status: 'loading' } }} dispatch={() => undefined} t={en} />,
    );
    expect(loading.match(/<select[^>]*disabled=""/g)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// The Diff_Text: copy and download (R6.8, R10.7). The click handlers, the real clipboard and the real Blob and anchor
// cannot run under server rendering in Node; the helpers they call are tested here with fakes.
// ---------------------------------------------------------------------------------------------------------------

/** Clipboard and download fakes that record what they were handed. */
class FakeDiffTextDeps implements DiffTextDeps {
  readonly copied: string[] = [];
  readonly download = new FakeDownloadDeps();
  private readonly copyResult: 'works' | 'refuses' | 'rejects';
  constructor(copyResult: 'works' | 'refuses' | 'rejects' = 'works') {
    this.copyResult = copyResult;
  }

  copyText = async (text: string): Promise<boolean> => {
    this.copied.push(text);
    if (this.copyResult === 'rejects') throw new Error('the clipboard is blocked');
    return this.copyResult === 'works';
  };
}

/** The text of the first `<textarea>` in `html`, with the HTML escapes the server renderer writes undone. */
function textareaValue(html: string): string | undefined {
  const raw = /<textarea[^>]*>([^<]*)<\/textarea>/.exec(html)?.[1];
  return raw === undefined
    ? undefined
    : raw.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
}

/** A Diff that is refused: the two Line_Sets belong to different Card_Profiles. */
function refusedDiff(profile: CardProfile): Diff {
  const { first, second } = fourKinds(profile);
  const diff = diffPatterns(first, { ...second, profileName: `${second.profileName} (other)` });
  if (diff.ok) throw new Error('the two designs must be refused');
  return diff;
}

describe('Code view Diff_Text', () => {
  it('R6.8 the text shown, the text copied and the bytes downloaded are the Diff_Text, character for character', async () => {
    const profile = demoProfile();
    const comparison = readyComparison(profile);
    if (comparison.status !== 'ready' || !comparison.diff.ok) throw new Error('the two designs must compare');
    const text = diffToText(comparison.diff);
    // Several kinds of entry, and Bit_Lines with a Group_Separator in them.
    for (const marker of [DIFF_MARKERS.changed, DIFF_MARKERS.added, DIFF_MARKERS.removed]) expect(text).toContain(marker);
    expect(text).toContain(GROUP_SEPARATOR);

    const html = panelHtml({ comparison });
    expect(textareaValue(html)).toBe(text);

    const deps = new FakeDiffTextDeps();
    expect(await copyDiffText(deps, text)).toEqual({ ok: true });
    expect(downloadDiffText(deps, text)).toEqual({ ok: true });
    expect(deps.copied).toEqual([text]);
    const downloaded = deps.download.downloads[0]!;
    // Decoded as UTF-8 without dropping a byte-order mark, the bytes are the shown text and nothing else.
    expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(downloaded.bytes)).toBe(text);
    expect(downloaded.bytes).toEqual(diffTextBytes(text));
    expect(textareaValue(html)).toBe(deps.copied[0]);
    expect(deps.copied[0]).toBe(new TextDecoder('utf-8', { ignoreBOM: true }).decode(downloaded.bytes));
  });

  it('R6.8 the download is one file with the fixed name and the UTF-8 text type, and its URL is revoked after the click', () => {
    const deps = new FakeDiffTextDeps();
    expect(downloadDiffText(deps, 'x')).toEqual({ ok: true });
    expect(deps.download.downloadCount).toBe(1);
    expect(deps.download.downloads[0]).toMatchObject({ fileName: 'naksha-diff.txt', type: 'text/plain;charset=utf-8' });
    expect(DIFF_TEXT_FILE_NAME).toBe('naksha-diff.txt');
    expect(DIFF_TEXT_MIME_TYPE).toBe('text/plain;charset=utf-8');
    expect(DIFF_TEXT_FILE_NAME).toMatch(/^[\x20-\x7e]+$/);
    expect(deps.download.revoked).toEqual(['blob:fake/1']);
  });

  it('R6.8 no byte is added or changed: no byte-order mark, no added trailing newline, line endings and non-ASCII kept', () => {
    for (const text of ['', 'one', 'one\n', 'a\r\nb\n\n', ' \t', 'é ✓ नक्शा']) {
      const deps = new FakeDiffTextDeps();
      expect(downloadDiffText(deps, text)).toEqual({ ok: true });
      const bytes = deps.download.downloads[0]!.bytes;
      expect(bytes).toEqual(new TextEncoder().encode(text));
      expect(bytes.length).toBe(new TextEncoder().encode(text).length);
      if (bytes.length >= 3) expect([...bytes.slice(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
      expect(new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)).toBe(text);
    }
  });

  it('R6.8 a clipboard that refuses, rejects or is missing gives a failure value and does not throw', async () => {
    expect(await copyDiffText(new FakeDiffTextDeps('refuses'), 'x')).toEqual({ ok: false });
    expect(await copyDiffText(new FakeDiffTextDeps('rejects'), 'x')).toEqual({ ok: false });
    // A copy that throws before it returns a promise is a failure value too.
    const throwing: DiffTextDeps = {
      copyText: () => {
        throw new Error('no clipboard');
      },
      download: new FakeDownloadDeps(),
    };
    expect(await copyDiffText(throwing, 'x')).toEqual({ ok: false });
    // A download that cannot be made is a failure value, and nothing was clicked.
    const download = new FakeDownloadDeps();
    download.createObjectURL = () => {
      throw new Error('no object URLs');
    };
    expect(downloadDiffText({ copyText: async () => true, download }, 'x')).toEqual({ ok: false });
    expect(download.downloadCount).toBe(0);
    // Each result has a message to show, and Copy failing still leaves the text to select.
    expect(diffTextStatusKey('copyFailed')).toBe('codeview.diff.copyFailed');
    expect(diffTextStatusKey('copied')).toBe('codeview.diff.copied');
    expect(diffTextStatusKey('downloaded')).toBe('codeview.diff.downloaded');
    expect(diffTextStatusKey('none')).toBeNull();
    expect(en(diffTextStatusKey('downloadFailed')!)).toBe(en('error.generic'));
  });

  it('R6.8 R11.1 the block is a labelled section with a read-only selectable text, two real buttons and a status region', () => {
    const html = panelHtml({ comparison: readyComparison(demoProfile()) });
    expect(html).toMatch(new RegExp(`<h4[^>]*>${en('codeview.diff.text.heading')}</h4>`));
    expect(html).toMatch(new RegExp(`<textarea[^>]*readOnly=""[^>]*aria-label="${en('codeview.diff.text.name')}"`, 'i'));
    expect(html).toMatch(/<textarea[^>]*wrap="off"/);
    expect(buttonTag(html, en('codeview.diff.copy'))).toContain('type="button"');
    expect(buttonTag(html, en('codeview.diff.copy'))).not.toContain('disabled');
    expect(buttonTag(html, en('codeview.diff.download'))).toContain('type="button"');
    expect(buttonTag(html, en('codeview.diff.download'))).not.toContain('disabled');
    // The status region exists before any result, so the result is announced when it appears, and it is empty then.
    expect(html).toMatch(/<p[^>]*role="status"[^>]*><\/p>/);
    expect(html).not.toContain(en('codeview.diff.copied'));
    expect(html).not.toContain(en('codeview.diff.copyFailed'));
    expect(html).not.toContain(en('codeview.diff.downloaded'));
    // The text and the section are named: the section by its heading, so the Tab order is text, Copy, Download.
    expect(html.indexOf('<textarea')).toBeLessThan(html.indexOf(en('codeview.diff.copy')));
    expect(html.indexOf(en('codeview.diff.copy'))).toBeLessThan(html.indexOf(en('codeview.diff.download')));
  });

  it('R10.7 the labels come from the Translation_File in each language and the Diff_Text is the same in both', () => {
    const hi = translator(DICTIONARIES, 'hi');
    const comparison = readyComparison(demoProfile());
    const english = panelHtml({ comparison });
    const hindi = panelHtml({ comparison, t: hi });
    for (const key of ['codeview.diff.text.heading', 'codeview.diff.copy', 'codeview.diff.download']) {
      expect(hindi, key).toContain(hi(key));
      expect(hi(key), key).not.toBe(en(key));
    }
    expect(hindi).toContain(`aria-label="${hi('codeview.diff.text.name')}"`);
    expect(textareaValue(hindi)).toBeDefined();
    expect(textareaValue(hindi)).toBe(textareaValue(english));
  });

  it('R6.13 no Diff_Text block is offered for a refused Diff, for an idle, loading or blocked comparison', () => {
    const profile = demoProfile();
    const comparisons: Comparison[] = [
      { status: 'idle' },
      { status: 'loading' },
      { status: 'blocked', blocked: { kind: 'damaged', designName: 'Kota', pick: 2 } },
      { status: 'blocked', blocked: { kind: 'archive', failure: { reason: 'not-found', id: 'gone' } } },
      { status: 'ready', first: { name: 'First', lineSet: fourKinds(profile).first }, second: { name: 'Second', lineSet: fourKinds(profile).second }, diff: refusedDiff(profile) },
    ];
    for (const comparison of comparisons) {
      const html = panelHtml({ comparison });
      expect(html, comparison.status).not.toContain('<textarea');
      expect(html, comparison.status).not.toContain('data-diff-text');
      expect(html, comparison.status).not.toContain(en('codeview.diff.text.heading'));
      expect(html, comparison.status).not.toContain(en('codeview.diff.copy'));
      expect(html, comparison.status).not.toContain(en('codeview.diff.download'));
    }
    // The same panel with a Diff that is not refused does offer it.
    expect(panelHtml({ comparison: readyComparison(profile) })).toContain('data-diff-text="true"');
  });

  it('R6.8 an all-unchanged Diff still offers its Diff_Text, and the screen passes the injected deps to the panel', () => {
    const profile = demoProfile();
    const lineSet = fourKinds(profile).first;
    const diff = diffPatterns(lineSet, lineSet);
    if (!diff.ok) throw new Error('the same design must compare');
    const comparison: Comparison = { status: 'ready', first: { name: 'A', lineSet }, second: { name: 'A', lineSet }, diff };
    expect(textareaValue(panelHtml({ comparison }))).toBe(diffToText(diff));
    // A CodeViewScreen accepts the deps; before any comparison it has no block, so only the render is checked here.
    const html = renderToStaticMarkup(
      <CodeViewScreen state={readyState(patternOf(4))} dispatch={() => undefined} t={en} diffTextDeps={new FakeDiffTextDeps()} />,
    );
    expect(html).not.toContain('<textarea');
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Refusals, empty, missing and failing inputs (R6.12, R6.13, R7.1 to R7.8). Server rendering in Node runs no effect
// and no click, so these are checked through `compareDesigns` / `runComparison` (what the compare control calls),
// the pure helpers the panel's state goes through, and the markup of `DiffPanelView` and `CodeViewScreen` for a
// given state. The mount-time `listDesigns`, and the setState calls that put a result on a mounted panel, are not
// exercised. Each Archive call below goes to a fake `ArchiveStore`.
// ---------------------------------------------------------------------------------------------------------------

/** A fake store that counts `listSummaries` calls, so a test can see that the list was fetched again. */
class ListCountingStore extends FakeArchiveStore {
  lists = 0;
  override async listSummaries(): Promise<DesignSummary[]> {
    this.lists += 1;
    return super.listSummaries();
  }
}

/** The Current_Pattern's side of a comparison, built the way the screen builds it. */
function currentSide(profile: CardProfile, pattern: Pattern): { name: string; lineSet: LineSet } {
  const lines = patternToLines(profile, pattern);
  if (!lines.ok) throw new Error('the pattern must give Lines');
  return { name: 'The design open now', lineSet: lines.lineSet };
}

/** The comparison input for the Current_Pattern against one Saved_Design. */
function againstSaved(profile: CardProfile, pattern: Pattern, id: string) {
  return {
    profile,
    untitled: 'untitled',
    current: currentSide(profile, pattern),
    first: { kind: 'current' } as const,
    second: { kind: 'saved', id } as const,
  };
}

async function listedFrom(deps: ArchiveDeps): Promise<Summaries> {
  const listed = await loadSummaries(deps);
  if (listed.status !== 'ready') throw new Error('the Archive must list');
  return listed;
}

function disabledSelects(html: string): number {
  return (html.match(/<select[^>]*disabled=""/g) ?? []).length;
}

/** No entries, no counts and no Diff_Text anywhere in the markup. */
function expectNothingOfADiff(html: string): void {
  expect(entryItems(html)).toEqual([]);
  expect(html).not.toContain('Changed holes');
  expect(html).not.toContain('Added cards');
  expect(html).not.toContain('Removed cards');
  expect(html).not.toContain('<textarea');
  expect(html).not.toContain('data-diff-text');
}

/** The listing is on screen with its Lines, and every step, jump and breakpoint control is enabled. */
function expectListingAndControlsKept(html: string, pickCount: number): void {
  expect(html).toContain(CODE_VIEW_MARKER);
  const shown = lineItems(html).length;
  expect(shown).toBeGreaterThan(0);
  expect(shown).toBeLessThanOrEqual(WINDOW_SIZE);
  if (pickCount <= WINDOW_SIZE) expect(shown).toBe(pickCount);
  // Step back and step forward are both enabled only away from the two ends, so each screen below selects a middle pick.
  expectControlsOperable(html);
}

describe('Code view empty, missing and failing inputs', () => {
  it('R7.1 an empty Current_Pattern shows the message naming the Scan and Weave screens and no Lines, with every diff control present and disabled', async () => {
    const profile = demoProfile();
    const store = new FakeArchiveStore();
    const deps = archiveWith(store);
    await saveNamed(deps, profile, generateSample(profile, 'diamond'), 'Kota');
    const html = renderToStaticMarkup(<CodeViewScreen state={readyState([])} dispatch={() => undefined} t={en} archiveDeps={deps} />);

    // The one message names both places to get a design, and no Line is shown.
    expect(html).toContain(en('codeview.empty'));
    expect(en('codeview.empty')).toMatch(/Scan screen/);
    expect(en('codeview.empty')).toMatch(/sample design.*Weave screen/);
    expect(lineItems(html)).toEqual([]);
    expect(html).not.toContain(CODE_VIEW_MARKER);
    expect(html).not.toContain('<canvas');

    // Step, jump and run-to-next-breakpoint are present and disabled. The per-Line breakpoint control belongs to a
    // Line, and an empty design has none, so "run to next breakpoint" is the breakpoint control that is present.
    for (const label of [en('codeview.step.back'), en('codeview.step.forward'), en('codeview.run.next'), en('codeview.jump.button')]) {
      expect(buttonTag(html, label), label).toContain('disabled=""');
    }
    expect(/<input[^>]*disabled=""/.test(html)).toBe(true);

    // The diff controls are present too. Even with a Saved_Design in the Archive they are disabled, because the screen
    // hands the panel no Line_Set for an empty Current_Pattern.
    expect(html).toContain(`>${en('codeview.diff.first.label')}</label>`);
    expect(html).toContain(`>${en('codeview.diff.second.label')}</label>`);
    expect(buttonTag(html, en('codeview.diff.compare'))).toContain('disabled=""');
    const emptyLines = patternToLines(profile, []);
    expect(currentLineSetOf(emptyLines, 0)).toBeNull();
    expect(currentLineSetOf(patternToLines(profile, patternOf(3)), 3)).not.toBeNull();
    const summaries = await listedFrom(deps);
    const available = currentLineSetOf(emptyLines, 0) !== null;
    expect(diffControlState({ summaries, comparison: { status: 'idle' }, currentAvailable: available, first: null, second: null })).toEqual({
      choosable: false,
      compareDisabled: true,
    });
    const panel = panelHtml({ summaries, currentAvailable: available, first: { kind: 'saved', id: 'a' }, second: { kind: 'saved', id: 'b' } });
    expect(disabledSelects(panel)).toBe(2);
    expect(buttonTag(panel, en('codeview.diff.compare'))).toContain('disabled=""');
  });

  it('R7.2 storage-unavailable shows its message and disables choosing and comparing, while the listing and the step, jump and breakpoint controls stay enabled', async () => {
    const profile = demoProfile();
    const pattern = patternOf(8);
    const store = new FakeArchiveStore();
    const deps = archiveWith(store);
    const id = await saveNamed(deps, profile, generateSample(profile, 'diamond'), 'Kota');
    const summaries = await listedFrom(deps);
    const chosen = { first: { kind: 'current' } as const, second: { kind: 'saved', id } as const };

    // While the Archive answers, the same panel can be used: this is what the disabling below is measured against.
    const reachable = panelHtml({ summaries, ...chosen });
    expect(disabledSelects(reachable)).toBe(0);
    expect(buttonTag(reachable, en('codeview.diff.compare'))).not.toContain('disabled');

    // A `getDesign` that finds the store unreachable ends the comparison as a value.
    store.failOn('get');
    const comparison = await compareDesigns(againstSaved(profile, pattern, id), deps);
    expect(comparison).toMatchObject({ status: 'blocked', blocked: { kind: 'archive', failure: { reason: 'storage-unavailable' } } });
    const blocked = panelHtml({ summaries, ...chosen, comparison });
    expect(blocked).toContain(en('error.archive.storage-unavailable'));
    expect(blocked).toMatch(/<p role="alert"[^>]*>Saved designs cannot be reached/);
    expect(disabledSelects(blocked)).toBe(2);
    expect(buttonTag(blocked, en('codeview.diff.compare'))).toContain('disabled=""');
    expectNothingOfADiff(blocked);

    // A listing that fails the same way shows the same message and disables the same controls.
    store.clearFailures();
    store.failOn('list');
    const failed = await loadSummaries(deps);
    expect(failed).toMatchObject({ status: 'failed', failure: { reason: 'storage-unavailable' } });
    const unlisted = panelHtml({ summaries: failed });
    expect(unlisted).toContain(en('error.archive.storage-unavailable'));
    expect(disabledSelects(unlisted)).toBe(2);
    expect(buttonTag(unlisted, en('codeview.diff.compare'))).toContain('disabled=""');

    // The listing of the Current_Pattern and the pick controls do not depend on the Archive.
    store.failOn('open');
    const screen = renderToStaticMarkup(
      <CodeViewScreen state={readyState(pattern, { selectedPick: 2, breakpoints: [2] })} dispatch={() => undefined} t={en} archiveDeps={deps} />,
    );
    expectListingAndControlsKept(screen, pattern.length);
    // `not-found` is a different failure and leaves the choosers usable (R7.4).
    expect(
      diffControlState({
        summaries,
        comparison: { status: 'blocked', blocked: { kind: 'archive', failure: { reason: 'not-found', id: 'x' } } },
        currentAvailable: true,
        first: chosen.first,
        second: chosen.second,
      }).choosable,
    ).toBe(true);
  });

  it('R7.3 a saved design that fails validation blocks the comparison, naming the design and its lowest failing pick, with no entries and no counts', async () => {
    const profile = demoProfile();
    const store = new FakeArchiveStore();
    const deps = archiveWith(store);
    const diamond = generateSample(profile, 'diamond');
    // Picks 4 and 1 are cards that fail `validateCardGrid`; the lowest is pick 1, though pick 4 is stored first.
    const damaged = diamond.map((card, pick) => (pick === 1 || pick === 4 ? card.slice(1) : card));
    const id = await saveNamed(deps, profile, damaged, 'Kota');
    const summaries = await listedFrom(deps);

    const comparison = await compareDesigns(againstSaved(profile, diamond, id), deps);
    expect(comparison).toEqual({ status: 'blocked', blocked: { kind: 'damaged', designName: 'Kota', pick: 1 } });
    const html = panelHtml({ summaries, first: { kind: 'current' }, second: { kind: 'saved', id }, comparison });
    expect(html).toContain(en('codeview.damaged.design', { name: 'Kota', pick: 1 }));
    expect(html).toMatch(/<p role="alert"[^>]*>Kota cannot be compared: the card at pick 1 is damaged/);
    expectNothingOfADiff(html);
    // Both choosers stay selectable.
    expect(disabledSelects(html)).toBe(0);

    // The same on the other side, and for the Current_Pattern itself.
    const swapped = await compareDesigns({ ...againstSaved(profile, diamond, id), first: { kind: 'saved', id }, second: { kind: 'current' } }, deps);
    expect(swapped).toEqual(comparison);
    const goodId = await saveNamed(deps, profile, diamond, 'Banarasi');
    const currentDamaged = diamond.map((card, pick) => (pick === 2 ? card.slice(1) : card));
    expect(await compareDesigns(againstSaved(profile, currentDamaged, goodId), deps)).toEqual({
      status: 'blocked',
      blocked: { kind: 'damaged', designName: 'The design open now', pick: 2 },
    });

    // A damaged card takes priority over a refusal: a design saved under another profile is still reported as damaged.
    const otherId = (await saveDesign({ pattern: damaged, profileName: `${profile.name} (other)`, metadata: { ...EMPTY_METADATA, name: 'Kota' } }, deps));
    if (!otherId.ok) throw new Error('save failed');
    const priority = await compareDesigns(againstSaved(profile, diamond, otherId.value), deps);
    expect(priority).toEqual({ status: 'blocked', blocked: { kind: 'damaged', designName: 'Kota', pick: 1 } });

    // A Pattern that is no array is reported with the same message at pick 0.
    const notAnArray: SavedDesign = {
      id: 'broken',
      profileName: profile.name,
      metadata: { ...EMPTY_METADATA, name: 'Old file' },
      createdAt: 1,
      pattern: JSON.parse('"not an array"'),
    };
    await store.put(notAnArray, { id: 'broken', profileName: profile.name, metadata: notAnArray.metadata, createdAt: 1, pickCount: 0 });
    const brokenComparison = await compareDesigns(againstSaved(profile, diamond, 'broken'), deps);
    expect(brokenComparison).toEqual({ status: 'blocked', blocked: { kind: 'damaged', designName: 'Old file', pick: 0 } });
    expect(panelHtml({ comparison: brokenComparison })).toContain(en('codeview.damaged.design', { name: 'Old file', pick: 0 }));

    // The listing of the Current_Pattern stays on screen.
    const screen = renderToStaticMarkup(
      <CodeViewScreen state={readyState(diamond, { selectedPick: 2 })} dispatch={() => undefined} t={en} archiveDeps={deps} />,
    );
    expectListingAndControlsKept(screen, diamond.length);
  });

  it('R7.3 the lowest damaged pick is read from the Lines whatever their order, and none is reported for valid cards', () => {
    const profile = demoProfile();
    const valid = lineSetOf(profile, [[0], [1], [2]]);
    expect(lowestDamagedPick(valid)).toBeNull();
    expect(lowestDamagedPick({ ...valid, lines: [] })).toBeNull();
    const damagedLine = (pick: number): Line => ({ kind: 'damaged', pick, violations: [] });
    expect(lowestDamagedPick({ ...valid, lines: [valid.lines[0]!, damagedLine(5), damagedLine(2), damagedLine(7)] })).toBe(2);
  });

  it('R7.4 not-found shows its message, fetches the list again so the user sees the designs that exist, and keeps the listing', async () => {
    const profile = demoProfile();
    const pattern = patternOf(8);
    const store = new ListCountingStore();
    const deps = archiveWith(store);
    const diamond = generateSample(profile, 'diamond');
    const keptId = await saveNamed(deps, profile, diamond, 'Kota');
    const goneId = await saveNamed(deps, profile, diamond.slice(1), 'Banarasi');
    const before = await listedFrom(deps);
    // The Archive lists the newest design first, so the ids are compared as a set.
    expect(before.status === 'ready' && before.list.map((summary) => summary.id).sort()).toEqual([keptId, goneId].sort());
    expect(store.lists).toBe(1);

    // The design is deleted elsewhere after the list was shown, and then the user compares against it.
    expect(await store.remove(goneId)).toBe(true);
    const run = await runComparison(againstSaved(profile, pattern, goneId), deps);
    expect(run.comparison).toEqual({ status: 'blocked', blocked: { kind: 'archive', failure: { reason: 'not-found', id: goneId } } });
    expect(needsFreshList(run.comparison)).toBe(true);
    // `listDesigns` was called again, and its answer is the list the panel is given.
    expect(store.lists).toBe(2);
    expect(run.summaries).toMatchObject({ status: 'ready', list: [{ id: keptId }] });
    if (run.summaries === null || run.summaries.status !== 'ready') throw new Error('the fresh list must be ready');
    // The choice of the deleted design is dropped from the choosers, and the other choice is kept.
    expect(keepIfListed({ kind: 'saved', id: goneId }, run.summaries)).toBeNull();
    expect(keepIfListed({ kind: 'saved', id: keptId }, run.summaries)).toEqual({ kind: 'saved', id: keptId });
    expect(keepIfListed({ kind: 'current' }, run.summaries)).toEqual({ kind: 'current' });
    expect(keepIfListed(null, run.summaries)).toBeNull();

    const html = panelHtml({ summaries: run.summaries, first: keepIfListed({ kind: 'current' }, run.summaries), second: null, comparison: run.comparison });
    expect(html).toContain(en('error.archive.not-found'));
    expect(html).toContain('Kota (');
    expect(html).not.toContain('Banarasi');
    expect(disabledSelects(html)).toBe(0);
    expectNothingOfADiff(html);

    // A comparison that succeeds, or that fails in another way, asks for no new list.
    store.lists = 0;
    const fine = await runComparison(againstSaved(profile, pattern, keptId), deps);
    expect(fine.summaries).toBeNull();
    expect(needsFreshList(fine.comparison)).toBe(false);
    store.failOn('get');
    const unreachable = await runComparison(againstSaved(profile, pattern, keptId), deps);
    expect(unreachable.summaries).toBeNull();
    expect(store.lists).toBe(0);

    // The listing of the Current_Pattern stays on screen.
    store.clearFailures();
    const screen = renderToStaticMarkup(
      <CodeViewScreen state={readyState(pattern, { selectedPick: 2 })} dispatch={() => undefined} t={en} archiveDeps={deps} />,
    );
    expectListingAndControlsKept(screen, pattern.length);
  });

  it('R7.5 two equal Line_Sets report zero, zero and zero, show every entry as unchanged and the designs-are-the-same message, and no refusal or error', async () => {
    const profile = demoProfile();
    const store = new FakeArchiveStore();
    const deps = archiveWith(store);
    const diamond = generateSample(profile, 'diamond');
    const id = await saveNamed(deps, profile, diamond, 'Kota');
    const summaries = await listedFrom(deps);

    const comparison = await compareDesigns(againstSaved(profile, diamond, id), deps);
    if (comparison.status !== 'ready' || !comparison.diff.ok) throw new Error('the comparison must succeed');
    expect(comparison.diff.counts).toEqual({ changedHoles: 0, addedCards: 0, removedCards: 0 });
    expect(comparison.diff.entries).toHaveLength(diamond.length);
    expect(comparison.diff.entries.every((entry) => entry.kind === 'unchanged')).toBe(true);
    expect(isSameDesign(comparison.diff)).toBe(true);

    const html = panelHtml({ summaries, first: { kind: 'current' }, second: { kind: 'saved', id }, comparison });
    expect(html).toContain('Changed holes: 0');
    expect(html).toContain('Added cards: 0');
    expect(html).toContain('Removed cards: 0');
    expect(html).toContain(en('codeview.diff.same'));
    expect(html).toMatch(/<p role="status"[^>]*>The two designs are the same\.<\/p>/);
    const items = entryItems(html);
    expect(items).toHaveLength(diamond.length);
    expect(items.every((item) => kindOf(item) === 'unchanged')).toBe(true);
    // No refusal and no error: nothing is announced as an alert, and none of the refusal or failure texts is there.
    expect(html).not.toContain('role="alert"');
    for (const key of ['codeview.refusal.dimension-mismatch', 'codeview.refusal.profile-mismatch', 'codeview.refusal.too-many-picks']) {
      expect(html).not.toContain(en(key).slice(0, 30));
    }
    for (const key of ['error.archive.not-found', 'error.archive.storage-unavailable', 'error.generic']) expect(html).not.toContain(en(key));

    // A Diff with a difference does not say the designs are the same.
    const different = panelHtml({ comparison: readyComparison(profile) });
    expect(different).not.toContain(en('codeview.diff.same'));
    expect(isSameDesign(fourKinds(profile).diff)).toBe(false);
  });

  it('R7.7 a Current_Pattern longer than the Diff_Pick_Limit still shows its listing, with the step, jump and breakpoint controls enabled', () => {
    const pattern = patternOf(DIFF_PICK_LIMIT + 1);
    const html = render(readyState(pattern, { selectedPick: 1_500, breakpoints: [3] }));
    expectListingAndControlsKept(html, pattern.length);
    expect(html).toContain(en('codeview.pickCount', { count: DIFF_PICK_LIMIT + 1 }));
    expect(html).not.toContain('role="alert"');
  });

  it('R7.8 comparing a Current_Pattern longer than the Diff_Pick_Limit shows the too-many-picks message naming the limit and its pick count, no counts, and keeps the listing', async () => {
    const profile = demoProfile();
    const store = new FakeArchiveStore();
    const deps = archiveWith(store);
    const diamond = generateSample(profile, 'diamond');
    const id = await saveNamed(deps, profile, diamond, 'Kota');
    const summaries = await listedFrom(deps);
    const long = patternOf(DIFF_PICK_LIMIT + 1);

    const comparison = await compareDesigns(againstSaved(profile, long, id), deps);
    if (comparison.status !== 'ready' || comparison.diff.ok) throw new Error('the comparison must be refused');
    expect(comparison.diff.refusal).toEqual({
      reason: 'too-many-picks',
      limit: DIFF_PICK_LIMIT,
      firstPicks: DIFF_PICK_LIMIT + 1,
      secondPicks: diamond.length,
    });
    const html = panelHtml({ summaries, first: { kind: 'current' }, second: { kind: 'saved', id }, comparison });
    const message = en('codeview.refusal.too-many-picks', { limit: DIFF_PICK_LIMIT, firstPicks: DIFF_PICK_LIMIT + 1, secondPicks: diamond.length });
    expect(html).toContain(message);
    expect(message).toContain(String(DIFF_PICK_LIMIT));
    expect(message).toContain(String(DIFF_PICK_LIMIT + 1));
    expect(html).toMatch(/<p role="alert"[^>]*>These designs are too long to compare/);
    expectNothingOfADiff(html);
    // Both choosers stay listed and selectable, and Compare can be pressed again after another choice.
    expect(disabledSelects(html)).toBe(0);
    expect(buttonTag(html, en('codeview.diff.compare'))).not.toContain('disabled');

    // The listing of the Current_Pattern stays on screen.
    const screen = renderToStaticMarkup(
      <CodeViewScreen state={readyState(long, { selectedPick: 2 })} dispatch={() => undefined} t={en} archiveDeps={deps} />,
    );
    expectListingAndControlsKept(screen, long.length);
  });

  it('R7.6 a Card_Profile that failed to load shows the App profile message in place of the listing, no Lines, disabled controls and operable navigation', () => {
    const failedState: AppState = {
      ...readyState(patternOf(6)),
      profile: { status: 'failed', failure: { reason: 'not-json' } },
    };
    const html = render(failedState);
    expect(html).toMatch(/<p role="alert"[^>]*>The card profile could not be used\./);
    expect(html).toContain(en('error.profile.banner'));
    expect(lineItems(html)).toEqual([]);
    expect(html).not.toContain(CODE_VIEW_MARKER);
    expect(html).not.toContain('<canvas');
    for (const label of [en('codeview.step.back'), en('codeview.step.forward'), en('codeview.run.next'), en('codeview.jump.button')]) {
      expect(buttonTag(html, label), label).toContain('disabled=""');
    }
    expect(/<input[^>]*disabled=""/.test(html)).toBe(true);
    // The diff controls are present and disabled.
    expect(disabledSelects(html)).toBe(2);
    expect(buttonTag(html, en('codeview.diff.compare'))).toContain('disabled=""');
    // No Line_Set without a profile, so the panel offers nothing to choose even with Saved_Designs listed.
    expect(currentLineSetOf(null, 6)).toBeNull();
    // Every navigation control stays operable: the navigation is outside the screen and has no disabled control.
    const nav = navHtml(failedState);
    expect(nav.match(/<button/g)).toHaveLength(SCREENS.length);
    expect(nav).not.toContain('disabled');
  });

  it('R6.12 R6.13 each refusal reason has its own message naming its values and an action, keeps both designs selectable and offers no entries, counts or Diff_Text', async () => {
    const profile = demoProfile();
    const { first, second } = fourKinds(profile);
    const refusals = [
      diffPatterns(first, { ...second, hookRows: second.hookRows + 1, hookColumns: second.hookColumns + 2 }),
      diffPatterns(first, { ...second, profileName: 'Other card' }),
      diffPatterns(lineSetOf(profile, Array.from({ length: DIFF_PICK_LIMIT + 1 }, () => [0])), second),
    ];
    const summaries: Summaries = { status: 'ready', list: [summaryOf('a', 'Kota'), summaryOf('b', 'Banarasi')] };
    const messages: string[] = [];
    for (const diff of refusals) {
      if (diff.ok) throw new Error('the two designs must be refused');
      const comparison: Comparison = { status: 'ready', first: { name: 'First', lineSet: first }, second: { name: 'Second', lineSet: second }, diff };
      const html = panelHtml({ summaries, first: { kind: 'saved', id: 'a' }, second: { kind: 'saved', id: 'b' }, comparison });
      const message = refusalMessage(diff.refusal, en);
      messages.push(message);
      expect(html, diff.refusal.reason).toContain(message);
      expect(html).toMatch(/<p role="alert"/);
      expectNothingOfADiff(html);
      // Both chosen designs stay listed and selectable, and the compare control is still usable.
      expect(disabledSelects(html)).toBe(0);
      expect(html).toContain('<option value="saved:a" selected="">');
      expect(html).toContain('<option value="saved:b" selected="">');
      expect(buttonTag(html, en('codeview.diff.compare'))).not.toContain('disabled');
      // The message ends with the one thing the user can do next.
      expect(message).toMatch(/Choose /);
      expect(message).not.toMatch(/\{|\}/);
    }
    expect(new Set(messages).size).toBe(3);
    expect(messages[0]).toContain(`${first.hookRows} hook rows and ${first.hookColumns} hook columns`);
    expect(messages[0]).toContain(`${second.hookRows + 1} hook rows and ${second.hookColumns + 2} hook columns`);
    expect(messages[1]).toContain(`${first.profileName} and Other card`);
    expect(messages[2]).toContain(`At most ${DIFF_PICK_LIMIT} picks`);
    expect(messages[2]).toContain(`${DIFF_PICK_LIMIT + 1} and ${second.lines.length}`);
    // Each message comes from the Translation_File, in both languages.
    const hi = translator(DICTIONARIES, 'hi');
    const refused = refusals[1];
    if (refused === undefined || refused.ok) throw new Error('the profile mismatch must be refused');
    expect(refusalMessage(refused.refusal, hi)).not.toBe(messages[1]);
  });

  it('R6.10 a design saved under another Card_Profile is refused as profile-mismatch naming both profiles, with no counts, no entries and no Diff_Text', async () => {
    const profile = demoProfile();
    const store = new FakeArchiveStore();
    const deps = archiveWith(store);
    const diamond = generateSample(profile, 'diamond');
    const saved = await saveDesign(
      { pattern: diamond, profileName: 'Older loom card', metadata: { ...EMPTY_METADATA, name: 'Kota' } },
      deps,
    );
    if (!saved.ok) throw new Error('save failed');
    const summaries = await listedFrom(deps);

    const comparison = await compareDesigns(againstSaved(profile, diamond, saved.value), deps);
    if (comparison.status !== 'ready' || comparison.diff.ok) throw new Error('the comparison must be refused');
    // The Line_Set of the Saved_Design carries the name it was saved under, so the refusal names both profiles.
    expect(comparison.second.lineSet.profileName).toBe('Older loom card');
    expect(comparison.first.lineSet.profileName).toBe(profile.name);
    expect(comparison.diff.refusal).toEqual({ reason: 'profile-mismatch', firstProfileName: profile.name, secondProfileName: 'Older loom card' });
    const html = panelHtml({ summaries, first: { kind: 'current' }, second: { kind: 'saved', id: saved.value }, comparison });
    expect(html).toContain(en('codeview.refusal.profile-mismatch', { firstProfileName: profile.name, secondProfileName: 'Older loom card' }));
    expectNothingOfADiff(html);
    expect(disabledSelects(html)).toBe(0);

    // A design saved under the profile in use still compares.
    const same = await saveNamed(deps, profile, diamond, 'Banarasi');
    const fine = await compareDesigns(againstSaved(profile, diamond, same), deps);
    expect(fine.status === 'ready' && fine.diff.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Keyboard, focus, colour and motion (R11.1, R11.7, R11.9, R11.13, R10.8). The test environment is Node with server
// rendering only: no key can be pressed, no focus can move and nothing scrolls. What is tested is what the markup
// says (the tab order, the text markers, the names) and the pure functions behind the focus move. The real focus move
// after a Window move, real scrolling, the contrast of the ring and the layout at 320, 390 and 1280 px need
// `check:browser`. The CSS rules are scanned in tests/ui/accessibility.test.tsx.
// ---------------------------------------------------------------------------------------------------------------

/**
 * The elements of `html` a Tab key stops on, in document order, each as a short description: a native control that is
 * not disabled, or any element with `tabindex="0"`. A `tabindex` of any other value is listed as such, so the test
 * that compares the lists fails on it.
 */
function tabStops(html: string): string[] {
  const stops: string[] = [];
  for (const match of html.matchAll(/<([a-z0-9]+)\b([^>]*)>/g)) {
    const tag = match[1]!;
    const attributes = match[2]!;
    const tabindex = /\btabindex="(-?\d+)"/.exec(attributes)?.[1];
    if (tabindex !== undefined && tabindex !== '0') {
      stops.push(`tabindex=${tabindex} on ${tag}`);
      continue;
    }
    const native = ['button', 'input', 'select', 'textarea'].includes(tag) && !/\bdisabled=""/.test(attributes);
    if (!native && tabindex !== '0') continue;
    if (tag === 'button') {
      const start = (match.index ?? 0) + match[0].length;
      const text = html.slice(start, html.indexOf('</button>', start)).replace(/<[^>]*>/g, '');
      stops.push(/aria-pressed=/.test(attributes) ? 'breakpoint' : `button:${text}`);
    } else if (tabindex === '0') {
      stops.push(/role="region"/.test(attributes) ? 'region' : /role="group"/.test(attributes) ? 'bit-line' : `tabindex=0 on ${tag}`);
    } else {
      stops.push(tag);
    }
  }
  return stops;
}

describe('Code view keyboard order (R11.1)', () => {
  it('R11.1 Tab visits the screen controls, then each Line breakpoint control and Bit_Line region, then the diff panel', () => {
    const html = render(readyState(patternOf(3), { selectedPick: 1 }));
    expect(tabStops(html)).toEqual([
      `button:${en('codeview.step.back')}`,
      `button:${en('codeview.step.forward')}`,
      `button:${en('codeview.run.next')}`,
      'input',
      `button:${en('codeview.jump.button')}`,
      'breakpoint',
      'bit-line',
      'breakpoint',
      'bit-line',
      'breakpoint',
      'bit-line',
    ]);
    // The panel's choosers and compare control are in the markup after every Line; they are disabled until the Archive answers.
    expect(html.indexOf('<select')).toBeGreaterThan(html.lastIndexOf('data-pick='));
    expect(html.match(/<select[^>]*disabled=""/g)).toHaveLength(2);
  });

  it('R11.1 the diff panel is tabbed in its visual order, and a long Diff has one tab stop for its entries, not one for each', () => {
    const html = panelHtml({ comparison: readyComparison(demoProfile()), first: { kind: 'current' }, second: { kind: 'current' } });
    expect(tabStops(html)).toEqual([
      'select',
      'select',
      `button:${en('codeview.diff.compare')}`,
      'region',
      'textarea',
      `button:${en('codeview.diff.copy')}`,
      `button:${en('codeview.diff.download')}`,
    ]);
    expect(entryItems(html)).toHaveLength(6);
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
  });

  it('R11.1 every control is a native element, none sets a tab index above 0, and none is reachable by pointer only', () => {
    const state = readyState(patternOf(3), { selectedPick: 1 });
    for (const html of [render(state), panelHtml({ comparison: readyComparison(demoProfile()) })]) {
      expect(html).not.toMatch(/role="button"/);
      expect(html).not.toMatch(/tabindex="(?!0")/);
      expect(tabStops(html).filter((stop) => stop.startsWith('tabindex'))).toEqual([]);
    }
    // A click-only element would be an `onClick` on a non-control; the server markup shows no handlers, so the rule is
    // that each Line's action is a real button, and the jump control is a form that Enter submits.
    expect(lineItems(render(state)).every((item) => /<button type="button"[^>]*aria-pressed=/.test(item))).toBe(true);
    expect(render(state)).toMatch(/<form[^>]*>/);
  });

  it('R11.1 focus can leave the listing: Tab and Shift+Tab are not taken by a Bit_Line region, and the navigation is before the screen', () => {
    const profile = demoProfile();
    for (const key of ['Tab', 'Shift', 'Escape', 'Enter', ' ']) {
      expect(scrollLeftAfterKey(key, 10, 100, 5), key).toBeNull();
    }
    const html = renderToStaticMarkup(
      <Shell
        state={{ ...initialAppState, language: 'en', screen: 'code', profile: { status: 'ready', profile }, current: { pattern: patternOf(3), origin: { kind: 'sample', design: 'diamond' } } }}
        dispatch={() => undefined}
      />,
    );
    // The App navigation comes before the screen in the document, so Shift+Tab from the listing reaches it.
    expect(html.indexOf('<nav')).toBeGreaterThanOrEqual(0);
    expect(html.indexOf('<nav')).toBeLessThan(html.indexOf('<main'));
    expect(tabStops(/<nav[^>]*>[\s\S]*?<\/nav>/.exec(html)![0])).toHaveLength(4);
  });
});

describe('Code view without colour (R11.7)', () => {
  it('R11.7 the Selected_Pick, a Breakpoint and a Line with both each carry a shape of their own, and a plain Line carries none', () => {
    const items = lineItems(render(readyState(patternOf(5), { selectedPick: 1, breakpoints: [1, 3] })));
    const marks = items.map((item) => hiddenSpans(item)[0]);
    expect(marks).toEqual(['   ', '▶ ●', '   ', '  ●', '   ']);
    // The breakpoint control itself shows a filled or an empty circle, and says on or off in aria-pressed.
    const controlText = items.map((item) => /<button[^>]*>([^<]*)<\/button>/.exec(item)?.[1]);
    expect(controlText).toEqual(['○', '●', '○', '●', '○']);
    expect(items.map((item) => item.includes('aria-pressed="true"'))).toEqual([false, true, false, true, false]);
  });

  it('R11.7 each Diff_Entry kind has its own marker character and its own kind word, so no two kinds look alike without colour', () => {
    const items = entryItems(panelHtml({ comparison: readyComparison(demoProfile()) }));
    const signs = new Set(items.map((item) => `${hiddenSpans(item)[0]}|${kindOf(item)}`));
    expect(signs.size).toBe(4);
    expect(new Set(items.map((item) => hiddenSpans(item)[0])).size).toBe(4);
    for (const item of items) expect(item).toContain(`>${en(`codeview.diff.kind.${kindOf(item)}`)}</span>`);
  });
});

describe('Code view reduced motion (R11.9)', () => {
  it('R11.9 the Window and the Selected_Pick marker are in the first markup for a far Selected_Pick, whatever the motion setting', () => {
    const pattern = patternOf(10_000);
    const calm = render(readyState(pattern, { selectedPick: 5_000, prefersReducedMotion: true }));
    const items = lineItems(calm);
    // One step: the Line of the Selected_Pick is in the document, marked and current, in the very first markup.
    const selected = items.find((item) => pickOf(item) === 5_000);
    expect(selected).toBeDefined();
    expect(selected).toContain('aria-current="true"');
    expect(hiddenSpans(selected!)[0]).toContain('▶');
    expect(items.length).toBeLessThanOrEqual(WINDOW_SIZE);
    // The screen holds no motion state of its own: the same markup for both settings.
    expect(render(readyState(pattern, { selectedPick: 5_000, prefersReducedMotion: false }))).toBe(calm);
  });

  it('R11.9 a move of the Selected_Pick is one scroll position and one Window, and the scroll position puts its Line in view', () => {
    const lineHeight = 48;
    const viewportHeight = 480;
    for (const pick of [0, 12, 5_000, 9_999]) {
      const scrollTop = scrollTopToShowPick(pick, lineHeight, 0, viewportHeight);
      // The result is a single number to assign, never a list of steps, and the Line is inside the viewport at it.
      expect(Number.isFinite(scrollTop)).toBe(true);
      expect(pick * lineHeight).toBeGreaterThanOrEqual(scrollTop);
      expect((pick + 1) * lineHeight).toBeLessThanOrEqual(scrollTop + viewportHeight);
      const shown = listingWindow(null, 10_000, pick, firstVisiblePickAt(scrollTop, lineHeight), 11);
      expect(pick).toBeGreaterThanOrEqual(shown.from);
      expect(pick).toBeLessThan(shown.from + shown.count);
    }
  });
});

describe('Code view focus after a Window move (R11.13)', () => {
  const pickWindow = { from: 100, count: 80 };

  it('R11.13 a breakpoint control whose Line left the Window moves to the breakpoint control of the Selected_Pick', () => {
    expect(focusTargetAfterWindowMove({ kind: 'breakpoint', pick: 3 }, pickWindow, 120, 'bits')).toEqual({ kind: 'breakpoint', pick: 120 });
  });

  it('R11.13 a Bit_Line region whose Line left the Window moves to the Bit_Line region of the Selected_Pick', () => {
    expect(focusTargetAfterWindowMove({ kind: 'bit-line', pick: 400 }, pickWindow, 150, 'bits')).toEqual({ kind: 'bit-line', pick: 150 });
  });

  it('R11.13 a control whose Line is still in the Window keeps focus, so nothing moves', () => {
    expect(focusTargetAfterWindowMove({ kind: 'bit-line', pick: 150 }, pickWindow, 120, 'bits')).toBeNull();
    expect(focusTargetAfterWindowMove({ kind: 'breakpoint', pick: pickWindow.from }, pickWindow, 120, 'bits')).toBeNull();
    const last = pickWindow.from + pickWindow.count - 1;
    expect(focusTargetAfterWindowMove({ kind: 'breakpoint', pick: last }, pickWindow, 120, 'bits')).toBeNull();
    // One past the last Line of the Window is outside it.
    expect(focusTargetAfterWindowMove({ kind: 'breakpoint', pick: last + 1 }, pickWindow, 120, 'bits')).toEqual({ kind: 'breakpoint', pick: 120 });
  });

  it('R11.13 a damaged Selected_Pick Line has no Bit_Line region, so a Bit_Line focus goes to step forward and a breakpoint focus stays on its kind', () => {
    expect(focusTargetAfterWindowMove({ kind: 'bit-line', pick: 3 }, pickWindow, 120, 'damaged')).toBe('step-forward');
    expect(focusTargetAfterWindowMove({ kind: 'breakpoint', pick: 3 }, pickWindow, 120, 'damaged')).toEqual({ kind: 'breakpoint', pick: 120 });
  });

  it('R11.13 a Selected_Pick whose Line is not in the Window, or that has no Line, sends focus to step forward', () => {
    expect(focusTargetAfterWindowMove({ kind: 'breakpoint', pick: 3 }, pickWindow, 5_000, 'bits')).toBe('step-forward');
    expect(focusTargetAfterWindowMove({ kind: 'bit-line', pick: 3 }, pickWindow, 120, null)).toBe('step-forward');
  });

  it('R11.13 every Line control carries the data the listing reads to find it again, and step forward is a real button', () => {
    const html = render(readyState(patternOf(4), { selectedPick: 2 }));
    for (const item of lineItems(html)) {
      expect(item).toMatch(/<button[^>]*data-line-control="breakpoint"/);
      expect(item).toMatch(/role="group"[^>]*data-line-control="bit-line"/);
    }
    expect(buttonTag(html, en('codeview.step.forward'))).not.toContain('disabled');
  });
});

describe('Code view names and live-region text in both languages (R10.8, R11.3 to R11.5)', () => {
  const hi = translator(DICTIONARIES, 'hi');
  const latin = /[A-Za-z]/;

  it('R10.8 R11.3 R11.4 Line names read in Hindi with the pick and end words, and in English exactly as the requirement says', () => {
    const profile = demoProfile();
    const punchedAt = (ends: ReadonlyArray<number>): Line => ({ kind: 'bits', pick: 5, bits: bitsAt(profile, ends) });
    expect(lineAccessibleName(en, punchedAt([0, 3, 7]))).toBe('Pick 5: punched at ends 0, 3, 7');
    expect(lineAccessibleName(en, punchedAt([]))).toBe('Pick 5: no end punched');
    expect(lineAccessibleName(hi, punchedAt([0, 3, 7]))).toBe(hi('codeview.line.name', { pick: 5, ends: '0, 3, 7' }));
    for (const name of [
      lineAccessibleName(hi, punchedAt([0, 3, 7])),
      lineAccessibleName(hi, punchedAt([])),
      lineAccessibleName(hi, { kind: 'damaged', pick: 5, violations: [] }),
    ]) {
      expect(name).toContain('पिक');
      expect(name, name).not.toMatch(latin);
    }
    expect(lineAccessibleName(hi, punchedAt([0, 3, 7]))).toContain('एंड');
  });

  it('R10.8 the names of the listing, the Bit_Line region and the breakpoint control come from the Translation_File in each language', () => {
    for (const translate of [en, hi]) {
      const html = renderToStaticMarkup(
        <CodeViewScreen state={{ ...readyState(patternOf(3)), language: translate === en ? 'en' : 'hi' }} dispatch={() => undefined} t={translate} />,
      );
      expect(html).toContain(`aria-label="${translate('codeview.listing.name')}"`);
      for (const pick of [0, 1, 2]) {
        expect(html).toContain(`aria-label="${translate('codeview.bitline.name', { pick })}"`);
        expect(html).toContain(`aria-label="${translate('codeview.breakpoint.name', { pick })}"`);
      }
    }
    for (const key of ['codeview.bitline.name', 'codeview.breakpoint.name']) {
      expect(hi(key, { pick: 4 })).toContain('पिक');
      expect(hi(key, { pick: 4 })).not.toMatch(latin);
    }
  });

  it('R10.8 R11.5 the name of each Diff_Entry kind comes from the Translation_File, with the kind word and the ends, and no English in Hindi', () => {
    const profile = demoProfile();
    const { diff } = fourKinds(profile);
    if (!diff.ok) throw new Error('the two designs must compare');
    for (const entry of diff.entries) {
      const hindi = diffEntryAccessibleName(hi, entry);
      expect(hindi, hindi).not.toMatch(latin);
      expect(hindi).toContain(hi(`codeview.diff.kind.${entry.kind}`));
      expect(diffEntryAccessibleName(en, entry)).toContain(en(`codeview.diff.kind.${entry.kind}`));
    }
    const changed = diff.entries.find((entry) => entry.kind === 'changed');
    expect(diffEntryAccessibleName(hi, changed!)).toContain('एंड 2, 5');
    expect(diffEntryAccessibleName(en, changed!)).toContain('ends 2, 5');
  });

  it('R10.8 R11.6 the live region shows the announcement text of the Translation_File, with the pick number, in both languages', () => {
    const profile = demoProfile();
    for (const language of LANGUAGES) {
      const translate = translator(DICTIONARIES, language);
      for (const announcement of [
        { kind: 'confirmation' as const, messageKey: 'codeview.announce.pick', params: { pick: 12 }, id: 1 },
        { kind: 'confirmation' as const, messageKey: 'codeview.announce.noBreakpoint', id: 2 },
      ]) {
        const html = renderToStaticMarkup(
          <Shell
            state={{ ...initialAppState, language, screen: 'code', profile: { status: 'ready', profile }, announcement }}
            dispatch={() => undefined}
          />,
        );
        const live = /<div role="status" aria-live="polite"[^>]*>([\s\S]*?)<\/div>/.exec(html)?.[1];
        expect(live, `${language} ${announcement.messageKey}`).toBe(translate(announcement.messageKey, announcement.params).replaceAll("'", '&#x27;'));
        if (language === 'hi') expect(live).not.toMatch(latin);
      }
    }
    expect(hi('codeview.announce.pick', { pick: 12 })).toContain('पिक');
    expect(hi('codeview.announce.pick', { pick: 12 })).toContain('12');
  });
});
