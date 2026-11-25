import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts', 'examples/**/*.test.mjs'],
    exclude: ['src/**/*.e2e.test.ts'],
  },
});
