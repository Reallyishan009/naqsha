/**
 * Registering the service worker and the update path (R24.1, R24.5). The decisions are pure functions, so a
 * fake container can drive them; `registerServiceWorker` is the thin wiring that talks to the browser.
 *
 * The chosen update path: when a new worker is installed and waiting, the app tells the visitor and offers a
 * control. Pressing it asks the waiting worker to take over and reloads the page once, so nobody stays on
 * stale files and nothing reloads under the visitor's hands.
 */

/** What the app knows about the worker. `update-ready` is the only state the visitor is shown. */
export type ServiceWorkerState =
  | { status: 'not-registered' }
  | { status: 'registered' }
  | { status: 'update-ready' }
  | { status: 'loading-update' };

export const INITIAL_SERVICE_WORKER_STATE: ServiceWorkerState = { status: 'not-registered' };

/** What the browser (or a test) reports about the worker. */
export type ServiceWorkerEvent =
  /** A registration succeeded; `waiting` is true when a new worker is already installed and waiting. */
  | { type: 'registered'; waiting: boolean }
  /** A newly installed worker is waiting for the current one to go. */
  | { type: 'new-worker-waiting' }
  /** The visitor asked for the new version. */
  | { type: 'update-requested' }
  /** A different worker is now in control of the page. */
  | { type: 'controller-changed' };

/** The next state, whether the visitor is told now, and whether the page reloads now. */
export type ServiceWorkerStep = { state: ServiceWorkerState; tellUser: boolean; reload: boolean };

const showing = (state: ServiceWorkerState): boolean => state.status === 'update-ready' || state.status === 'loading-update';

/**
 * The update path as one step function: the visitor is told exactly once per waiting worker, and the page
 * reloads only after the visitor asked and a new worker took control.
 */
export function stepServiceWorker(state: ServiceWorkerState, event: ServiceWorkerEvent): ServiceWorkerStep {
  switch (event.type) {
    case 'registered':
      if (!event.waiting) return { state: showing(state) ? state : { status: 'registered' }, tellUser: false, reload: false };
      return showing(state) ? { state, tellUser: false, reload: false } : { state: { status: 'update-ready' }, tellUser: true, reload: false };
    case 'new-worker-waiting':
      return showing(state) ? { state, tellUser: false, reload: false } : { state: { status: 'update-ready' }, tellUser: true, reload: false };
    case 'update-requested':
      return state.status === 'update-ready' ? { state: { status: 'loading-update' }, tellUser: false, reload: false } : { state, tellUser: false, reload: false };
    case 'controller-changed':
      // The first worker of a visit also takes control; only a visitor who asked for the new version gets a reload.
      return state.status === 'loading-update' ? { state: { status: 'registered' }, tellUser: false, reload: true } : { state, tellUser: false, reload: false };
  }
}

/** What the page can say about service worker support and about being the Built_Site. */
export type ServiceWorkerEnv = { builtSite: boolean; supported: boolean };

/** The dev server never registers a worker, and a browser without support is left alone (R24.1). */
export function shouldRegister(env: ServiceWorkerEnv): boolean {
  return env.builtSite && env.supported;
}

/** The worker's address, relative to the page, so it works under `base: './'` and from a sub-path (R24.8). */
export function serviceWorkerUrl(baseUrl: string): string {
  const base = baseUrl === '' ? './' : baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}sw.js`;
}

/** True only in the built site: Vite replaces this flag at build time (see vite.config.ts). */
export function isBuiltSite(): boolean {
  return __BUILT_SITE__;
}

// ---------------------------------------------------------------- the browser wiring

/** The part of a ServiceWorker a page uses. */
export type WorkerLike = {
  state: string;
  postMessage(message: string): void;
  addEventListener(type: 'statechange', listener: () => void): void;
};

export type RegistrationLike = {
  installing: WorkerLike | null;
  waiting: WorkerLike | null;
  addEventListener(type: 'updatefound', listener: () => void): void;
};

/** The part of navigator.serviceWorker a page uses. A fake stands in for it in tests. */
export type ContainerLike = {
  register(url: string): Promise<RegistrationLike>;
  addEventListener(type: 'controllerchange', listener: () => void): void;
};

export type ServiceWorkerDeps = {
  container: ContainerLike | null;
  env: ServiceWorkerEnv;
  /** Shown to the visitor when a new version is waiting. */
  onUpdateReady: () => void;
  /** Loads the new version. */
  reload: () => void;
  baseUrl: string;
  /** Reported when registration itself fails; the app carries on without a worker. */
  onError?: (message: string) => void;
};

/** The message the waiting worker listens for (the same string as in public/sw.js). */
export const SKIP_WAITING_MESSAGE = 'naqsha:skip-waiting';

export type ServiceWorkerHandle = {
  /** The state as the step function last left it. */
  state: () => ServiceWorkerState;
  /** Called when the visitor presses the control: asks the waiting worker to take over. */
  loadUpdate: () => void;
};

/**
 * Registers the worker when the environment allows it, and keeps the update state. Never throws: a failed
 * registration is reported and the app runs on without a worker.
 */
export function registerServiceWorker(deps: ServiceWorkerDeps): ServiceWorkerHandle {
  let state: ServiceWorkerState = INITIAL_SERVICE_WORKER_STATE;
  let waiting: WorkerLike | null = null;
  const apply = (event: ServiceWorkerEvent): void => {
    const step = stepServiceWorker(state, event);
    state = step.state;
    if (step.tellUser) deps.onUpdateReady();
    if (step.reload) deps.reload();
  };
  const container = deps.container;
  if (container !== null && shouldRegister(deps.env)) {
    container.addEventListener('controllerchange', () => apply({ type: 'controller-changed' }));
    void container
      .register(serviceWorkerUrl(deps.baseUrl))
      .then((registration) => {
        waiting = registration.waiting;
        apply({ type: 'registered', waiting: registration.waiting !== null });
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing;
          if (installing === null) return;
          installing.addEventListener('statechange', () => {
            if (installing.state !== 'installed') return;
            waiting = registration.waiting ?? installing;
            apply({ type: 'new-worker-waiting' });
          });
        });
      })
      .catch((error: unknown) => {
        deps.onError?.(error instanceof Error ? error.message : String(error));
      });
  }
  return {
    state: () => state,
    loadUpdate: () => {
      apply({ type: 'update-requested' });
      waiting?.postMessage(SKIP_WAITING_MESSAGE);
    },
  };
}

/** The browser's service worker container, or null when the browser has none. */
export function browserServiceWorkers(): ContainerLike | null {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
    return navigator.serviceWorker as unknown as ContainerLike;
  } catch {
    return null;
  }
}

/** Loads the page again, so the new worker's files are the ones in use. */
export function reloadPage(): void {
  location.reload();
}
