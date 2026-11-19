import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globalSetup: ['./tests/global-setup.ts'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['server/**/*.ts'],
      reporter: ['text', 'json-summary', 'html'],
      // Node 20 / PostgreSQL 16 baseline; see CONTRIBUTING.md before raising floors.
      thresholds: {
        statements: 75,
        branches: 68,
        functions: 89,
        lines: 78,
        // Exact paths keep critical modules from hiding behind the aggregate.
        'server/auth.ts': { statements: 78, branches: 72, functions: 96, lines: 80 },
        'server/records.ts': { statements: 71, branches: 67, functions: 91, lines: 75 },
        'server/stellar-verification.ts': {
          statements: 84,
          branches: 64,
          functions: 100,
          lines: 88,
        },
      },
    },
  },
});
