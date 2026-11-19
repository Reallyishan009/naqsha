/**
 * Build-time flags the bundler replaces. `__BUILT_SITE__` is true only under `vite build`, so the service
 * worker is registered by the Built_Site and never by the dev server (R24.1). See vite.config.ts.
 */
declare const __BUILT_SITE__: boolean;
