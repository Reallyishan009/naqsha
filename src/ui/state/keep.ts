import type { ArchiveFailure, DesignSummary, Metadata } from '../../archive/index.ts';
import type { Pattern } from '../../codec/index.ts';
import { DEFAULT_EXPORT_OPTIONS, bmpFileName, downloadBmp, exportPatternBmp, parseExportOptions } from '../../exporter/index.ts';
import type { DownloadDeps, ExportFailure, ExportOptions } from '../../exporter/index.ts';
import { archiveFailureKey } from '../i18n/messages.ts';
import type { AppAction } from '../types.ts';

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

export type KeepForm = { metadata: Metadata; options: ExportOptions };

export const EMPTY_METADATA: Metadata = { name: '', naqshband: '', weaver: '', place: '', date: '', notes: '' };

export const initialKeepForm: KeepForm = { metadata: EMPTY_METADATA, options: DEFAULT_EXPORT_OPTIONS };

export type KeepFormAction =
  | { type: 'set-field'; field: keyof Metadata; value: string }
  | { type: 'set-option'; options: ExportOptions };

export function keepFormReducer(form: KeepForm, action: KeepFormAction): KeepForm {
  switch (action.type) {
    case 'set-field':
      return { ...form, metadata: { ...form.metadata, [action.field]: action.value } };
    case 'set-option':
      return { ...form, options: action.options };
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

/** A failed save keeps the form as it is and asks for an error announcement (R7.4). */
export function afterSaveFailure(
  form: KeepForm,
  failure: ArchiveFailure,
): { form: KeepForm; announce: Extract<AppAction, { type: 'announce' }> } {
  return { form, announce: { type: 'announce', kind: 'error', messageKey: archiveFailureKey(failure) } };
}
