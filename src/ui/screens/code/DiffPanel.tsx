import { memo, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { getDesign, listDesigns } from '../../../archive/index.ts';
import type { ArchiveDeps, ArchiveFailure, DesignSummary } from '../../../archive/index.ts';
import type { CompareRequest } from '../../types.ts';
import type { CardProfile } from '../../../codec/index.ts';
import { DIFF_MARKERS, diffPatterns, diffToText, groupBits, patternToLines } from '../../../codec-view/index.ts';
import type { BitLine, Diff, DiffEntry, DiffRefusal, Line, LineSet } from '../../../codec-view/index.ts';
import { archiveFailureKey } from '../../i18n/messages.ts';
import type { Translate } from '../../i18n/messages.ts';
import { diffEntryAccessibleName, pickNumberWidth } from '../../state/codeView.ts';
import { savedLabel } from '../../state/keep.ts';
import {
  browserDiffTextDeps,
  copyDiffText,
  diffTextLineCount,
  diffTextStatusKey,
  downloadDiffText,
} from './diffText.ts';
import type { DiffTextDeps, DiffTextStatus } from './diffText.ts';
import { Button } from '../../components/Button.tsx';
import { Field } from '../../components/Field.tsx';
import { Notice } from '../../components/Notice.tsx';
import { Panel } from '../../components/Panel.tsx';
import { StateMessage } from '../../components/StateMessage.tsx';
import styles from './DiffPanel.module.css';

/** Shown under each differing end of a `changed` entry (R6.7, R11.7). A text marker, so colour is never the only signal. */
export const CHANGED_MARK = '^';
/** Written in a pick field the entry has no pick index on, as the Diff_Text does (R6.14). */
const NO_PICK = '-';
/** Between the first Line_Set's pick index and the second's, as in the Diff_Text (R6.14). */
const PICK_SEPARATOR = '/';

// ---------------------------------------------------------------------------------------------------------------
// State of the panel: what the user chose, what the Archive listed and the result of one comparison.
// ---------------------------------------------------------------------------------------------------------------

/** One side of a comparison: the Current_Pattern, or one Saved_Design from the Archive's list (R6.6). */
export type SideChoice = { kind: 'current' } | { kind: 'saved'; id: string };

export type Summaries =
  | { status: 'loading' }
  | { status: 'ready'; list: ReadonlyArray<DesignSummary> }
  | { status: 'failed'; failure: ArchiveFailure };

/** A Line_Set with the name the screen shows for its design. Only the Line_Set is kept, never the Pattern. */
export type NamedLineSet = { name: string; lineSet: LineSet };

/** Why a comparison could not be made: an Archive failure (R7.2, R7.4) or a design with a damaged card (R7.3). */
export type Blocked =
  | { kind: 'archive'; failure: ArchiveFailure }
  | { kind: 'damaged'; designName: string; pick: number };

/** The result of the one comparison the panel holds. */
export type Comparison =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; first: NamedLineSet; second: NamedLineSet; diff: Diff }
  | { status: 'blocked'; blocked: Blocked };

export const IDLE: Comparison = { status: 'idle' };

// ---------------------------------------------------------------------------------------------------------------
// The Archive calls and the comparison, as plain async functions that return values and never throw.
// ---------------------------------------------------------------------------------------------------------------

/** Lists the Saved_Designs. The panel calls this once, when it mounts (R6.6). */
export async function loadSummaries(deps?: ArchiveDeps): Promise<Summaries> {
  const listed = await listDesigns(deps);
  return listed.ok ? { status: 'ready', list: listed.value } : { status: 'failed', failure: listed.failure };
}

export type CompareInput = {
  /** The design chosen first: the first Line_Set, so `added` means present only in the second (R6.6). */
  first: SideChoice;
  second: SideChoice;
  profile: CardProfile;
  /** The Current_Pattern's Line_Set, or null when it has none; a comparison that needs it then gives nothing. */
  current: NamedLineSet | null;
  /** The name shown for a Saved_Design whose Metadata has no name. */
  untitled: string;
};

