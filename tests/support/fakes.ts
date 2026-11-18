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
