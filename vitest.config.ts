import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    pool: 'forks',

    fileParallelism: true,
    sequence: {
      concurrent: false
    },
    testTimeout: 120000,
    hookTimeout: 120000,
  },
});
