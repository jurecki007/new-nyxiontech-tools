import { expect, test } from '@playwright/test';

test.describe('branding, about and updates', () => {
  test('shows the Nyxiontech name, version and links', async ({ page }) => {
    await page.goto('/#/');
    await expect(page).toHaveTitle('Nyxiontech PDF Tools');
    await expect(page.locator('.nav-brand')).toContainText('NYXIONTECH');
    await expect(page.locator('.nav-version')).toHaveText(/^v\d+\.\d+\.\d+/);
    await expect(page.locator('.nav-links a', { hasText: 'nyxiontech.com' })).toHaveAttribute('href', 'https://nyxiontech.com');
    await expect(page.locator('.nav-links a', { hasText: 'GitHub' })).toHaveAttribute('href', /github\.com/);
    await expect(page.locator('.nav-links a', { hasText: 'Support' })).toHaveAttribute('href', 'https://ko-fi.com/nyxiontech');
  });

  test("What's new lists the running version from the changelog", async ({ page }) => {
    await page.goto('/#/');
    const version = (await page.locator('.nav-version').textContent())!.match(/v([\d.]+)/)![1];
    await page.getByRole('button', { name: "What's new" }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.locator('.changelog h4').first()).toContainText(version);
    await expect(dialog.locator('.changelog h4').first()).toContainText('current');
    await dialog.getByRole('button', { name: 'About' }).click();
    await expect(dialog).toContainText('Files are never uploaded');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('offers a reload when a newer version is deployed', async ({ page }) => {
    await page.route('**/version.json', (route) => route.fulfill({ json: { version: '999.0.0' } }));
    await page.goto('/#/');
    const banner = page.locator('.banner.update');
    await expect(banner).toContainText('Version 999.0.0 is available');
    await expect(banner.getByRole('button', { name: 'Reload' })).toBeVisible();
  });

  test('no update banner when the deployed version is the running one', async ({ page }) => {
    const served = await page.request.get('/version.json');
    expect(served.ok()).toBe(true);
    const checked = page.waitForResponse('**/version.json');
    await page.goto('/#/');
    await checked;
    await expect(page.locator('.banner.update')).toHaveCount(0);
  });

  test('moves documents saved under the old storage name', async ({ page }) => {
    await page.goto('/#/');
    // Recreate the pre-rename database and a snippet, then reload so the app migrates them.
    await page.evaluate(async () => {
      localStorage.setItem('yosensi-pdf-editor:snippets', JSON.stringify([{ id: 'x', text: 'Legacy snippet', font: 'arimo', size: 9, color: '#000000', bold: false, italic: false }]));
      localStorage.removeItem('nyxiontech-pdf-tools:snippets');
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('yosensi-pdf-editor');
        open.onupgradeneeded = () => open.result.createObjectStore('projects');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('projects', 'readwrite');
          tx.objectStore('projects').put(
            { id: 'legacy-1', name: 'Legacy document', createdAt: 1, updatedAt: Date.now(), sources: [], doc: { pages: [], annots: [] } },
            'legacy-1',
          );
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      });
    });
    await page.reload();
    await expect(page.locator('.card', { hasText: 'Legacy document' })).toBeVisible();
    const snippets = await page.evaluate(() => localStorage.getItem('nyxiontech-pdf-tools:snippets'));
    expect(snippets).toContain('Legacy snippet');
    expect(await page.evaluate(() => localStorage.getItem('yosensi-pdf-editor:snippets'))).toBeNull();
  });
});
