import type { DesignSummary } from '../../archive/index.ts';
import type { Translate } from '../i18n/messages.ts';
import type { Language } from '../types.ts';
import { formatSavedAt, savedLabel } from './keep.ts';

/** The longest note excerpt, in Unicode code points, before the ellipsis is added (R16.2). */
export const NOTE_EXCERPT_MAX = 40;

/**
 * The shortened note a Version_Label shows, or '' when the note is missing, empty or only whitespace (R16.2, R16.3).
 * The note is trimmed and each run of whitespace (line breaks included) becomes one space. Up to NOTE_EXCERPT_MAX code
 * points it is returned whole. Over that it is cut at the last space within the first NOTE_EXCERPT_MAX code points, or
 * at exactly NOTE_EXCERPT_MAX when there is no space, and one ellipsis is appended; the ellipsis is not counted.
 */
export function noteExcerpt(note: string | undefined, ellipsis: string): string {
  if (typeof note !== 'string') return '';
  const text = note.trim().replace(/\s+/gu, ' ');
  const codePoints = Array.from(text);
  if (codePoints.length <= NOTE_EXCERPT_MAX) return text;
  const head = codePoints.slice(0, NOTE_EXCERPT_MAX);
  const lastSpace = head.lastIndexOf(' ');
  const kept = lastSpace > 0 ? head.slice(0, lastSpace) : head;
  return `${kept.join('').trimEnd()}${ellipsis}`;
}

/**
 * The name and the number of picks of a version, as "name (n picks)", or "name (1 pick)" for a count of 1. The count
 * text is chosen by `t` from `count` alone (R17.6), so this function passes the number as it is.
 */
function nameAndPickCount(t: Translate, name: string, count: number): string {
  return t('codeview.diff.option', { name, count });
}

/** The saved date of a version, or '' when its saved time is missing or is not a valid date (R16.5). */
function savedAtOf(summary: DesignSummary, language: Language): string {
  const createdAt: unknown = summary.createdAt;
  return typeof createdAt === 'number' ? formatSavedAt(createdAt, language) : '';
}

function savedTimeOf(summary: DesignSummary): number {
  return Number.isFinite(summary.createdAt) ? summary.createdAt : Number.NEGATIVE_INFINITY;
}

/** Saved time first (earliest first), then archive id (R16.7). */
function bySavedTimeThenId(a: DesignSummary, b: DesignSummary): number {
  const timeA = savedTimeOf(a);
  const timeB = savedTimeOf(b);
  if (timeA !== timeB) return timeA < timeB ? -1 : 1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

/**
 * The text of each option of a Version_Chooser, by archive id (R16.1 to R16.7): the name and pick count, then the
 * separator and the saved date when there is one, then the separator and the note excerpt when there is one. Labels
 * that would be equal get " #k" appended, k counting from 1 in saved-time then id order, and this repeats until no
 * two labels are equal.
 */
export function versionLabels(
  summaries: ReadonlyArray<DesignSummary>,
  language: Language,
  t: Translate,
): ReadonlyMap<string, string> {
  const untitled = t('keep.untitled');
  const separator = t('codeview.diff.separator');
  const ellipsis = t('codeview.diff.ellipsis');

  const entries: Array<{ summary: DesignSummary; label: string }> = [];
  const seen = new Set<string>();
  for (const summary of summaries) {
    if (seen.has(summary.id)) continue;
    seen.add(summary.id);
    const parts = [nameAndPickCount(t, savedLabel(summary.metadata, untitled), summary.pickCount)];
    const savedAt = savedAtOf(summary, language);
    if (savedAt !== '') parts.push(savedAt);
    const excerpt = noteExcerpt(summary.note, ellipsis);
    if (excerpt !== '') parts.push(excerpt);
    entries.push({ summary, label: parts.join(separator) });
  }

  // Each round suffixes the labels that are still shared; the members of a group have different ids, so a group
  // splits in every round and the rounds end.
  for (let round = 0; round <= entries.length; round += 1) {
    const groups = new Map<string, Array<{ summary: DesignSummary; label: string }>>();
    for (const entry of entries) {
      const group = groups.get(entry.label);
      if (group === undefined) groups.set(entry.label, [entry]);
      else group.push(entry);
    }
    let changed = false;
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      changed = true;
      const ordered = [...group].sort((a, b) => bySavedTimeThenId(a.summary, b.summary));
      ordered.forEach((entry, index) => {
        entry.label = `${entry.label}${t('codeview.diff.duplicate', { k: index + 1 })}`;
      });
    }
    if (!changed) break;
  }

  return new Map(entries.map((entry) => [entry.summary.id, entry.label]));
}
