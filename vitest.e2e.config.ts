import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.e2e.test.ts'],
    testTimeout: 30000,
    hookTimeout: 15000,
    fileParallelism: false,
    maxConcurrency: 1,
    sequence: { concurrent: false },
  },
});
