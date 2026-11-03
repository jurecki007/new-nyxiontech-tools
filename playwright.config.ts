import { defineConfig } from '@playwright/test';

// PW_PORT overrides the port, e.g. when another project's preview server already uses 4173.
const PORT = Number(process.env.PW_PORT ?? 4173);

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/global-setup.ts',
  // OCR and the AI model are memory hungry; run one browser at a time.
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // Installed Google Chrome by default, so no browser download is needed.
    // Set PW_CHANNEL=chromium to use Playwright's bundled browser (e.g. in CI).
    channel: process.env.PW_CHANNEL ?? 'chrome',
    acceptDownloads: true,
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    // Tests run against the production build, like the Docker image serves it.
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
