import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

/**
 * `__BUILT_SITE__` is true only for `vite build`, so the service worker is registered by the Built_Site and
 * never by the dev server or by the test run (R24.1). It is a plugin rather than a top-level `define` because
 * only the plugin hook is told which command is running.
 */
const builtSiteFlag: Plugin = {
  name: 'naqsha-built-site-flag',
  config: (_config, env) => ({ define: { __BUILT_SITE__: JSON.stringify(env.command === 'build') } }),
};

export default defineConfig({
  base: './',
  plugins: [react(), builtSiteFlag],
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
  },
});
