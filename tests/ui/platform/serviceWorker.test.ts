import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  INITIAL_SERVICE_WORKER_STATE,
  registerServiceWorker,
  serviceWorkerUrl,
  shouldRegister,
  SKIP_WAITING_MESSAGE,
  stepServiceWorker,
} from '../../../src/ui/platform/serviceWorker.ts';
import type { ContainerLike, ServiceWorkerEvent, ServiceWorkerState } from '../../../src/ui/platform/serviceWorker.ts';
import {
  fakeEvent,
  fakeResponse,
  FakeServiceWorkerContainer,
  FakeWorker,
  flush,
  loadServiceWorker,
} from '../../support/serviceWorkerFakes.ts';
import type { RequestLike, ResponseLike } from '../../support/serviceWorkerFakes.ts';

const CURRENT_CACHE = 'naqsha-v1-current';

/** Relative entries of the kind `scripts/build_precache.ts` writes: hashed assets, the profile, icons, the page. */
const entryArbitrary = fc
  .tuple(
    fc.constantFrom('', 'assets', 'icons', 'profiles'),
    fc.stringMatching(/^[a-zA-Z0-9_-]{1,10}$/),
    fc.constantFrom('.js', '.css', '.json', '.png', '.html', '.svg', '.webmanifest'),
  )
  .map(([folder, name, extension]) => (folder === '' ? `./${name}${extension}` : `./${folder}/${name}${extension}`));

/** A precache list: the start page and a set of built files, as `precacheEntries` produces it. */
const precacheListArbitrary = fc
  .uniqueArray(entryArbitrary, { minLength: 1, maxLength: 12 })
  .map((entries) => ['./', ...entries]);

/** Scopes a static host can serve the site from: the root, a sub-path, a deeper sub-path. */
const scopeArbitrary = fc.constantFrom('https://example.test/', 'https://example.test/app/', 'https://host.example/naqsha/cards/');

/** Names of other caches, short enough that none can equal CURRENT_CACHE. */
const otherCacheNameArbitrary = fc.stringMatching(/^[a-z0-9-]{1,10}$/);

const urlArbitrary = fc.tuple(scopeArbitrary, entryArbitrary).map(([scope, entry]) => new URL(entry, scope).href);

const getRequest = (url: string): RequestLike => ({ url, method: 'GET' });

