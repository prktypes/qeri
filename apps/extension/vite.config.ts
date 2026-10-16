import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

import manifest from './manifest';

export default defineConfig({
  // CRXJS reads the MV3 manifest and turns every declared entry (service worker,
  // content scripts, side panel page) into a properly wired Vite build. Assets get
  // hashed URLs and the manifest is rewritten to reference them automatically.
  plugins: [react(), crx({ manifest }), tailwindcss()],
  resolve: {
    // Prefer true workspace source over node_modules resolution — keeps HMR working
    // for shared code and avoids duplicated zod copies in the bundle.
    alias: {
      '@qeri/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url),
      ),
    },
  },
  build: {
    sourcemap: true,
    target: 'chrome116',
    minify: 'esbuild',
  },
  server: {
    // Extension dev server: CRXJS needs a stable port for content-script HMR.
    port: 5173,
    strictPort: true,
    hmr: {
      port: 5174,
    },
  },
});