/** The distinct Saved_Design ids of the two choices, the first side's first. */
function savedIds(first: SideChoice, second: SideChoice): string[] {
  const ids: string[] = [];
  for (const choice of [first, second]) {
    if (choice.kind === 'saved' && !ids.includes(choice.id)) ids.push(choice.id);
  }
  return ids;
}

/**
 * The lowest pick index of a `damaged` Line in the Line_Set, or null when every Line is a valid card (R7.3).
 * Reads the pick index of each Line and does not rely on the order of the Lines.
 */
export function lowestDamagedPick(lineSet: LineSet): number | null {
  let lowest: number | null = null;
  for (const line of lineSet.lines) {
    if (line.kind === 'damaged' && (lowest === null || line.pick < lowest)) lowest = line.pick;
  }
  return lowest;
}

/**
 * Compares two chosen designs. `getDesign` is called once for each distinct chosen Saved_Design; each Pattern goes
 * straight through `patternToLines` and only the Line_Set is kept (R6.6). The Line_Set of a Saved_Design carries the
 * Card_Profile name the design was saved under, and not the name of the profile in use, so a design saved under
 * another profile is refused by `diffPatterns` as `profile-mismatch` and is not read as if it were this profile's
 * (R6.10). The first failing Archive call ends the comparison as a value. Before `diffPatterns` is called, both
 * Line_Sets are scanned for a `damaged` Line; the first side's is reported first and takes priority over any
 * refusal (R7.3). Choosing the same design on both sides is allowed and gives an all-`unchanged` Diff.
 */
export async function compareDesigns(input: CompareInput, deps?: ArchiveDeps): Promise<Comparison> {
  const fetched = new Map<string, NamedLineSet>();
  for (const id of savedIds(input.first, input.second)) {
    const result = await getDesign(id, deps);
    if (!result.ok) return { status: 'blocked', blocked: { kind: 'archive', failure: result.failure } };
    const name = savedLabel(result.value.metadata, input.untitled);
    const lines = patternToLines(input.profile, result.value.pattern);
    // A Pattern that is no array cannot be read as cards; for the reader that is a damaged design at pick 0.
    if (!lines.ok) return { status: 'blocked', blocked: { kind: 'damaged', designName: name, pick: 0 } };
    fetched.set(id, { name, lineSet: { ...lines.lineSet, profileName: result.value.profileName } });
  }
  const sideOf = (choice: SideChoice): NamedLineSet | null =>
    choice.kind === 'current' ? input.current : (fetched.get(choice.id) ?? null);
  const first = sideOf(input.first);
  const second = sideOf(input.second);
  if (first === null || second === null) return IDLE;
  for (const side of [first, second]) {
    const pick = lowestDamagedPick(side.lineSet);
    if (pick !== null) return { status: 'blocked', blocked: { kind: 'damaged', designName: side.name, pick } };
  }
  return { status: 'ready', first, second, diff: diffPatterns(first.lineSet, second.lineSet) };
}

/** True when the Archive said the chosen Saved_Design is not there, so the list the user sees must be fetched again (R7.4). */
export function needsFreshList(comparison: Comparison): boolean {
  return (
    comparison.status === 'blocked' &&
    comparison.blocked.kind === 'archive' &&
    comparison.blocked.failure.reason === 'not-found'
  );
}

/** One comparison and, after a `not-found`, the fresh listing that goes with it; `summaries` is null when none was asked for. */
export type ComparisonRun = { comparison: Comparison; summaries: Summaries | null };

/** `compareDesigns`, then `listDesigns` again when the chosen design was not found (R7.4). Never throws. */
export async function runComparison(input: CompareInput, deps?: ArchiveDeps): Promise<ComparisonRun> {
  const comparison = await compareDesigns(input, deps);
  return { comparison, summaries: needsFreshList(comparison) ? await loadSummaries(deps) : null };
}

