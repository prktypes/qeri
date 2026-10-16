import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirrors how the extension consumes the package: source-level, no build step
    alias: {
      '@qeri/shared': fileURLToPath(new URL('./packages/shared/src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['packages/*/src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
  },
});
