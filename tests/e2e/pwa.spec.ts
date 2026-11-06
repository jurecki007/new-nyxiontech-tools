// Installed web app (PWA): manifest, service worker, files opened from the OS
// (file_handlers + launchQueue), files shared from other apps (share_target) and
// the "Install app" button. The OS side can't be driven from a test, so the launch
// queue is stubbed and the share is the POST the browser would send.
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { toolPath } from '../../src/utilities/routes';
import { fixture } from './helpers';

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  icons: { src: string; sizes: string; purpose?: string }[];
  file_handlers: { action: string; accept: Record<string, string[]> }[];
  share_target: { action: string; method: string; enctype: string; params: { files: { name: string; accept: string[] }[] } };
}

/** Waits until the service worker is active and controls the page. */
async function waitForWorker(page: Page) {
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration('/');
    return !!reg?.active && !!navigator.serviceWorker.controller;
  });
}

test.describe('Installable app', () => {
  test('the manifest makes the app installable and declares file handling and sharing', async ({ page }) => {
    const res = await page.request.get('/site.webmanifest');
    expect(res.ok()).toBe(true);
    const m = (await res.json()) as Manifest;
    expect(m).toMatchObject({ start_url: '/', scope: '/', display: 'standalone' });
    expect(m.name && m.short_name).toBeTruthy();
    for (const size of ['192x192', '512x512']) {
      expect(m.icons.some((i) => i.sizes === size && i.purpose !== 'maskable')).toBe(true);
      expect(m.icons.some((i) => i.sizes === size && i.purpose === 'maskable')).toBe(true);
    }
    for (const icon of m.icons) expect((await page.request.get(icon.src)).ok(), icon.src).toBe(true);

    expect(m.file_handlers).toHaveLength(1);
    expect(m.file_handlers[0].action).toBe('/');
    expect(m.file_handlers[0].accept['application/pdf']).toEqual(['.pdf']);
    expect(m.file_handlers[0].accept['image/jpeg']).toContain('.jpg');

    expect(m.share_target).toMatchObject({ action: '/share-target', method: 'POST', enctype: 'multipart/form-data' });
    const files = m.share_target.params.files[0];
    expect(files.name).toBe('files');
    expect(files.accept).toEqual(expect.arrayContaining(['application/pdf', '.pdf', 'image/png']));
  });

  test('the service worker registers, controls the page and is served under the CSP', async ({ page }) => {
    const sw = await page.request.get('/sw.js');
    expect(sw.ok()).toBe(true);
    expect(sw.headers()['content-type']).toContain('javascript');
    expect(sw.headers()['content-security-policy']).toContain("worker-src 'self'");
    const body = await sw.text();
    // It must never cache or fetch: files never leave the device.
    expect(body).not.toMatch(/\bcaches\.|\bfetch\(|importScripts|XMLHttpRequest/);

    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    await waitForWorker(page);
    const scope = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration('/'))?.scope);
    expect(scope).toMatch(/\/$/);
    expect(await page.evaluate(() => caches.keys())).toEqual([]);
    expect(errors).toEqual([]);

    // Chrome itself finds the manifest valid and the app installable.
    const cdp = await page.context().newCDPSession(page);
    const manifest = (await cdp.send('Page.getAppManifest')) as { errors: { message: string }[] };
    expect(manifest.errors).toEqual([]);
    const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
    // Playwright's browser contexts are incognito, where Chrome never offers installation.
    expect(installabilityErrors.map((e) => e.errorId).filter((id) => id !== 'in-incognito')).toEqual([]);
  });

  test('a PDF opened from the OS opens in the editor', async ({ page }) => {
    const pdf = fs.readFileSync(fixture('invoice.pdf')).toString('base64');
    // Stand-in for Chrome's launchQueue, delivering one launch with the file.
    await page.addInitScript((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const file = new File([bytes], 'invoice.pdf', { type: 'application/pdf' });
      Object.defineProperty(window, 'launchQueue', {
        configurable: true,
        value: { setConsumer: (consumer: (p: unknown) => void) => consumer({ files: [{ kind: 'file', getFile: async () => file }] }) },
      });
    }, pdf);
    await page.goto('/');
    await expect(page.locator('.editor')).toBeVisible();
    await expect(page.locator('.name-input')).toHaveValue('invoice_edited');
  });

  test('an image opened from the OS opens in Images to PDF', async ({ page }) => {
    await page.addInitScript(() => {
      // 1x1 PNG
      const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='), (c) => c.charCodeAt(0));
      const file = new File([png], 'photo.png', { type: 'image/png' });
      Object.defineProperty(window, 'launchQueue', {
        configurable: true,
        value: { setConsumer: (consumer: (p: unknown) => void) => consumer({ files: [{ kind: 'file', getFile: async () => file }] }) },
      });
    });
    await page.goto('/');
    await expect(page.locator('.tool-page h1')).toHaveText('Images to PDF');
    expect(new URL(page.url()).pathname).toBe(toolPath('images-to-pdf', 'en'));
    await expect(page.locator('.tool-page')).toContainText('photo.png');
  });

  test('a PDF shared from another app opens in the editor', async ({ page }) => {
    await page.goto('/');
    await waitForWorker(page);
    const pdf = fs.readFileSync(fixture('invoice.pdf')).toString('base64');
    // The POST the browser sends to the share_target action; only the service worker answers it.
    const location = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append('files', new File([bytes], 'shared.pdf', { type: 'application/pdf' }));
      const res = await fetch('/share-target', { method: 'POST', body: form });
      return res.url;
    }, pdf);
    expect(location).toMatch(/\/\?share-target=[\w-]+$/);
    await page.goto(location);
    await expect(page.locator('.editor')).toBeVisible();
    await expect(page.locator('.name-input')).toHaveValue('shared_edited');
    // The address is cleaned up, and the files were handed over once only.
    expect(new URL(page.url()).search).toBe('');
    await page.goto(location);
    await expect(page.locator('.banner.error')).toContainText('no longer available');
  });

  test('"Install app" appears only when the browser offers installation', async ({ page }) => {
    await page.goto('/');
    const button = page.getByRole('button', { name: 'Install app' });
    await expect(button).toHaveCount(0);
    await page.evaluate(() => {
      const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void> };
      e.prompt = async () => void ((window as { prompted?: boolean }).prompted = true);
      window.dispatchEvent(e);
    });
    await expect(button).toBeVisible();
    await button.click();
    expect(await page.evaluate(() => (window as { prompted?: boolean }).prompted)).toBe(true);
    await expect(button).toHaveCount(0);
  });
});
