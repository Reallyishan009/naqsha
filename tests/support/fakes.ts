import { StoreUnavailableError } from '../../src/archive/index.ts';
import type { ArchiveStore, DesignSummary, SavedDesign } from '../../src/archive/index.ts';
import type { DownloadDeps } from '../../src/exporter/index.ts';
import type { Scheduler } from '../../src/simulator/index.ts';

/** A scheduler whose callbacks run only when the test calls run(timeMs). */
export class FakeScheduler implements Scheduler {
  private readonly queue = new Map<number, (timeMs: number) => void>();
  private nextId = 1;
  private requested = 0;

  request(cb: (timeMs: number) => void): number {
    const id = this.nextId++;
    this.requested++;
    this.queue.set(id, cb);
    return id;
  }

  cancel(id: number): void {
    this.queue.delete(id);
  }

  /** Runs the oldest pending callback at timeMs. Returns false when none is pending. */
  run(timeMs: number): boolean {
    const [first] = this.queue.entries();
    if (first === undefined) return false;
    this.queue.delete(first[0]);
    first[1](timeMs);
    return true;
  }

  pending(): number {
    return this.queue.size;
  }

  requests(): number {
    return this.requested;
  }
}

export type DownloadRecord = { fileName: string; type: string; bytes: Uint8Array };

/** Download dependencies that record what was offered. defer runs at once. */
export class FakeDownloadDeps implements DownloadDeps {
  readonly downloads: DownloadRecord[] = [];
  readonly revoked: string[] = [];
  private readonly blobs = new Map<string, { bytes: Uint8Array; type: string }>();
  private nextUrl = 1;

  makeBlob(bytes: Uint8Array, type: string): Blob {
    return { bytes, type } as unknown as Blob;
  }

  createObjectURL(blob: Blob): string {
    const url = `blob:fake/${this.nextUrl++}`;
    this.blobs.set(url, blob as unknown as { bytes: Uint8Array; type: string });
    return url;
  }

  revokeObjectURL(url: string): void {
    this.revoked.push(url);
  }

  createAnchor(): { href: string; download: string; click(): void } {
    const record = this.downloads;
    const blobs = this.blobs;
    return {
      href: '',
      download: '',
      click() {
        const blob = blobs.get(this.href);
        record.push({ fileName: this.download, type: blob?.type ?? '', bytes: blob?.bytes ?? new Uint8Array() });
      },
    };
  }

  defer(fn: () => void): void {
    fn();
  }

  /** Number of times a download was started. */
  get downloadCount(): number {
    return this.downloads.length;
  }
}

/** An in-memory stand-in for a Storage (localStorage) that records nothing else. */
export class FakeStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  get length(): number {
    return this.values.size;
  }
}

export type ArchiveFailurePoint = 'open' | 'put' | 'put-after-staging' | 'get' | 'list' | 'remove';

/**
 * An in-memory ArchiveStore. Values are structured-cloned on the way in and out, as IndexedDB does.
 * put stages the record and the summary and commits both together. Failures are injected per point:
 * 'open' makes every call throw StoreUnavailableError; 'put-after-staging' throws after staging, so
 * nothing may be committed.
 */
export class FakeArchiveStore implements ArchiveStore {
  private records = new Map<string, SavedDesign>();
  private summaries = new Map<string, DesignSummary>();
  private readonly failAt = new Set<ArchiveFailurePoint>();
  failOn(...points: ArchiveFailurePoint[]): void {
    for (const point of points) this.failAt.add(point);
  }
  clearFailures(): void {
    this.failAt.clear();
  }
  private open(): void {
    if (this.failAt.has('open')) throw new StoreUnavailableError('fake: open failed');
  }
  async put(record: SavedDesign, summary: DesignSummary): Promise<void> {
    this.open();
    if (this.failAt.has('put')) throw new Error('fake: put failed');
    const stagedRecord = structuredClone(record);
    const stagedSummary = structuredClone(summary);
    if (this.failAt.has('put-after-staging')) throw new Error('fake: put failed after staging');
    this.records.set(stagedRecord.id, stagedRecord);
    this.summaries.set(stagedSummary.id, stagedSummary);
  }
  async get(id: string): Promise<SavedDesign | undefined> {
    this.open();
    if (this.failAt.has('get')) throw new Error('fake: get failed');
    const record = this.records.get(id);
    return record === undefined ? undefined : structuredClone(record);
  }
  async listSummaries(): Promise<DesignSummary[]> {
    this.open();
    if (this.failAt.has('list')) throw new Error('fake: list failed');
    return [...this.summaries.values()].map((summary) => structuredClone(summary));
  }
  async remove(id: string): Promise<boolean> {
    this.open();
    if (this.failAt.has('remove')) throw new Error('fake: remove failed');
    const had = this.records.delete(id);
    this.summaries.delete(id);
    return had;
  }
  /** A deep copy of everything stored, for before and after comparisons. */
  snapshot(): { records: SavedDesign[]; summaries: DesignSummary[] } {
    return {
      records: [...this.records.values()].map((r) => structuredClone(r)),
      summaries: [...this.summaries.values()].map((s) => structuredClone(s)),
    };
  }
}
