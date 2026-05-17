import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      threshold: {
        statements: 80,
        branches: 70,
        functions: 75,
        lines: 80
      }
    },
    globals: true,
    setupFiles: ['./test/setup.ts'],
  },
});