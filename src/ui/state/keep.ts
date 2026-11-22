import { NOTE_MAX, previousVersion } from '../../archive/index.ts';
import type { ArchiveFailure, DesignGroup, DesignSummary, Metadata } from '../../archive/index.ts';
import type { Pattern } from '../../codec/index.ts';
import { DEFAULT_EXPORT_OPTIONS, bmpFileName, downloadBmp, exportPatternBmp, parseExportOptions } from '../../exporter/index.ts';
import type { DownloadDeps, ExportFailure, ExportOptions } from '../../exporter/index.ts';
import { archiveFailureKey } from '../i18n/messages.ts';
import type { Translate } from '../i18n/messages.ts';
import type { AppAction, Language, PatternOrigin } from '../types.ts';

/** Both Keep controls need a non-empty Current_Pattern and nothing else (R5.6, R7.2). */
export function canExport(pattern: Pattern): boolean {
  return pattern.length > 0;
}

export function canSave(pattern: Pattern): boolean {
  return pattern.length > 0;
}

/** The trimmed name, or the untitled text of the language when the name is empty (R7.3). */
export function savedLabel(metadata: Metadata, untitled: string): string {
  const name = metadata.name.trim();
  return name === '' ? untitled : name;
}

export type SummaryRow = {
  name: string;
  place: string;
  date: string;
  pickCount: number;
  /** The design's Card_Profile name, only when it differs from the profile in use (R22.12). */
  profileName: string | null;
};

export function summaryRow(summary: DesignSummary, currentProfileName: string, untitled: string): SummaryRow {
  return {
    name: savedLabel(summary.metadata, untitled),
    place: summary.metadata.place,
    date: summary.metadata.date,
    pickCount: summary.pickCount,
    profileName: summary.profileName === currentProfileName ? null : summary.profileName,
  };
}

/** What a design entry of the list shows for its newest version. */
export function designHeading(summary: DesignSummary, currentProfileName: string, untitled: string): SummaryRow {
  return summaryRow(summary, currentProfileName, untitled);
}
export type ExportOutcome = { ok: true } | { ok: false; failure: ExportFailure };

/** Builds the BMP and offers it as a download only when the export succeeded (R5.7, R5.8). */
export function runExport(profile: unknown, pattern: unknown, options: unknown, deps?: DownloadDeps): ExportOutcome {
  const result = exportPatternBmp(profile, pattern, options);
  if (!result.ok) return { ok: false, failure: result.failure };
  const parsed = parseExportOptions(options);
  const bitDepth = parsed.ok ? parsed.value.bitDepth : DEFAULT_EXPORT_OPTIONS.bitDepth;
  const name = (profile as { name: string }).name;
  downloadBmp(result.bytes, bmpFileName(name, bitDepth), deps);
  return { ok: true };
}

export type SaveMode = 'version' | 'design';
export type KeepForm = { metadata: Metadata; options: ExportOptions; note: string; saveMode: SaveMode };
export const EMPTY_METADATA: Metadata = { name: '', naqshband: '', weaver: '', place: '', date: '', notes: '' };
export const initialKeepForm: KeepForm = {
  metadata: EMPTY_METADATA,
  options: DEFAULT_EXPORT_OPTIONS,
  note: '',
  saveMode: 'version',
};
export type KeepFormAction =
  | { type: 'set-field'; field: keyof Metadata; value: string }
  | { type: 'set-option'; options: ExportOptions }
  | { type: 'set-note'; value: string }
  | { type: 'set-save-mode'; mode: SaveMode }
  /** Restore fills the form with the restored version's Metadata and clears the note. */
  | { type: 'set-metadata'; metadata: Metadata };
export function keepFormReducer(form: KeepForm, action: KeepFormAction): KeepForm {
  switch (action.type) {
    case 'set-field':
      return { ...form, metadata: { ...form.metadata, [action.field]: action.value } };
    case 'set-option':
      return { ...form, options: action.options };
    case 'set-note':
      return { ...form, note: action.value.slice(0, NOTE_MAX) };
    case 'set-save-mode':
      return { ...form, saveMode: action.mode };
    case 'set-metadata':
      return { ...form, metadata: { ...action.metadata }, note: '' };
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}
/** The save choice only exists for a design that came from the archive; anything else saves as a new design. */
export function effectiveSaveMode(form: KeepForm, origin: PatternOrigin): SaveMode {
  return origin.kind === 'archive' ? form.saveMode : 'design';
}
/** The id of the version a save continues, or undefined when the save starts a new design. */
export function continuesId(form: KeepForm, origin: PatternOrigin): string | undefined {
  return origin.kind === 'archive' && effectiveSaveMode(form, origin) === 'version' ? origin.id : undefined;
}
/** The date and time a version was saved, in the language in use. */
export function formatSavedAt(createdAt: number, language: Language): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
export type VersionDetails = { name: string; savedAt: string; note: string; pickCount: number };
export function versionDetails(summary: DesignSummary, language: Language, untitled: string): VersionDetails {
  return {
    name: savedLabel(summary.metadata, untitled),
    savedAt: formatSavedAt(summary.createdAt, language),
    note: summary.note ?? '',
    pickCount: summary.pickCount,
  };
}
export type CompareTargets = { previous: DesignSummary | null; openDesignId: string | null };
/**
 * What Compare offers for one version: the next older version of its design, and the open design. The open design
 * is offered only when the Current_Pattern came from the archive and is not this very version.
 */
export function compareTargets(group: DesignGroup, id: string, origin: PatternOrigin): CompareTargets {
  return {
    previous: previousVersion(group, id),
    openDesignId: origin.kind === 'archive' && origin.id !== id ? origin.id : null,
  };
}
/**
 * The form to save when some picks are accepted suggestions: the typed notes, then one line saying how many cards
 * are guesses and which picks (from 1). The line is added to the design's notes, never to the version note, so the
 * 200-character rule of the version note is not touched, and what the weaver typed is never replaced. A line that is
 * already there is not added twice. With no repaired pick the form comes back as it is.
 */
export function withGuessesLine(form: KeepForm, repairedPicks: ReadonlyArray<number>, t: Translate): KeepForm {
  const picks = [...new Set(repairedPicks)].sort((a, b) => a - b).map((pick) => pick + 1);
  if (picks.length === 0) return form;
  const line = t(picks.length === 1 ? 'keep.save.guessesNote.one' : 'keep.save.guessesNote.other', {
    count: picks.length,
    picks: picks.join(', '),
  });
  const typed = form.metadata.notes.trimEnd();
  if (typed.includes(line)) return form;
  const notes = typed === '' ? line : `${typed}\n${line}`;
  return { ...form, metadata: { ...form.metadata, notes } };
}
/** A failed save keeps the form as it is and asks for an error announcement (R7.4). */
export function afterSaveFailure(
  form: KeepForm,
  failure: ArchiveFailure,
): { form: KeepForm; announce: Extract<AppAction, { type: 'announce' }> } {
  return { form, announce: { type: 'announce', kind: 'error', messageKey: archiveFailureKey(failure) } };
}