/** A chosen Saved_Design that a fresh list no longer holds is no choice any more; every other choice is kept. */
export function keepIfListed(choice: SideChoice | null, summaries: Summaries): SideChoice | null {
  if (choice === null || choice.kind === 'current' || summaries.status !== 'ready') return choice;
  return summaries.list.some((summary) => summary.id === choice.id) ? choice : null;
}

/**
 * True while the Archive cannot be reached: the listing failed, or a call of the comparison came back as
 * `storage-unavailable`. The controls that choose or compare a Saved_Design are disabled then (R7.2).
 */
export function archiveUnreachable(summaries: Summaries, comparison: Comparison): boolean {
  if (summaries.status === 'failed') return true;
  return (
    comparison.status === 'blocked' &&
    comparison.blocked.kind === 'archive' &&
    comparison.blocked.failure.reason === 'storage-unavailable'
  );
}

/**
 * Which diff controls can be used. The choosers need a ready, non-empty list, a Line_Set for the Current_Pattern
 * and a reachable Archive (R6.16, R7.1, R7.2, R7.6); the compare control also needs both choices and no comparison
 * running.
 */
export function diffControlState(input: {
  summaries: Summaries;
  comparison: Comparison;
  currentAvailable: boolean;
  first: SideChoice | null;
  second: SideChoice | null;
}): { choosable: boolean; compareDisabled: boolean } {
  const { summaries, comparison, currentAvailable, first, second } = input;
  const choosable =
    summaries.status === 'ready' &&
    summaries.list.length > 0 &&
    currentAvailable &&
    !archiveUnreachable(summaries, comparison);
  return { choosable, compareDisabled: !choosable || first === null || second === null || comparison.status === 'loading' };
}

// ---------------------------------------------------------------------------------------------------------------
// Pure helpers behind the markup.
// ---------------------------------------------------------------------------------------------------------------

/** The `value` of the `<option>` for a choice; an empty string is "no choice yet". */
export function choiceValue(choice: SideChoice | null): string {
  if (choice === null) return '';
  return choice.kind === 'current' ? 'current' : `saved:${choice.id}`;
}

/** The choice an `<option>` value stands for, or null for the empty value and any value that is none of them. */
export function parseChoice(value: string): SideChoice | null {
  if (value === 'current') return { kind: 'current' };
  return value.startsWith('saved:') && value.length > 'saved:'.length
    ? { kind: 'saved', id: value.slice('saved:'.length) }
    : null;
}

/**
 * The character index of end `end` in a Bit_Line grouped by `groupBits`: the Group_Separators before it push it right by one
 * for each whole group of `hookColumns` ends before it, so end `e` sits at character `e + floor(e / hookColumns)`.
 * A `hookColumns` that is no positive whole number leaves the Bit_Line ungrouped, as `groupBits` does.
 */
export function endTextIndex(end: number, hookColumns: number): number {
  return Number.isInteger(hookColumns) && hookColumns >= 1 ? end + Math.floor(end / hookColumns) : end;
}

/**
 * The marker line of a `changed` entry: as wide as the grouped Bit_Line, with CHANGED_MARK under each Changed_Hole
 * and a space everywhere else, Group_Separator characters included, so it lines up with `groupBits(bits, hookColumns)`
 * in a fixed-width font (R6.7). An end that is not a position of the Bit_Line is ignored.
 */
export function markerLine(bits: BitLine, changedHoles: ReadonlyArray<number>, hookColumns: number): string {
  if (bits.length === 0) return '';
  const characters = Array.from({ length: endTextIndex(bits.length - 1, hookColumns) + 1 }, () => ' ');
  for (const end of changedHoles) {
    if (Number.isInteger(end) && end >= 0 && end < bits.length) characters[endTextIndex(end, hookColumns)] = CHANGED_MARK;
  }
  return characters.join('');
}

