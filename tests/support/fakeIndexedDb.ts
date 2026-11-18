/**
 * A small in-memory IDBFactory, enough for src/archive/idbStore.ts: open with upgrade, object stores
 * with a key path and indexes, transactions over several stores, put/get/getAll/count/delete, and
 * abort. Values are structured-cloned on the way in and out. A transaction works on a copy of the
 * stores it touches and swaps the copy in on commit, so an abort leaves nothing behind.
 * Callbacks run on later macrotasks, as in a browser.
 */
type Row = Record<string, unknown>;
type StoreData = { keyPath: string; indexes: Set<string>; rows: Map<string, Row> };
type Handler = ((event: unknown) => void) | null;

export type FakeIdbOptions = {
  /** The open request fails with this error. */
  openError?: Error;
  /** A put or delete request on this store for this key fails, which aborts its transaction. */
  failWrite?: (storeName: string, key: string) => boolean;
};

export type FakeIdb = {
  factory: IDBFactory;
  /** Copies of the committed rows, by store name. */
  rows(storeName: string): Row[];
  storeNames(): string[];
  indexNames(storeName: string): string[];
  /** One entry per transaction: its mode, store names, and how it ended. */
  transactions: { mode: string; storeNames: string[]; outcome: 'pending' | 'complete' | 'abort' }[];
  opens: number;
  /** The version the open call asked for, per call. */
  requestedVersions: (number | undefined)[];
};

function later(task: () => void): void {
  setTimeout(task, 0);
}

function domError(name: string, message: string): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

class FakeRequest<T> {
  result: T | undefined = undefined;
  error: Error | null = null;
  onsuccess: Handler = null;
  onerror: Handler = null;
}

class FakeTransaction {
  oncomplete: Handler = null;
  onerror: Handler = null;
  onabort: Handler = null;
  error: Error | null = null;
  private readonly queue: (() => void)[] = [];
  private finished = false;
  private readonly work = new Map<string, StoreData>();
  private readonly db: FakeDatabase;
  private readonly names: string[];
  readonly mode: IDBTransactionMode;
  private readonly log: FakeIdb['transactions'][number];
  private readonly options: FakeIdbOptions;
  constructor(
    db: FakeDatabase,
    names: string[],
    mode: IDBTransactionMode,
    log: FakeIdb['transactions'][number],
    options: FakeIdbOptions,
  ) {
    this.db = db;
    this.names = names;
    this.mode = mode;
    this.log = log;
    this.options = options;
    for (const name of names) {
      const data = db.stores.get(name);
      if (data === undefined) throw domError('NotFoundError', `no object store ${name}`);
      this.work.set(name, { ...data, rows: new Map(data.rows) });
    }
    later(() => this.run());
  }

  objectStore(name: string): FakeObjectStore {
    if (!this.names.includes(name)) throw domError('NotFoundError', `store ${name} is not in this transaction`);
    return new FakeObjectStore(this, name);
  }

  data(name: string): StoreData {
    const data = this.work.get(name);
    if (data === undefined) throw domError('NotFoundError', `no object store ${name}`);
    return data;
  }

  enqueue<T>(
    run: (request: FakeRequest<T>) => void,
    failing: { storeName: string; key: string } | undefined,
  ): FakeRequest<T> {
    if (this.finished) throw domError('TransactionInactiveError', 'the transaction has finished');
    const request = new FakeRequest<T>();
    this.queue.push(() => {
      const fails = failing !== undefined && (this.options.failWrite?.(failing.storeName, failing.key) ?? false);
      if (fails) {
        request.error = domError('ConstraintError', `fake: write to ${failing.storeName} failed`);
        this.error = request.error;
        request.onerror?.({});
        this.onerror?.({});
        this.abort();
        return;
      }
      run(request);
      request.onsuccess?.({});
    });
    return request;
  }

  abort(): void {
    if (this.finished) return;
    this.finished = true;
    this.queue.length = 0;
    this.log.outcome = 'abort';
    later(() => this.onabort?.({}));
  }

  private run(): void {
    while (this.queue.length > 0 && !this.finished) this.queue.shift()?.();
    if (this.finished) return;
    this.finished = true;
    if (this.mode === 'readwrite') {
      for (const [name, data] of this.work) this.db.stores.set(name, data);
    }
    this.log.outcome = 'complete';
    this.oncomplete?.({});
  }
}

class FakeObjectStore {
  private readonly tx: FakeTransaction;
  private readonly name: string;
  constructor(tx: FakeTransaction, name: string) {
    this.tx = tx;
    this.name = name;
  }

