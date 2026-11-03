import { execFile, spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { chromium, expect, test as base, type Browser, type Page } from '@playwright/test';
import { alphaStats, fixture, makePng, pdfText } from '../e2e/helpers';

// Smoke test of the built desktop app (run `npm run desktop:build` first).
// WebView2 is told to open a debugging port, and Playwright drives the real window.

const here = path.dirname(fileURLToPath(import.meta.url));
const EXE = process.env.DESKTOP_EXE ?? path.join(here, '../../src-tauri/target/release/nyxiontech-pdf-tools.exe');
const PORT = 9333;
const run = promisify(execFile);

type App = { proc: ChildProcess; browser: Browser; page: Page; dataDir: string; outDir: string };

async function launch(dataDir: string): Promise<Omit<App, 'outDir'>> {
  const proc = spawn(EXE, [], {
    env: {
      ...process.env,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${PORT}`,
      // Keeps the test's documents out of the real app's data folder.
      WEBVIEW2_USER_DATA_FOLDER: dataDir,
    },
  });
  let browser: Browser | undefined;
  for (let i = 0; i < 60 && !browser; i++) {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`).catch(() => undefined);
    if (!browser) await new Promise((r) => setTimeout(r, 500));
  }
  if (!browser) throw new Error('desktop app did not open a debugging port');
  const page = browser.contexts()[0].pages()[0];
  await expect(page.locator('.tool-grid').first()).toBeVisible({ timeout: 30_000 });
  return { proc, browser, page, dataDir };
}

/** Closes the window the way a user does (WM_CLOSE), so storage is flushed. */
async function close(app: Pick<App, 'proc' | 'browser' | 'dataDir'>) {
  await app.browser.close().catch(() => {});
  const exited = new Promise((r) => app.proc.once('exit', r));
  await run('taskkill', ['/PID', String(app.proc.pid)]).catch(() => {});
  await Promise.race([exited, new Promise((r) => setTimeout(r, 10_000))]);
  if (app.proc.exitCode === null) app.proc.kill();
  // WebView2 helper processes outlive the window for a while and hold the data folder.
  await expect.poll(() => webviewProcesses(app.dataDir), { timeout: 60_000 }).toBe(0).catch(() => {});
}

/** Number of WebView2 processes still using the given data folder. */
async function webviewProcesses(dataDir: string): Promise<number> {
  const script = `@(Get-CimInstance Win32_Process -Filter "Name='msedgewebview2.exe'" | Where-Object { $_.CommandLine -like '*${path.basename(dataDir)}*' }).Count`;
  const { stdout } = await run('powershell', ['-NoProfile', '-Command', script]);
  return Number(stdout.trim());
}

/** Clicks a save button and answers the native "Save as" dialog; returns the saved bytes. */
async function saveVia(app: App, click: () => Promise<void>, name: string): Promise<Buffer> {
  const target = path.join(app.outDir, name);
  await click();
  await run('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(here, 'save-dialog.ps1'), '-AppPid', String(app.proc.pid), '-Path', target]);
  await expect.poll(() => fs.existsSync(target) && fs.statSync(target).size > 0, { timeout: 15_000 }).toBe(true);
  return fs.readFileSync(target);
}

async function openTool(page: Page, id: string) {
  await page.evaluate((id) => (location.hash = `#/tool/${id}`), id);
  await expect(page.locator('.tool-page')).toBeVisible();
}

const test = base.extend<{ app: App }>({
  app: async ({}, use) => {
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyxiontech-desktop-data-'));
    const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nyxiontech-desktop-out-'));
    const app = { ...(await launch(dataDir)), outDir };
    await use(app);
    await close(app);
    fs.rmSync(outDir, { recursive: true, force: true });
    try {
      fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
    } catch (e) {
      console.warn(`left ${dataDir}: ${(e as Error).message}`);
    }
  },
});

test.describe.configure({ mode: 'serial' });

test('runs the bundled app under the Content-Security-Policy', async ({ app: { page } }) => {
  expect(new URL(page.url()).host).toBe('tauri.localhost');
  await expect(page.locator('.tool-card')).toHaveCount(25);
  expect(await page.evaluate(() => '__TAURI_INTERNALS__' in window)).toBe(true);

  // The web build's policy, plus only Tauri's own additions: hashes for the
  // scripts it injects, and its IPC endpoint (used by the Save dialog).
  const parse = (csp: string) => new Map(csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([n, ...v]) => [n, v]));
  const desktop = parse(await page.evaluate(async () => (await fetch(location.href)).headers.get('content-security-policy') ?? ''));
  const web = parse(fs.readFileSync(path.join(here, '../../nginx/security-headers.conf'), 'utf8').match(/Content-Security-Policy "([^"]*)"/)![1]);
  expect([...desktop.keys()].sort()).toEqual([...web.keys()].sort());
  for (const [name, sources] of web) {
    const extra = desktop.get(name)!.filter((s) => !sources.includes(s));
    const unexpected = name === 'script-src' ? extra.filter((s) => !/^'sha256-/.test(s)) : name === 'connect-src' ? extra.filter((s) => s !== 'ipc:' && s !== 'http://ipc.localhost') : extra;
    expect(desktop.get(name), name).toEqual(expect.arrayContaining(sources));
    expect(unexpected, `${name} has no extra sources`).toEqual([]);
  }
  // Enforced, not just sent: an image from the internet is refused (no request leaves).
  // (eval can't be checked here: code run over the debugging port is exempt from CSP.)
  const violated = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        document.addEventListener('securitypolicyviolation', (e) => resolve(e.effectiveDirective), { once: true });
        const img = document.createElement('img');
        img.src = 'https://example.com/pixel.png';
        document.body.append(img);
        setTimeout(() => resolve('none'), 3000);
      }),
  );
  expect(violated).toBe('img-src');
});