/** The Line an entry shows: the second Line_Set's for `added` and `changed`, the first's for the others (R6.14). */
export function shownLine(entry: DiffEntry): Line {
  return entry.kind === 'added' || entry.kind === 'changed' ? entry.second : entry.first;
}

/** The pick index of both sides, each padded to `width` and written as NO_PICK where the entry has none. */
export function pickField(entry: DiffEntry, width: number): string {
  const side = (line: Line | undefined): string => (line === undefined ? NO_PICK : String(line.pick)).padStart(width, ' ');
  const first = entry.kind === 'added' ? undefined : entry.first;
  const second = entry.kind === 'removed' ? undefined : entry.second;
  return `${side(first)}${PICK_SEPARATOR}${side(second)}`;
}

// ---------------------------------------------------------------------------------------------------------------
// Markup.
// ---------------------------------------------------------------------------------------------------------------

type EntryItemProps = { entry: DiffEntry; hookColumns: number; pickWidth: number; t: Translate };

/**
 * One Diff_Entry: its marker character, its kind word as visible text, its pick numbers and its Bit_Line; a
 * `changed` entry has a `^` line directly beneath the Bit_Line inside the same block, so the two move together (R6.7,
 * R11.7). The Bit_Line is not a tab stop of its own: the one entries region around every entry is, and it scrolls
 * sideways and up and down with the arrow keys, so a long Diff has one tab stop and not one for each entry (R11.1).
 * The name read by a screen reader comes from `diffEntryAccessibleName` (R11.5). Memoised: up to
 * Diff_Pick_Limit entries are rendered, and a change of choice must not draw them again.
 */