describe('service worker: precache and serving', () => {
  it('R24.2 install requests every precache entry exactly once and puts each in the cache of this version', async () => {
    // Feature: app, Property 40: Install requests every precache entry once and caches it
    await fc.assert(
      fc.asyncProperty(precacheListArbitrary, scopeArbitrary, async (entries, scope) => {
        const harness = loadServiceWorker({ scope });
        const context = { ...harness.logic.workerContext(), cacheName: CURRENT_CACHE, entries };
        const stored = await harness.logic.precacheAll(context);
        const expected = entries.map((entry) => new URL(entry, scope).href);
        expect(stored).toEqual(expected);
        expect(harness.network.calls).toBe(expected.length);
        for (const url of expected) expect(harness.network.count(url)).toBe(1);
        const cache = harness.caches.peek(CURRENT_CACHE);
        expect(cache).toBeDefined();
        expect([...(cache?.entries.keys() ?? [])].sort()).toEqual([...expected].sort());
        expect(harness.caches.names()).toEqual([CURRENT_CACHE]);
      }),
      { numRuns: 200, seed: 2401 },
    );
  });

  it('R24.3 activate deletes exactly the caches that are not the current version and keeps the current one', async () => {
    // Feature: app, Property 41: Activate deletes every cache but the current version
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(otherCacheNameArbitrary, { maxLength: 8 }),
        fc.boolean(),
        fc.nat({ max: 8 }),
        async (others, includeCurrent, at) => {
          const existing = includeCurrent ? [...others.slice(0, at), CURRENT_CACHE, ...others.slice(at)] : others;
          const harness = loadServiceWorker({ existingCaches: existing });
          const context = { ...harness.logic.workerContext(), cacheName: CURRENT_CACHE };
          const deleted = await harness.logic.deleteOldCaches(context);
          expect([...deleted].sort()).toEqual([...others].sort());
          expect(harness.caches.names()).toEqual(includeCurrent ? [CURRENT_CACHE] : []);
        },
      ),
      { numRuns: 200, seed: 2402 },
    );
  });

  it('R24.4 a request in the cache is served without the network, and one that is not goes to the network once', async () => {
    // Feature: app, Property 42: Cache first, network once for anything not cached
    await fc.assert(
      fc.asyncProperty(fc.uniqueArray(urlArbitrary, { minLength: 1, maxLength: 8 }), fc.nat({ max: 7 }), fc.boolean(), async (urls, pick, cached) => {
        const wanted = urls[pick % urls.length]!;
        const harness = loadServiceWorker({ bodies: urls.map((url) => [url, fakeResponse(`network ${url}`)] as const) });
        const context = { ...harness.logic.workerContext(), cacheName: CURRENT_CACHE };
        const cache = await harness.caches.open(CURRENT_CACHE);
        for (const url of urls) if (cached || url !== wanted) cache.preload(url, fakeResponse(`cached ${url}`));
        const response = await harness.logic.respond(context, getRequest(wanted));
        if (cached) {
          expect(response.body).toBe(`cached ${wanted}`);
          expect(harness.network.calls).toBe(0);
        } else {
          expect(response.body).toBe(`network ${wanted}`);
          expect(harness.network.count(wanted)).toBe(1);
          expect(harness.network.calls).toBe(1);
        }
      }),
      { numRuns: 200, seed: 2403 },
    );
  });

  it('serves a page navigation from the cached start page when the network fails', async () => {
    const scope = 'https://example.test/app/';
    const harness = loadServiceWorker({ scope });
    const context = { ...harness.logic.workerContext(), cacheName: CURRENT_CACHE };
    const cache = await harness.caches.open(CURRENT_CACHE);
    cache.preload(scope, fakeResponse('the start page'));
    const asked = `${scope}?from=a-loom-shop`;
    harness.network.offline.add(asked);
    const response = await harness.logic.respond(context, { url: asked, method: 'GET', mode: 'navigate' });
    expect(response.body).toBe('the start page');
    // Anything else still fails, so a failure is never hidden.
    harness.network.offline.add(`${scope}assets/x.js`);
    await expect(harness.logic.respond(context, getRequest(`${scope}assets/x.js`))).rejects.toThrow(/fake network failure/);
  });

  it('R24.4 a cached file is looked up by address alone, whatever the host said in Vary', async () => {
    // A static host may answer with `Vary: Origin` while the page asks for its scripts with `crossorigin`,
    // which sends an Origin the worker's own precache request did not. Keyed by address, the copy is found.
    const scope = 'https://example.test/app/';
    const harness = loadServiceWorker({ scope });
    const context = { ...harness.logic.workerContext(), cacheName: CURRENT_CACHE };
    const cache = await harness.caches.open(CURRENT_CACHE);
    cache.preload(`${scope}assets/index-abc.js`, fakeResponse('the entry chunk'));
    const response = await harness.logic.respond(context, getRequest(`${scope}assets/index-abc.js`));
    expect(response.body).toBe('the entry chunk');
    expect(harness.logic.MATCH_OPTIONS).toEqual({ ignoreVary: true });
    expect(cache.matchOptions).toEqual([{ ignoreVary: true }]);
  });

  it('install rejects when an entry cannot be fetched, so a half-filled cache is never installed', async () => {
    const scope = 'https://example.test/';
    const harness = loadServiceWorker({ scope, bodies: [[`${scope}missing.js`, fakeResponse('not found', false)]] });
    const context = { ...harness.logic.workerContext(), cacheName: CURRENT_CACHE, entries: ['./', './missing.js'] };
    await expect(harness.logic.precacheAll(context)).rejects.toThrow(/precache failed for/);
  });

  it('only GET requests are served from the cache', () => {
    const { logic } = loadServiceWorker();
    expect(logic.handlesRequest(getRequest('https://example.test/a.js'))).toBe(true);
    for (const method of ['POST', 'PUT', 'DELETE', 'HEAD']) {
      expect(logic.handlesRequest({ url: 'https://example.test/a.js', method })).toBe(false);
    }
  });

  it('R24.8 every entry is resolved against the worker scope, so no absolute path is assumed', () => {
    const { logic } = loadServiceWorker();
    expect(logic.scopedUrl('./', 'https://host.example/naqsha/')).toBe('https://host.example/naqsha/');
    expect(logic.scopedUrl('./assets/index-abc.js', 'https://host.example/naqsha/')).toBe('https://host.example/naqsha/assets/index-abc.js');
    expect(logic.PRECACHE.every((entry) => entry.startsWith('./'))).toBe(true);
  });
});