  private requireWritable(): void {
    if (this.tx.mode === 'readonly') throw domError('ReadOnlyError', 'the transaction is read-only');
  }

  put(value: Row): FakeRequest<string> {
    this.requireWritable();
    const keyPath = this.tx.data(this.name).keyPath;
    const key = String(value[keyPath]);
    const stored = structuredClone(value);
    return this.tx.enqueue<string>(
      (request) => {
        this.tx.data(this.name).rows.set(key, stored);
        request.result = key;
      },
      { storeName: this.name, key },
    );
  }

  delete(key: string): FakeRequest<undefined> {
    this.requireWritable();
    return this.tx.enqueue<undefined>(
      () => {
        this.tx.data(this.name).rows.delete(key);
      },
      { storeName: this.name, key },
    );
  }

  get(key: string): FakeRequest<Row> {
    return this.tx.enqueue<Row>(
      (request) => {
        const row = this.tx.data(this.name).rows.get(key);
        request.result = row === undefined ? undefined : structuredClone(row);
      },
      undefined,
    );
  }

  getAll(): FakeRequest<Row[]> {
    return this.tx.enqueue<Row[]>(
      (request) => {
        const keys = [...this.tx.data(this.name).rows.keys()].sort();
        request.result = keys.map((key) => structuredClone(this.tx.data(this.name).rows.get(key)) as Row);
      },
      undefined,
    );
  }

  count(key: string): FakeRequest<number> {
    return this.tx.enqueue<number>(
      (request) => {
        request.result = this.tx.data(this.name).rows.has(key) ? 1 : 0;
      },
      undefined,
    );
  }
}

class FakeDatabase {
  readonly stores = new Map<string, StoreData>();
  version = 0;
  onversionchange: Handler = null;
  upgrading = false;
  private readonly log: FakeIdb['transactions'];
  private readonly options: FakeIdbOptions;
  constructor(log: FakeIdb['transactions'], options: FakeIdbOptions) {
    this.log = log;
    this.options = options;
  }

  get objectStoreNames(): { contains(name: string): boolean } {
    return { contains: (name) => this.stores.has(name) };
  }

  createObjectStore(name: string, parameters: { keyPath: string }): { createIndex(name: string): void } {
    if (!this.upgrading) throw domError('InvalidStateError', 'createObjectStore outside an upgrade');
    const data: StoreData = { keyPath: parameters.keyPath, indexes: new Set(), rows: new Map() };
    this.stores.set(name, data);
    return { createIndex: (indexName) => void data.indexes.add(indexName) };
  }

  transaction(names: string | string[], mode: IDBTransactionMode = 'readonly'): FakeTransaction {
    const list = typeof names === 'string' ? [names] : names;
    const entry: FakeIdb['transactions'][number] = { mode, storeNames: [...list], outcome: 'pending' };
    this.log.push(entry);
    return new FakeTransaction(this, list, mode, entry, this.options);
  }

  close(): void {}
}

export function createFakeIndexedDb(options: FakeIdbOptions = {}): FakeIdb {
  const databases = new Map<string, FakeDatabase>();
  const transactions: FakeIdb['transactions'] = [];
  const fake: FakeIdb = {
    factory: undefined as unknown as IDBFactory,
    rows: (storeName) =>
      [...(databases.get('naqsha-archive')?.stores.get(storeName)?.rows.values() ?? [])].map((row) =>
        structuredClone(row),
      ),
    storeNames: () => [...(databases.get('naqsha-archive')?.stores.keys() ?? [])],
    indexNames: (storeName) => [...(databases.get('naqsha-archive')?.stores.get(storeName)?.indexes ?? [])],
    transactions,
    opens: 0,
    requestedVersions: [],
  };
  const factory = {
    open(name: string, version?: number) {
      fake.opens += 1;
      fake.requestedVersions.push(version);
      const request = new FakeOpenRequest();
      later(() => {
        if (options.openError !== undefined) {
          request.error = options.openError;
          request.onerror?.({});
          return;
        }
        let db = databases.get(name);
        if (db === undefined) {
          db = new FakeDatabase(transactions, options);
          databases.set(name, db);
        }
        request.result = db;
        if (db.version < (version ?? 1)) {
          db.upgrading = true;
          request.onupgradeneeded?.({});
          db.upgrading = false;
          db.version = version ?? 1;
        }
        request.onsuccess?.({});
      });
      return request;
    },
  };
  fake.factory = factory as unknown as IDBFactory;
  return fake;
}

class FakeOpenRequest {
  result: FakeDatabase | undefined = undefined;
  error: Error | null = null;
  onsuccess: Handler = null;
  onerror: Handler = null;
  onupgradeneeded: Handler = null;
}
