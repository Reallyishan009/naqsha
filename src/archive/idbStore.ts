import { StoreUnavailableError } from './types.ts';
import type { ArchiveStore, DesignSummary, SavedDesign } from './types.ts';

export const DATABASE_NAME = 'naqsha-archive';
export const DATABASE_VERSION = 2;
const DESIGNS = 'designs';
const SUMMARIES = 'summaries';

function messageOf(error: unknown, fallback: string): string {
  return error instanceof Error && error.message !== '' ? error.message : fallback;
}

function openDatabase(factory: IDBFactory | undefined): Promise<IDBDatabase> {
  if (factory === undefined) {
    return Promise.reject(new StoreUnavailableError('indexedDB is not available'));
  }
  return new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(new StoreUnavailableError(messageOf(error, 'indexedDB.open threw')));
      return;
    }
    request.onupgradeneeded = (event) => {
      const database = request.result;
      const oldVersion = event.oldVersion;
      // Version 0 is a new database: both stores and their indexes.
      if (oldVersion < 1) {
        database.createObjectStore(DESIGNS, { keyPath: 'id' });
        const summaries = database.createObjectStore(SUMMARIES, { keyPath: 'id' });
        summaries.createIndex('createdAt', 'createdAt');
      }
      // Version 1 to 2 adds the designId index. No record is rewritten: a record with no designId is a
      // design with one version, so every saved design keeps working as it is.
      if (oldVersion < 2) {
        const summaries = request.transaction?.objectStore(SUMMARIES);
        summaries?.createIndex('designId', 'designId');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new StoreUnavailableError(messageOf(request.error, 'could not open the database')));
  });
}

/** Resolves when the transaction commits; rejects when it aborts or fails. */
function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error('transaction aborted'));
    transaction.onerror = () => reject(transaction.error ?? new Error('transaction failed'));
  });
}

function resultOf<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('request failed'));
  });
}

/**
 * The browser store. The database opens on first use, and an open that failed is tried again on the
 * next call. `factory` is a parameter so tests can run this code over a fake; it defaults to the
 * browser's `indexedDB`, which may be missing.
 */
export function openIndexedDbStore(
  factory: IDBFactory | undefined = typeof indexedDB === 'undefined' ? undefined : indexedDB,
): ArchiveStore {
  let opened: Promise<IDBDatabase> | undefined;
  function database(): Promise<IDBDatabase> {
    if (opened === undefined) {
      const attempt = openDatabase(factory).then(
        (db) => {
          db.onversionchange = () => {
            db.close();
            if (opened === attempt) opened = undefined;
          };
          return db;
        },
        (error: unknown) => {
          if (opened === attempt) opened = undefined;
          throw error;
        },
      );
      opened = attempt;
    }
    return opened;
  }
  return {
    async put(record: SavedDesign, summary: DesignSummary): Promise<void> {
      const db = await database();
      const transaction = db.transaction([DESIGNS, SUMMARIES], 'readwrite');
      const done = committed(transaction);
      transaction.objectStore(DESIGNS).put(record);
      transaction.objectStore(SUMMARIES).put(summary);
      await done;
    },
    async get(id: string): Promise<SavedDesign | undefined> {
      const db = await database();
      const request = db.transaction(DESIGNS, 'readonly').objectStore(DESIGNS).get(id);
      return (await resultOf(request)) as SavedDesign | undefined;
    },
    async listSummaries(): Promise<DesignSummary[]> {
      const db = await database();
      const request = db.transaction(SUMMARIES, 'readonly').objectStore(SUMMARIES).getAll();
      return (await resultOf(request)) as DesignSummary[];
    },
    async remove(id: string): Promise<boolean> {
      const db = await database();
      const transaction = db.transaction([DESIGNS, SUMMARIES], 'readwrite');
      const done = committed(transaction);
      const designs = transaction.objectStore(DESIGNS);
      const existed = resultOf(designs.count(id));
      designs.delete(id);
      transaction.objectStore(SUMMARIES).delete(id);
      const [count] = await Promise.all([existed, done]);
      return count > 0;
    },
  };
}