describe('service worker: the four listeners', () => {
  it('R24.2 R24.3 the install and activate listeners fill the new cache and drop the old ones', async () => {
    const harness = loadServiceWorker({ scope: 'https://example.test/app/', existingCaches: ['naqsha-v1-older', 'someone-else'] });
    const install = harness.listeners.get('install');
    const activate = harness.listeners.get('activate');
    expect(install).toBeDefined();
    expect(activate).toBeDefined();
    const started: Promise<unknown>[] = [];
    install?.(fakeEvent(started));
    await Promise.all(started);
    // The placeholder list of public/sw.js: the start page and index.html.
    expect(harness.network.calls).toBe(harness.logic.PRECACHE.length);
    expect(harness.caches.names()).toContain(harness.logic.CACHE_NAME);
    const activation: Promise<unknown>[] = [];
    activate?.(fakeEvent(activation));
    await Promise.all(activation);
    expect(harness.caches.names()).toEqual([harness.logic.CACHE_NAME]);
    expect(harness.claimCalls()).toBe(1);
  });

  it('R24.4 the fetch listener answers a GET from the cache and leaves other methods alone', async () => {
    const scope = 'https://example.test/app/';
    const harness = loadServiceWorker({ scope });
    const cache = await harness.caches.open(harness.logic.CACHE_NAME);
    cache.preload(`${scope}index.html`, fakeResponse('cached page'));
    const answered: Promise<unknown>[] = [];
    const listener = harness.listeners.get('fetch');
    listener?.({ ...fakeEvent(answered), request: getRequest(`${scope}index.html`) });
    expect(answered).toHaveLength(1);
    expect(((await answered[0]) as ResponseLike).body).toBe('cached page');
    listener?.({ ...fakeEvent(answered), request: { url: `${scope}index.html`, method: 'POST' } });
    expect(answered).toHaveLength(1);
  });

  it('R24.5 the worker takes over only when the page asks it to', () => {
    const harness = loadServiceWorker();
    const listener = harness.listeners.get('message');
    listener?.({ data: 'something else' });
    expect(harness.skipWaitingCalls()).toBe(0);
    listener?.({ data: harness.logic.SKIP_WAITING_MESSAGE });
    expect(harness.skipWaitingCalls()).toBe(1);
    // The page and the worker agree on the message text.
    expect(harness.logic.SKIP_WAITING_MESSAGE).toBe(SKIP_WAITING_MESSAGE);
  });
});

