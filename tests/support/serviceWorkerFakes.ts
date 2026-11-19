/**
 * Fakes for the service worker (R24.2 to R24.5): a Cache, a CacheStorage, a fetch that records every request,
 * and a loader that runs the real `public/sw.js` with those fakes in place of the worker's globals.
 *
 * `public/sw.js` is a classic worker script, so Node cannot import it. The loader evaluates its text with
 * `self` bound to the fake below, which is how the real file (not a copy of its logic) gets tested. Only the
 * four `addEventListener` calls at the end of the file are outside this reach; the listeners they register are
 * captured here and can be called with fake events.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

export const SERVICE_WORKER_FILE = path.resolve(import.meta.dirname, '../../public/sw.js');

export type RequestLike = { url: string; method: string; mode?: string };
export type ResponseLike = { ok: boolean; status: number; body: string };

/** A response that stands for a file of the built site. */
export const fakeResponse = (body: string, ok = true): ResponseLike => ({ ok, status: ok ? 200 : 404, body });

const keyOf = (request: RequestLike | string): string => (typeof request === 'string' ? request : request.url);

/** An in-memory Cache: put and match only, keyed by request URL, as the worker uses it. */
export class FakeCache {
  readonly entries = new Map<string, ResponseLike>();
  readonly puts: string[] = [];

  async put(request: RequestLike | string, response: ResponseLike): Promise<void> {
    this.puts.push(keyOf(request));
    this.entries.set(keyOf(request), response);
  }

  /** Keyed by address only, as a real Cache is when the worker passes `ignoreVary`. */
  async match(request: RequestLike | string, options?: { ignoreVary?: boolean }): Promise<ResponseLike | undefined> {
    this.matchOptions.push(options);
    return this.entries.get(keyOf(request));
  }

  readonly matchOptions: Array<{ ignoreVary?: boolean } | undefined> = [];

  /** Puts a response in without recording it as the worker's own put, for a cache that is already filled. */
  preload(url: string, response: ResponseLike): void {
    this.entries.set(url, response);
  }
}

/** An in-memory CacheStorage that records which caches were opened and deleted. */
export class FakeCacheStorage {
  private readonly caches = new Map<string, FakeCache>();
  readonly opened: string[] = [];
  readonly deleted: string[] = [];

  constructor(names: readonly string[] = []) {
    for (const name of names) this.caches.set(name, new FakeCache());
  }

  async open(name: string): Promise<FakeCache> {
    this.opened.push(name);
    const existing = this.caches.get(name);
    if (existing !== undefined) return existing;
    const cache = new FakeCache();
    this.caches.set(name, cache);
    return cache;
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }

  async delete(name: string): Promise<boolean> {
    this.deleted.push(name);
    return this.caches.delete(name);
  }

  /** The cache of that name without opening it (so `opened` stays the worker's own record). */
  peek(name: string): FakeCache | undefined {
    return this.caches.get(name);
  }

  names(): string[] {
    return [...this.caches.keys()];
  }
}

/** A fetch that answers from a table of bodies and records every request it was given. */
export class FakeFetch {
  readonly requests: RequestLike[] = [];
  private readonly bodies: Map<string, ResponseLike>;
  /** URLs that fail, as a network failure does when the device is offline. */
  readonly offline = new Set<string>();

  constructor(bodies: Iterable<readonly [string, ResponseLike]> = []) {
    this.bodies = new Map(bodies);
  }

  readonly fetch = async (request: RequestLike): Promise<ResponseLike> => {
    this.requests.push(request);
    if (this.offline.has(request.url)) throw new TypeError(`fake network failure for ${request.url}`);
    return this.bodies.get(request.url) ?? fakeResponse(`body of ${request.url}`);
  };

  /** How many times that URL was asked for. */
  count(url: string): number {
    return this.requests.filter((request) => request.url === url).length;
  }

  get calls(): number {
    return this.requests.length;
  }
}

/** What the worker logic needs from its globals. */
export type WorkerContext = {
  caches: FakeCacheStorage;
  fetch: (request: RequestLike) => Promise<ResponseLike>;
  cacheName: string;
  entries: readonly string[];
  scope: string;
};

export type FakeEvent = { waitUntil(promise: Promise<unknown>): void; respondWith(response: Promise<unknown>): void };

/** The logic `public/sw.js` puts on `self`. */
export type ServiceWorkerLogic = {
  CACHE_NAME: string;
  PRECACHE: string[];
  SKIP_WAITING_MESSAGE: string;
  scopedUrl(entry: string, scope: string): string;
  precacheRequest(url: string): RequestLike;
  precacheAll(context: WorkerContext): Promise<string[]>;
  deleteOldCaches(context: WorkerContext): Promise<string[]>;
  MATCH_OPTIONS: { ignoreVary?: boolean };
  handlesRequest(request: RequestLike): boolean;
  respond(context: WorkerContext, request: RequestLike): Promise<ResponseLike>;
  workerContext(): WorkerContext;
  onInstall(event: { waitUntil(promise: Promise<unknown>): void }): void;
  onActivate(event: { waitUntil(promise: Promise<unknown>): void }): void;
  onFetch(event: { request: RequestLike; respondWith(response: Promise<unknown>): void }): void;
  onMessage(event: { data: unknown }): void;
};