test('keeps the window on the app', async ({ app: { page } }) => {
  const before = page.url();
  // A scheme the guard neither allows nor hands to the system (http/mailto would open the browser).
  await page.evaluate(() => (location.href = 'ftp://example.com/'));
  await page.waitForTimeout(1000);
  expect(page.url()).toBe(before);
  // (Locators would wait for the cancelled navigation to "finish", so query directly.)
  expect(await page.evaluate(() => document.querySelectorAll('.tool-card').length)).toBe(25);
  await page.screenshot({ path: test.info().outputPath('after-blocked-navigation.png') });
});

test('branding, About and outside links fit the desktop app', async ({ app: { page } }) => {
  await expect(page.locator('.nav-brand')).toContainText('NYXIONTECH');
  // Outside links must not open new WebView windows: without target they navigate,
  // and the navigation guard hands them to the default browser.
  for (const link of await page.locator('.nav-links a').all()) {
    expect(await link.getAttribute('target')).toBeNull();
  }
  await page.getByRole('button', { name: 'About' }).click();
  await expect(page.getByRole('dialog')).toContainText('run entirely on your computer');
  await expect(page.getByRole('link', { name: 'third-party licences' })).toHaveAttribute('href', /^https:\/\/github\.com\//);
  await page.keyboard.press('Escape');
  await expect(page.locator('.banner.update')).toHaveCount(0);
});

test('OCR result is saved through the native Save dialog', async ({ app }) => {
  test.setTimeout(180_000);
  const { page } = app;
  await openTool(page, 'ocr');
  await page.locator('.file-drop input').setInputFiles(await makePng(page, 'scan.png', 'text', 'FAKTURA VAT 2026\nBiałystok, ul. Żurawia'));
  await page.locator('.run-bar .btn.primary').click();
  await expect(page.locator('.text-output')).toHaveValue(/Białystok/, { timeout: 150_000 });
  const bytes = await saveVia(app, () => page.locator('.results-head button', { hasText: /Download/ }).last().click(), 'scan_ocr.pdf');
  const [text] = await pdfText(bytes);
  expect(text).toContain('FAKTURA');
  expect(text).toContain('Białystok');
});

test('background removal with the AI model', async ({ app }) => {
  const { page } = app;
  await openTool(page, 'remove-background');
  await page.locator('.file-drop input').setInputFiles(await makePng(page, 'photo.png', 'subject'));
  await page.locator('.run-bar .btn.primary').click();
  await expect(page.locator('.results')).toBeVisible({ timeout: 100_000 });
  const bytes = await saveVia(app, () => page.locator('.results-head button', { hasText: /Download/ }).last().click(), 'photo.png');
  const { transparent, opaque } = await alphaStats(page, bytes);
  expect(transparent).toBeGreaterThan(0.6);
  expect(opaque).toBeGreaterThan(0.12);
});

test('recent documents survive a restart', async ({ app }) => {
  await openTool(app.page, 'edit');
  await app.page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
  await app.page.locator('.snippet').first().click();
  await app.page.getByTitle('Back to dashboard').click();
  await expect(app.page.locator('.card', { hasText: 'invoice_edited' }).first()).toBeVisible();

  await close(app);
  Object.assign(app, await launch(app.dataDir));
  await expect(app.page.locator('.card', { hasText: 'invoice_edited' }).first()).toBeVisible();
});