describe('service worker registration', () => {
  it('R24.1 the Built_Site registers and the dev server does not', () => {
    expect(shouldRegister({ builtSite: true, supported: true })).toBe(true);
    expect(shouldRegister({ builtSite: false, supported: true })).toBe(false);
    expect(shouldRegister({ builtSite: true, supported: false })).toBe(false);
    expect(shouldRegister({ builtSite: false, supported: false })).toBe(false);
  });

  it('R24.8 the worker address is relative to the page base', () => {
    expect(serviceWorkerUrl('./')).toBe('./sw.js');
    expect(serviceWorkerUrl('')).toBe('./sw.js');
    expect(serviceWorkerUrl('/naqsha/')).toBe('/naqsha/sw.js');
    expect(serviceWorkerUrl('/naqsha')).toBe('/naqsha/sw.js');
  });

  it('R24.1 nothing is registered when the production flag is false', async () => {
    const container = new FakeServiceWorkerContainer();
    let told = 0;
    let reloads = 0;
    const handle = registerServiceWorker({
      container: container as unknown as ContainerLike,
      env: { builtSite: false, supported: true },
      onUpdateReady: () => told++,
      reload: () => reloads++,
      baseUrl: './',
    });
    await flush();
    expect(container.registered).toEqual([]);
    expect(handle.state()).toEqual(INITIAL_SERVICE_WORKER_STATE);
    expect(told).toBe(0);
    expect(reloads).toBe(0);
  });

  it('R24.5 the update path from installing to waiting to in control tells the visitor once and reloads once', async () => {
    const container = new FakeServiceWorkerContainer();
    const told: string[] = [];
    let reloads = 0;
    const handle = registerServiceWorker({
      container: container as unknown as ContainerLike,
      env: { builtSite: true, supported: true },
      onUpdateReady: () => told.push('update ready'),
      reload: () => reloads++,
      baseUrl: './',
    });
    await flush();
    expect(container.registered).toEqual(['./sw.js']);
    expect(handle.state()).toEqual({ status: 'registered' });
    // The first worker of the visit takes control: nothing is said and nothing reloads.
    container.changeController();
    expect(told).toEqual([]);
    expect(reloads).toBe(0);

    const next = new FakeWorker();
    container.registration.startUpdate(next);
    next.setState('installing');
    expect(told).toEqual([]);
    container.registration.finishInstall(next);
    expect(told).toEqual(['update ready']);
    expect(handle.state()).toEqual({ status: 'update-ready' });
    // A second report of the same waiting worker does not say it twice.
    next.setState('installed');
    expect(told).toEqual(['update ready']);

    handle.loadUpdate();
    expect(next.messages).toEqual([SKIP_WAITING_MESSAGE]);
    expect(reloads).toBe(0);
    container.changeController();
    expect(reloads).toBe(1);
    // A later controller change does not reload again.
    container.changeController();
    expect(reloads).toBe(1);
  });

  it('R24.5 a worker already waiting at registration is reported at once', async () => {
    const container = new FakeServiceWorkerContainer();
    const waiting = new FakeWorker();
    waiting.state = 'installed';
    container.registration.waiting = waiting;
    const told: string[] = [];
    const handle = registerServiceWorker({
      container: container as unknown as ContainerLike,
      env: { builtSite: true, supported: true },
      onUpdateReady: () => told.push('ready'),
      reload: () => undefined,
      baseUrl: './',
    });
    await flush();
    expect(told).toEqual(['ready']);
    expect(handle.state()).toEqual({ status: 'update-ready' });
    handle.loadUpdate();
    expect(waiting.messages).toEqual([SKIP_WAITING_MESSAGE]);
  });

  it('a failed registration is reported and the app carries on', async () => {
    const container = new FakeServiceWorkerContainer();
    container.failWith = 'the worker script is not allowed here';
    const errors: string[] = [];
    const handle = registerServiceWorker({
      container: container as unknown as ContainerLike,
      env: { builtSite: true, supported: true },
      onUpdateReady: () => undefined,
      reload: () => undefined,
      baseUrl: './',
      onError: (message) => errors.push(message),
    });
    await flush();
    expect(errors).toEqual(['the worker script is not allowed here']);
    expect(handle.state()).toEqual(INITIAL_SERVICE_WORKER_STATE);
  });

  it('R24.5 the step function tells the visitor once per waiting worker and reloads only after a request', () => {
    const run = (events: ServiceWorkerEvent[]): { told: number; reloads: number; state: ServiceWorkerState } => {
      let state: ServiceWorkerState = INITIAL_SERVICE_WORKER_STATE;
      let told = 0;
      let reloads = 0;
      for (const event of events) {
        const step = stepServiceWorker(state, event);
        state = step.state;
        if (step.tellUser) told++;
        if (step.reload) reloads++;
      }
      return { told, reloads, state };
    };
    expect(run([{ type: 'registered', waiting: false }, { type: 'controller-changed' }])).toEqual({
      told: 0,
      reloads: 0,
      state: { status: 'registered' },
    });
    expect(run([{ type: 'registered', waiting: false }, { type: 'new-worker-waiting' }, { type: 'new-worker-waiting' }])).toEqual({
      told: 1,
      reloads: 0,
      state: { status: 'update-ready' },
    });
    expect(
      run([
        { type: 'registered', waiting: false },
        { type: 'new-worker-waiting' },
        { type: 'update-requested' },
        { type: 'controller-changed' },
      ]),
    ).toEqual({ told: 1, reloads: 1, state: { status: 'registered' } });
    // Asking for an update that is not ready does nothing.
    expect(run([{ type: 'registered', waiting: false }, { type: 'update-requested' }])).toEqual({
      told: 0,
      reloads: 0,
      state: { status: 'registered' },
    });
  });
});