export type WorkerHarness = {
  logic: ServiceWorkerLogic;
  /** The listeners the file registered, by event type. */
  listeners: Map<string, (event: unknown) => void>;
  caches: FakeCacheStorage;
  network: FakeFetch;
  scope: string;
  /** How many times the worker asked to take over or to claim the open pages. */
  skipWaitingCalls: () => number;
  claimCalls: () => number;
  /** The promises handed to `waitUntil`, so a test can await the work a listener started. */
  waited: Promise<unknown>[];
  respondedWith: Promise<unknown>[];
};

export type HarnessOptions = {
  scope?: string;
  /** Cache names that already exist when the worker starts. */
  existingCaches?: readonly string[];
  bodies?: Iterable<readonly [string, ResponseLike]>;
};

/** Runs the real `public/sw.js` with fake globals and returns what it exposed. */
export function loadServiceWorker(options: HarnessOptions = {}): WorkerHarness {
  const scope = options.scope ?? 'https://example.test/app/';
  const caches = new FakeCacheStorage(options.existingCaches ?? []);
  const network = new FakeFetch(options.bodies ?? []);
  const listeners = new Map<string, (event: unknown) => void>();
  const waited: Promise<unknown>[] = [];
  const respondedWith: Promise<unknown>[] = [];
  let skipWaitingCalls = 0;
  let claimCalls = 0;
  const self = {
    caches,
    fetch: network.fetch,
    registration: { scope },
    clients: {
      claim: async (): Promise<void> => {
        claimCalls++;
      },
    },
    skipWaiting: (): void => {
      skipWaitingCalls++;
    },
    addEventListener: (type: string, listener: (event: unknown) => void): void => {
      listeners.set(type, listener);
    },
    naqshaServiceWorker: undefined as ServiceWorkerLogic | undefined,
  };
  const source = readFileSync(SERVICE_WORKER_FILE, 'utf8');
  // The worker is a classic script, so it is evaluated rather than imported; `self` is the fake above.
  const run = new Function('self', source) as (global: unknown) => void;
  run(self);
  const logic = self.naqshaServiceWorker;
  if (logic === undefined) throw new Error('public/sw.js did not put its logic on self.naqshaServiceWorker');
  return {
    logic,
    listeners,
    caches,
    network,
    scope,
    skipWaitingCalls: () => skipWaitingCalls,
    claimCalls: () => claimCalls,
    waited,
    respondedWith,
  };
}

/** An event whose waitUntil and respondWith promises are collected, so a test can await them. */
export function fakeEvent(collected: Promise<unknown>[]): FakeEvent {
  return {
    waitUntil(promise) {
      collected.push(promise);
    },
    respondWith(response) {
      collected.push(response);
    },
  };
}

// ---------------------------------------------------------------- the page's side

/** A worker as the page sees it: its state, the messages it was sent, and its state changes. */
export class FakeWorker {
  state = 'installing';
  readonly messages: string[] = [];
  private readonly listeners: Array<() => void> = [];

  postMessage(message: string): void {
    this.messages.push(message);
  }

  addEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.push(listener);
  }

  /** Moves the worker on and tells whoever is listening. */
  setState(state: string): void {
    this.state = state;
    for (const listener of [...this.listeners]) listener();
  }
}

/** A registration whose update can be driven step by step. */
export class FakeRegistration {
  installing: FakeWorker | null = null;
  waiting: FakeWorker | null = null;
  private readonly listeners: Array<() => void> = [];

  addEventListener(_type: 'updatefound', listener: () => void): void {
    this.listeners.push(listener);
  }

  /** A new worker is found and starts installing. */
  startUpdate(worker: FakeWorker): void {
    this.installing = worker;
    for (const listener of [...this.listeners]) listener();
  }

  /** The installing worker finishes and waits for the current one to go. */
  finishInstall(worker: FakeWorker): void {
    this.waiting = worker;
    worker.setState('installed');
  }
}

/** navigator.serviceWorker as the page uses it, recording every registration. */
export class FakeServiceWorkerContainer {
  readonly registered: string[] = [];
  readonly registration = new FakeRegistration();
  /** When set, register rejects with this message. */
  failWith: string | null = null;
  private readonly listeners: Array<() => void> = [];

  async register(url: string): Promise<FakeRegistration> {
    this.registered.push(url);
    if (this.failWith !== null) throw new Error(this.failWith);
    return this.registration;
  }

  addEventListener(_type: 'controllerchange', listener: () => void): void {
    this.listeners.push(listener);
  }

  /** A different worker takes control of the page. */
  changeController(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

/** Lets the promises that registration started settle. */
export const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) await Promise.resolve();
};
