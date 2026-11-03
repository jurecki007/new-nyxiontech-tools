import { defineConfig } from '@playwright/test';

// Smoke tests of the built Windows desktop app (see tests/desktop).
export default defineConfig({
  testDir: './tests/desktop',
  globalSetup: './tests/global-setup.ts',
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  outputDir: 'test-results/desktop',
});
