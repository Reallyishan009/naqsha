import type { Pattern } from '../codec/index.ts';

export type Metadata = {
  name: string;
  naqshband: string;
  weaver: string;
  place: string;
  date: string;
  notes: string;
}; // every field may be an empty string

export type SavedDesign = {
  id: string;
  profileName: string;
  metadata: Metadata;
  /** Milliseconds since the epoch, from the injected clock. */
  createdAt: number;
  pattern: Pattern;
};

export type DesignSummary = {
  id: string;
  profileName: string;
  metadata: Metadata;
  createdAt: number;
  pickCount: number;
};

export type ArchiveFailure =
  | { reason: 'not-found'; id: string }
  | { reason: 'storage-unavailable'; detail: string }
  | { reason: 'write-failed'; detail: string };

export type ArchiveResult<T> = { ok: true; value: T } | { ok: false; failure: ArchiveFailure };

/** The one small seam over IndexedDB. A fake in tests, idbStore.ts in the browser. */
export type ArchiveStore = {
  /** Writes the record and its summary in one transaction: both or neither. */
  put(record: SavedDesign, summary: DesignSummary): Promise<void>;
  get(id: string): Promise<SavedDesign | undefined>;
  listSummaries(): Promise<DesignSummary[]>;
  /** Removes the record and its summary in one transaction. Returns false when the id was not stored. */
  remove(id: string): Promise<boolean>;
};

export type ArchiveDeps = { store: ArchiveStore; now: () => number; newId: () => string };

/**
 * A store method throws this when the database could not be opened. The archive reports it as
 * `storage-unavailable` whichever operation was running. Any other throw from `put` or `remove` is
 * `write-failed`; any other throw from `get` or `listSummaries` is `storage-unavailable`.
 */
export class StoreUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoreUnavailableError';
  }
}
