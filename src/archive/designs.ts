import type { Pattern } from '../codec/index.ts';
import { openIndexedDbStore } from './idbStore.ts';
import { NOTE_MAX, StoreUnavailableError } from './types.ts';
import { designIdOf } from './versions.ts';
import type {
  ArchiveDeps,
  ArchiveFailure,
  ArchiveResult,
  DesignSummary,
  Metadata,
  SavedDesign,
} from './types.ts';

let defaultDeps: ArchiveDeps | undefined;
/** The browser deps, built on first use so importing this file never touches IndexedDB. */
function browserDeps(): ArchiveDeps {
  defaultDeps ??= { store: openIndexedDbStore(), now: Date.now, newId: () => crypto.randomUUID() };
  return defaultDeps;
}
function detailOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function failed<T>(failure: ArchiveFailure): ArchiveResult<T> {
  return { ok: false, failure };
}

/** Maps a throw to a failure: an open failure is always storage-unavailable, otherwise by operation. */
function failureOf(error: unknown, otherwise: 'storage-unavailable' | 'write-failed'): ArchiveFailure {
  const reason = error instanceof StoreUnavailableError ? 'storage-unavailable' : otherwise;
  return { reason, detail: detailOf(error) };
}

export type SaveInput = {
  pattern: Pattern;
  profileName: string;
  metadata: Metadata;
  /** The id of the version this save continues. Without it the save starts a new design. */
  continues?: string;
  /** A short note on the change; blank text is stored as no note. */
  note?: string;
};
/**
 * Saves one version. A save that continues a version stores that version's design id; a save that does not
 * starts a design and stores none, so its own id is the design id. A source version that is missing is
 * `not-found`, and a note over NOTE_MAX characters is `write-failed`; both leave the archive as it was.
 */
export async function saveDesign(input: SaveInput, deps: ArchiveDeps = browserDeps()): Promise<ArchiveResult<string>> {
  try {
    const note = input.note === undefined || input.note.trim() === '' ? undefined : input.note;
    if (note !== undefined && note.length > NOTE_MAX) {
      return failed({ reason: 'write-failed', detail: `note is longer than ${NOTE_MAX} characters` });
    }
    let designId: string | undefined;
    if (input.continues !== undefined) {
      const source = await deps.store.get(input.continues);
      if (source === undefined) return failed({ reason: 'not-found', id: input.continues });
      designId = designIdOf(source);
    }
    const id = deps.newId();
    const createdAt = deps.now();
    const lineage = {
      ...(designId === undefined ? {} : { designId }),
      ...(note === undefined ? {} : { note }),
    };
    const record: SavedDesign = {
      id,
      profileName: input.profileName,
      metadata: { ...input.metadata },
      createdAt,
      pattern: input.pattern,
      ...lineage,
    };
    const summary: DesignSummary = {
      id,
      profileName: input.profileName,
      metadata: { ...input.metadata },
      createdAt,
      pickCount: input.pattern.length,
      ...lineage,
    };
    await deps.store.put(record, summary);
    return { ok: true, value: id };
  } catch (error) {
    return failed(failureOf(error, 'write-failed'));
  }
}
export async function getDesign(id: string, deps: ArchiveDeps = browserDeps()): Promise<ArchiveResult<SavedDesign>> {
  try {
    const record = await deps.store.get(id);
    if (record === undefined) return failed({ reason: 'not-found', id });
    return { ok: true, value: record };
  } catch (error) {
    return failed(failureOf(error, 'storage-unavailable'));
  }
}

/** Newest first; equal creation times are ordered by id, so the order is stable. */
export async function listDesigns(deps: ArchiveDeps = browserDeps()): Promise<ArchiveResult<DesignSummary[]>> {
  try {
    const summaries = await deps.store.listSummaries();
    const sorted = [...summaries].sort((a, b) => {
      if (a.createdAt !== b.createdAt) return b.createdAt - a.createdAt;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
    return { ok: true, value: sorted };
  } catch (error) {
    return failed(failureOf(error, 'storage-unavailable'));
  }
}

export async function deleteDesign(id: string, deps: ArchiveDeps = browserDeps()): Promise<ArchiveResult<null>> {
  try {
    const removed = await deps.store.remove(id);
    if (!removed) return failed({ reason: 'not-found', id });
    return { ok: true, value: null };
  } catch (error) {
    return failed(failureOf(error, 'write-failed'));
  }
}
