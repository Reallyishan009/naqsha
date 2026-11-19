/**
 * Naqsha service worker: hand-written, plain classic worker script, no build step of its own and no dependency.
 *
 * What it does (R24.1 to R24.8):
 * - on install, fetches every precache entry once and puts it in the cache named by this version;
 * - on activate, deletes every cache whose name is not the current version, then claims the open pages;
 * - on fetch, serves a GET request from the cache when it is there and otherwise goes to the network once;
 * - on a 'naqsha:skip-waiting' message, takes over, so the page can load the new version when the visitor asks.
 *
 * The block between the two markers below is written by `scripts/build_precache.ts` after `vite build`: it reads
 * `dist/`, so the hashed file names are never typed by hand, and the cache name carries a hash of the files'
 * contents, so a new build is always a new cache and a new worker. The values in the repository are placeholders.
 *
 * Every entry is resolved against the worker's own scope, never from an absolute path, so the site works under
 * `base: './'` and from a sub-path on any static host.
 *
 * The logic is put on `self.naqshaServiceWorker` so tests can call it with a fake CacheStorage and a fake fetch.
 * Only the four `addEventListener` calls at the end are outside a test's reach.
 */
'use strict';

/* naqsha:precache-start */
const CACHE_NAME = "naqsha-v1-placeholder";
const PRECACHE = ["./", "./index.html"];
/* naqsha:precache-end */

/** The message a page sends to ask a waiting worker to take over. */
const SKIP_WAITING_MESSAGE = 'naqsha:skip-waiting';

/** A precache entry resolved against the worker's scope, so no absolute path is ever assumed. */
function scopedUrl(entry, scope) {
  return new URL(entry, scope).href;
}

/** `cache: 'reload'` keeps a stale HTTP-cached copy out of the precache. */
function precacheRequest(url) {
  return new Request(url, { cache: 'reload' });
}

/**
 * The precache is keyed by address alone: one build, one set of file names, one cached copy of each.
 * `ignoreVary` is needed because a host may answer with `Vary: Origin` (a static preview server does), and the
 * page asks for its own scripts with `crossorigin`, which sends an `Origin` header that the worker's own
 * precache request did not. Without it, every script and style sheet would miss its cached copy.
 */
const MATCH_OPTIONS = { ignoreVary: true };

/**
 * Fetches every entry once and puts it in the cache of this version. Rejects when an entry cannot be
 * fetched or is not ok, so a half-filled cache is never installed. Returns the URLs that were stored.
 */
async function precacheAll(context) {
  const cache = await context.caches.open(context.cacheName);
  const stored = [];
  const seen = new Set();
  for (const entry of context.entries) {
    const url = scopedUrl(entry, context.scope);
    if (seen.has(url)) continue;
    seen.add(url);
    const request = precacheRequest(url);
    const response = await context.fetch(request);
    if (!response || !response.ok) throw new Error(`precache failed for ${url}: ${response ? response.status : 'no response'}`);
    await cache.put(request, response);
    stored.push(url);
  }
  return stored;
}

/** Deletes every cache whose name is not the current version. Returns the names deleted. */
async function deleteOldCaches(context) {
  const names = await context.caches.keys();
  const deleted = [];
  for (const name of names) {
    if (name === context.cacheName) continue;
    await context.caches.delete(name);
    deleted.push(name);
  }
  return deleted;
}

/** Only GET requests are served from the cache; anything else is left to the browser. */
function handlesRequest(request) {
  return request.method === 'GET';
}

/**
 * Cache first: a request that is in the cache is served from it and the network is not called; a request that
 * is not goes to the network exactly once. When the network fails for a page navigation, the cached start page
 * is served instead, so a visit to an address with a query string still opens the app offline.
 */
async function respond(context, request) {
  const cache = await context.caches.open(context.cacheName);
  const cached = await cache.match(request, MATCH_OPTIONS);
  if (cached) return cached;
  try {
    return await context.fetch(request);
  } catch (error) {
    if (request.mode === 'navigate') {
      const startPage = await cache.match(scopedUrl('./', context.scope), MATCH_OPTIONS);
      if (startPage) return startPage;
    }
    throw error;
  }
}

/** What the logic above needs from the worker's globals, so a test can hand it fakes instead. */
function workerContext() {
  return {
    caches: self.caches,
    fetch: (request) => self.fetch(request),
    cacheName: CACHE_NAME,
    entries: PRECACHE,
    scope: self.registration.scope,
  };
}

/** The new worker waits until the visitor asks for it, so nothing reloads under the visitor's hands. */
function onInstall(event) {
  event.waitUntil(precacheAll(workerContext()));
}

function onActivate(event) {
  event.waitUntil(deleteOldCaches(workerContext()).then(() => self.clients.claim()));
}

function onFetch(event) {
  if (handlesRequest(event.request)) event.respondWith(respond(workerContext(), event.request));
}

function onMessage(event) {
  if (event.data === SKIP_WAITING_MESSAGE) self.skipWaiting();
}

self.naqshaServiceWorker = {
  CACHE_NAME,
  PRECACHE,
  SKIP_WAITING_MESSAGE,
  MATCH_OPTIONS,
  scopedUrl,
  precacheRequest,
  precacheAll,
  deleteOldCaches,
  handlesRequest,
  respond,
  workerContext,
  onInstall,
  onActivate,
  onFetch,
  onMessage,
};

self.addEventListener('install', onInstall);
self.addEventListener('activate', onActivate);
self.addEventListener('fetch', onFetch);
self.addEventListener('message', onMessage);