function EntryItemView({ entry, hookColumns, pickWidth, t }: EntryItemProps) {
  const line = shownLine(entry);
  const bitsText = line.kind === 'bits' ? groupBits(line.bits, hookColumns) : '';
  const carets = entry.kind === 'changed' ? markerLine(entry.second.bits, entry.changedHoles, hookColumns) : null;

  return (
    <li className={styles.entry} role="group" aria-label={diffEntryAccessibleName(t, entry)} data-kind={entry.kind}>
      <span className={styles.marker} aria-hidden="true">
        {DIFF_MARKERS[entry.kind]}
      </span>
      <span className={styles.kind}>{t(`codeview.diff.kind.${entry.kind}`)}</span>
      <span className={styles.picks} aria-hidden="true">
        {pickField(entry, pickWidth)}
      </span>
      {line.kind === 'damaged' ? (
        <p className={styles.damaged}>{t('codeview.line.damagedLabel')}</p>
      ) : (
        <div className={styles.bits} role="group" aria-label={t('codeview.bitline.name', { pick: line.pick })}>
          <span className={styles.bitsText}>{bitsText}</span>
          {carets === null ? null : (
            <span className={styles.bitsText} aria-hidden="true" data-marker-line="true">
              {carets}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

const EntryItem = memo(EntryItemView);

type EntriesProps = { entries: ReadonlyArray<DiffEntry>; hookColumns: number; pickWidth: number; t: Translate };

/**
 * Every entry, in one labelled, keyboard-focusable region that scrolls in both directions and is the only tab stop
 * among the entries (R11.1). A Diff holds up to Diff_Pick_Limit entries, and
 * no translated "showing the first N" text exists to cap the list with, so all of them are in the document and each
 * has `content-visibility: auto`, which leaves the browser to skip the layout and paint of those out of view.
 */
const DiffEntries = memo(function DiffEntries({ entries, hookColumns, pickWidth, t }: EntriesProps) {
  if (entries.length === 0) return null;
  return (
    <div role="region" tabIndex={0} aria-label={t('codeview.diff.entries.name')} className={styles.entries}>
      <ol className={styles.entryList} role="list">
        {entries.map((entry, index) => (
          <EntryItem key={index} entry={entry} hookColumns={hookColumns} pickWidth={pickWidth} t={t} />
        ))}
      </ol>
    </div>
  );
});

/** The three Diff_Counts as numerals, each inside its translated sentence (R6.3). */
function Counts({ diff, t }: { diff: Extract<Diff, { ok: true }>; t: Translate }) {
  return (
    <ul className={styles.counts} role="list">
      <li>{t('codeview.diff.counts.changedHoles', { count: diff.counts.changedHoles })}</li>
      <li>{t('codeview.diff.counts.addedCards', { count: diff.counts.addedCards })}</li>
      <li>{t('codeview.diff.counts.removedCards', { count: diff.counts.removedCards })}</li>
    </ul>
  );
}

/**
 * The plain-language message of one refusal reason: it names the values the refusal carries and says what to do
 * next. Each reason has its own text in the Translation_File (R6.12).
 */
export function refusalMessage(refusal: DiffRefusal, t: Translate): string {
  switch (refusal.reason) {
    case 'dimension-mismatch':
      return t('codeview.refusal.dimension-mismatch', {
        firstHookRows: refusal.first.hookRows,
        firstHookColumns: refusal.first.hookColumns,
        secondHookRows: refusal.second.hookRows,
        secondHookColumns: refusal.second.hookColumns,
      });
    case 'profile-mismatch':
      return t('codeview.refusal.profile-mismatch', {
        firstProfileName: refusal.firstProfileName,
        secondProfileName: refusal.secondProfileName,
      });
    case 'too-many-picks':
      return t('codeview.refusal.too-many-picks', {
        limit: refusal.limit,
        firstPicks: refusal.firstPicks,
        secondPicks: refusal.secondPicks,
      });
    default: {
      const unreachable: never = refusal;
      return unreachable;
    }
  }
}

/** The result of a Diff that was refused: its own message, and nothing else (R6.12, R6.13). */
function RefusedDiff({ refusal, t }: { refusal: DiffRefusal; t: Translate }) {
  return (
    <Notice variant="error" word={t('notice.error')}>
      {refusalMessage(refusal, t)}
    </Notice>
  );
}

/** True when the Diff has only `unchanged` entries, so its three Diff_Counts are zero: the two designs are the same (R7.5). */
export function isSameDesign(diff: Diff): boolean {
  return diff.ok && diff.entries.every((entry) => entry.kind === 'unchanged');
}

/** What the last press of Copy or Download came to, and the Diff_Text it was about. */
type TextStatus = { text: string; status: DiffTextStatus };

/**
 * The Diff_Text, shown as text the user can select and copy, with a Copy and a Download control (R6.8). Both hand over
 * the one string `diffToText` made; the UI builds no text. A status from an earlier Diff_Text is not shown for a new
 * one. The text stays selectable when Copy fails, so a failed copy is never a dead end. The heading, labels and
 * messages are translated; the Diff_Text is the module's and is the same in both languages (R10.7).
 */
export function DiffTextBlock({ diff, t, deps }: { diff: Diff; t: Translate; deps?: DiffTextDeps }) {
  const headingId = useId();
  const text = diffToText(diff);
  const [last, setLast] = useState<TextStatus>({ text, status: 'none' });
  const status = last.text === text ? last.status : 'none';
  const statusKey = diffTextStatusKey(status);

  const onCopy = (): void => {
    void copyDiffText(deps ?? browserDiffTextDeps(), text).then((outcome) => {
      setLast({ text, status: outcome.ok ? 'copied' : 'copyFailed' });
    });
  };
  const onDownload = (): void => {
    const outcome = downloadDiffText(deps ?? browserDiffTextDeps(), text);
    setLast({ text, status: outcome.ok ? 'downloaded' : 'downloadFailed' });
  };

  return (
    <section aria-labelledby={headingId} className={styles.textBlock} data-diff-text="true">
      <h4 id={headingId} className={styles.textTitle}>
        {t('codeview.diff.text.heading')}
      </h4>
      <textarea
        className={styles.textArea}
        readOnly
        wrap="off"
        spellCheck={false}
        style={{ height: `calc(${diffTextLineCount(text)} * 1lh + var(--diff-text-frame))` }}
        aria-label={t('codeview.diff.text.name')}
        value={text}
      />
      <div className={styles.textActions}>
        <Button onClick={onCopy}>{t('codeview.diff.copy')}</Button>
        <Button onClick={onDownload}>{t('codeview.diff.download')}</Button>
      </div>
      <p role="status" className={styles.textStatus}>
        {statusKey === null ? '' : t(statusKey)}
      </p>
    </section>
  );
}

type DiffResultProps = {
  first: NamedLineSet;
  second: NamedLineSet;
  diff: Diff;
  t: Translate;
  diffTextDeps?: DiffTextDeps;
};

/** A Diff: its counts, its entries and its Diff_Text, or the refusal, which offers no Diff_Text (R6.13). */
function DiffResult({ first, second, diff, t, diffTextDeps }: DiffResultProps) {
  if (!diff.ok) return <RefusedDiff refusal={diff.refusal} t={t} />;
  const pickWidth = pickNumberWidth(Math.max(first.lineSet.lines.length, second.lineSet.lines.length));
  return (
    <div className={styles.result}>
      <Counts diff={diff} t={t} />
      <p className={styles.hint}>{t('codeview.diff.hint')}</p>
      {isSameDesign(diff) ? (
        <Notice variant="information" word={t('notice.information')} role="status">
          {t('codeview.diff.same')}
        </Notice>
      ) : null}
      <DiffEntries entries={diff.entries} hookColumns={diff.second.hookColumns} pickWidth={pickWidth} t={t} />
      <DiffTextBlock diff={diff} t={t} deps={diffTextDeps} />
    </div>
  );
}

/**
 * Shown when a design could not be fetched or read: the Archive failure's message, or the damaged design's name and
 * lowest failing pick index. It shows no entries, no counts and no Diff_Text (R7.2, R7.3, R7.4).
 */
function BlockedMessage({ blocked, t, onRetry }: { blocked: Blocked; t: Translate; onRetry: () => void }) {
  if (blocked.kind === 'archive') {
    return (
      <StateMessage
        variant="error"
        message={t(archiveFailureKey(blocked.failure))}
        t={t}
        // A design the Archive no longer holds is gone from the choices, so repeating the comparison cannot succeed.
        retry={blocked.failure.reason === 'not-found' ? undefined : { label: t('state.retry'), onRetry }}
      />
    );
  }
  return (
    <Notice variant="error" word={t('notice.error')}>
      {t('codeview.damaged.design', { name: blocked.designName, pick: blocked.pick })}
    </Notice>
  );
}

type ChoiceSelectProps = {
  label: string;
  value: SideChoice | null;
  list: ReadonlyArray<DesignSummary>;
  disabled: boolean;
  /** False while the Current_Pattern has no Line_Set, so it is no option. */
  currentAvailable: boolean;
  t: Translate;
  onChange: (choice: SideChoice | null) => void;
};

/** One chooser: a labelled `<select>` of the Current_Pattern and every Saved_Design the Archive returned (R6.6). */
function ChoiceSelect({ label, value, list, disabled, currentAvailable, t, onChange }: ChoiceSelectProps) {
  const untitled = t('keep.untitled');
  return (
    <Field label={label} className={styles.field}>
      <select
        value={choiceValue(value)}
        disabled={disabled}
        onChange={(event: ChangeEvent<HTMLSelectElement>) => onChange(parseChoice(event.currentTarget.value))}
      >
        <option value="">{t('codeview.diff.choose')}</option>
        {currentAvailable ? <option value="current">{t('codeview.diff.current')}</option> : null}
        {list.map((summary) => (
          <option key={summary.id} value={`saved:${summary.id}`}>
            {t('codeview.diff.option', { name: savedLabel(summary.metadata, untitled), count: summary.pickCount })}
          </option>
        ))}
      </select>
    </Field>
  );
}

export type DiffPanelViewProps = {
  summaries: Summaries;
  first: SideChoice | null;
  second: SideChoice | null;
  comparison: Comparison;
  /** True while there is a Card_Profile and a Line_Set for the Current_Pattern. */
  currentAvailable: boolean;
  t: Translate;
  onFirstChange: (choice: SideChoice | null) => void;
  onSecondChange: (choice: SideChoice | null) => void;
  onCompare: () => void;
  /** Lists the Saved_Designs again after an Archive failure; the retry of the failed list. */
  onRetrySummaries?: () => void;
  /** Injected so tests use fakes for the clipboard and the download; the browser's are the default. */
  diffTextDeps?: DiffTextDeps;
};

/** What the panel draws. No state of its own, so tests can render every case. */
export function DiffPanelView(props: DiffPanelViewProps) {
  const { summaries, first, second, comparison, currentAvailable, t } = props;
  const headingId = useId();
  const list = summaries.status === 'ready' ? summaries.list : [];
  // No Saved_Design, no Current_Pattern with picks, no Card_Profile or no Archive: the choosers and the compare
  // control are present and disabled (R6.16, R7.1, R7.2, R7.6).
  const { choosable, compareDisabled } = diffControlState({ summaries, comparison, currentAvailable, first, second });
  const comparing = comparison.status === 'loading';

  return (
    <Panel as="section" aria-labelledby={headingId} className={styles.panel}>
      <h3 id={headingId} className={styles.title}>
        {t('codeview.diff.heading')}
      </h3>

      <div className={styles.choosers}>
        <ChoiceSelect
          label={t('codeview.diff.first.label')}
          value={first}
          list={list}
          disabled={!choosable}
          currentAvailable={currentAvailable}
          t={t}
          onChange={props.onFirstChange}
        />
        <ChoiceSelect
          label={t('codeview.diff.second.label')}
          value={second}
          list={list}
          disabled={!choosable}
          currentAvailable={currentAvailable}
          t={t}
          onChange={props.onSecondChange}
        />
        <Button variant="primary" disabled={compareDisabled} onClick={props.onCompare}>
          {comparing ? t('codeview.diff.comparing') : t('codeview.diff.compare')}
        </Button>
      </div>

      {summaries.status === 'loading' ? (
        <Notice variant="information" word={t('notice.information')}>
          {t('codeview.diff.loading')}
        </Notice>
      ) : null}
      {summaries.status === 'ready' && list.length === 0 ? (
        <Notice variant="information" word={t('notice.information')}>
          {t('codeview.diff.noSaved')}
        </Notice>
      ) : null}
      {summaries.status === 'failed' ? (
        <StateMessage
          variant="error"
          message={t(archiveFailureKey(summaries.failure))}
          t={t}
          retry={props.onRetrySummaries === undefined ? undefined : { label: t('state.retry'), onRetry: props.onRetrySummaries }}
        />
      ) : null}

      {comparison.status === 'blocked' ? <BlockedMessage blocked={comparison.blocked} t={t} onRetry={props.onCompare} /> : null}
      {comparison.status === 'ready' ? (
        <DiffResult
          first={comparison.first}
          second={comparison.second}
          diff={comparison.diff}
          t={t}
          diffTextDeps={props.diffTextDeps}
        />
      ) : null}
    </Panel>
  );
}

export type DiffPanelProps = {
  /** The Card_Profile in use, or null while none is ready. */
  profile: CardProfile | null;
  /** The Current_Pattern's Line_Set, from the screen's one `patternToLines` call; null when there is none. */
  currentLineSet: LineSet | null;
  t: Translate;
  /** Injected so tests use a fake store, as the Keep screen already does. */
  archiveDeps?: ArchiveDeps;
  /** Injected so tests use fakes for the clipboard and the download, as `archiveDeps` is for the Archive. */
  diffTextDeps?: DiffTextDeps;
  /** Two sides Keep asked to see. Each request is chosen and compared once, with the same `runComparison`. */
  request?: CompareRequest | null;
};

/** The diff panel: two choosers, a compare control, and the counts and entries of one comparison (R6.6, R6.7, R6.16). */
export function DiffPanel({ profile, currentLineSet, t, archiveDeps, diffTextDeps, request = null }: DiffPanelProps) {
  const [summaries, setSummaries] = useState<Summaries>({ status: 'loading' });
  const [first, setFirst] = useState<SideChoice | null>(null);
  const [second, setSecond] = useState<SideChoice | null>(null);
  const [comparison, setComparison] = useState<Comparison>(IDLE);
  // Only the latest compare may set the result: an older one that finishes late is dropped.
  const latestRequest = useRef(0);

  // Each press of the retry after a failed listing asks for the list again.
  const [listAttempt, setListAttempt] = useState(0);

  // The Archive is listed once, when the panel mounts, and again for each retry.
  useEffect(() => {
    let current = true;
    void loadSummaries(archiveDeps).then((next) => {
      if (current) setSummaries(next);
    });
    return () => {
      current = false;
    };
  }, [archiveDeps, listAttempt]);

  // A result that compared against the Current_Pattern is out of date once the Current_Pattern is another design.
  useEffect(() => {
    latestRequest.current += 1;
    setComparison((previous) => (previous.status === 'idle' ? previous : IDLE));
  }, [currentLineSet]);

  const currentName = t('codeview.diff.current');
  const current = useMemo<NamedLineSet | null>(
    () => (currentLineSet === null ? null : { name: currentName, lineSet: currentLineSet }),
    [currentLineSet, currentName],
  );
  const untitled = t('keep.untitled');

  const startComparison = (firstSide: SideChoice, secondSide: SideChoice): void => {
    if (profile === null) return;
    latestRequest.current += 1;
    const requestNumber = latestRequest.current;
    setComparison({ status: 'loading' });
    void runComparison({ first: firstSide, second: secondSide, profile, current, untitled }, archiveDeps).then((run) => {
      // After a `not-found` the list is fetched again, so the user sees the Saved_Designs that exist now (R7.4).
      const fresh = run.summaries;
      if (fresh !== null) {
        setSummaries(fresh);
        setFirst((choice) => keepIfListed(choice, fresh));
        setSecond((choice) => keepIfListed(choice, fresh));
      }
      if (latestRequest.current === requestNumber) setComparison(run.comparison);
    });
  };
  const onCompare = (): void => {
    if (first === null || second === null) return;
    startComparison(first, second);
  };
  const onRetrySummaries = (): void => {
    setSummaries({ status: 'loading' });
    setListAttempt((attempt) => attempt + 1);
  };
  // A request from Keep chooses both sides and compares them once, as if the weaver had pressed Compare.
  const handledRequest = useRef<CompareRequest | null>(null);
  useEffect(() => {
    if (request === null || handledRequest.current === request || profile === null) return;
    const needsCurrent = request.first.kind === 'current' || request.second.kind === 'current';
    if (needsCurrent && current === null) return;
    handledRequest.current = request;
    setFirst(request.first);
    setSecond(request.second);
    startComparison(request.first, request.second);
    // startComparison is rebuilt on every render; the request, profile and current pattern are what matter.
  }, [request, profile, current]);

  return (
    <DiffPanelView
      summaries={summaries}
      first={first}
      second={second}
      comparison={comparison}
      currentAvailable={profile !== null && currentLineSet !== null}
      t={t}
      onFirstChange={setFirst}
      onSecondChange={setSecond}
      onCompare={onCompare}
      onRetrySummaries={onRetrySummaries}
      diffTextDeps={diffTextDeps}
    />
  );
}
