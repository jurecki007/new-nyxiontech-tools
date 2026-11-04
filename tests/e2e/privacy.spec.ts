import { expect, test } from '@playwright/test';
import { cspViolations, downloadResult, fixture, loadPdf, openTool, pdfText, run } from './helpers';

/** The connect-src directive of a Content-Security-Policy header. */
const connectSrc = (csp: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith('connect-src '));

test.describe('privacy indicator', () => {
  test('opens an explainer that shows the connect-src the site is actually served with', async ({ page }) => {
    const violations = cspViolations(page);
    const response = await page.goto('/');
    const header = response!.headers()['content-security-policy'];
    expect(header).toBeTruthy();

    const indicator = page.locator('.nav-privacy button');
    await expect(indicator).toHaveText('Files stay on this device');
    await indicator.click();

    const dialog = page.getByRole('dialog', { name: 'Privacy' });
    await expect(dialog).toBeVisible();
    // The same directive the server sends, character for character: the text can't drift from the policy.
    await expect(dialog.getByTestId('connect-src')).toHaveText(connectSrc(header!)!);
    await expect(dialog).toContainText('disconnect from the internet');
    await expect(dialog).toContainText('Network tab');
    await expect(dialog.getByRole('status')).toContainText("You're online");

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect(violations).toEqual([]);
  });

  test('going offline flips the indicator, and a tool used once keeps working', async ({ page, context }) => {
    const violations = cspViolations(page);
    // What the explainer tells people to try: use a tool once, go offline, use it again.
    await openTool(page, 'compress');
    await expect(page.locator('.nav-privacy button')).toHaveText('Files stay on this device');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await run(page);
    await page.locator('.nav-item', { hasText: 'Dashboard' }).click();

    await context.setOffline(true);
    await expect(page.locator('.nav-privacy button')).toHaveText("Offline: tools you've used still work");

    // The pdf.js worker and code now come from the browser's cache (as with nginx's Cache-Control in production).
    await page.locator('.nav-item[href="/compress-pdf"]').click();
    await page.locator('.file-drop input').setInputFiles(fixture('invoice-changed.pdf'));
    await run(page);
    const compressed = await loadPdf((await downloadResult(page)).bytes);
    expect(compressed.getPageCount()).toBe(2);

    // Merge needs nothing beyond the page itself, so it works even without being used before.
    await page.locator('.nav-item[href="/merge-pdf"]').click();
    await page.locator('.file-drop input').setInputFiles([fixture('invoice.pdf'), fixture('invoice-changed.pdf')]);
    await run(page);
    expect(await pdfText((await downloadResult(page)).bytes)).toHaveLength(4);

    await page.locator('.nav-privacy button').click();
    await expect(page.getByRole('dialog', { name: 'Privacy' }).getByRole('status')).toContainText("You're offline right now");

    await context.setOffline(false);
    await expect(page.locator('.nav-privacy button')).toHaveText('Files stay on this device');
    expect(violations).toEqual([]);
  });
});

test.describe('support note', () => {
  test('appears after a download, can be dismissed, and stays away for the session', async ({ page }) => {
    const violations = cspViolations(page);
    await openTool(page, 'merge');
    const note = page.locator('.support-note');
    await expect(note).toHaveCount(0);

    await page.locator('.file-drop input').setInputFiles([fixture('invoice.pdf'), fixture('invoice-changed.pdf')]);
    await run(page);
    // Results alone (no save yet) don't show it.
    await page.waitForTimeout(1000);
    await expect(note).toHaveCount(0);

    await downloadResult(page);
    await expect(note).toBeVisible();
    await expect(page.locator('.support-note-region')).toHaveAttribute('aria-live', 'polite');
    await expect(note.getByRole('link', { name: 'Star it on GitHub' })).toHaveAttribute('href', /github\.com\/jurecki007\/nyxiontech-tools$/);
    await expect(note.getByRole('link', { name: 'Support on Ko-fi' })).toHaveAttribute('href', 'https://ko-fi.com/nyxiontech');
    await expect(note.getByRole('link', { name: 'Star it on GitHub' })).toHaveAttribute('target', '_blank');

    await note.getByRole('button', { name: 'Dismiss' }).click();
    await expect(note).toHaveCount(0);

    await downloadResult(page);
    await page.waitForTimeout(1500);
    await expect(note).toHaveCount(0);
    expect(violations).toEqual([]);
  });

  test('shows at most once per session even when not dismissed', async ({ page }) => {
    await openTool(page, 'merge');
    await page.locator('.file-drop input').setInputFiles([fixture('invoice.pdf'), fixture('invoice-changed.pdf')]);
    await run(page);
    await downloadResult(page);
    await expect(page.locator('.support-note')).toBeVisible();

    // Same tab, same session: a reload keeps sessionStorage.
    await page.reload();
    await page.locator('.file-drop input').setInputFiles([fixture('invoice.pdf'), fixture('invoice-changed.pdf')]);
    await run(page);
    await downloadResult(page);
    await page.waitForTimeout(1500);
    await expect(page.locator('.support-note')).toHaveCount(0);
  });

  test('stays away for a week after being dismissed, in a new session too', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('nyxiontech-pdf-tools:pref:supportNote.dismissedAt', String(Date.now() - 6 * 86_400_000)));
    await openTool(page, 'merge');
    await page.locator('.file-drop input').setInputFiles([fixture('invoice.pdf'), fixture('invoice-changed.pdf')]);
    await run(page);
    await downloadResult(page);
    await page.waitForTimeout(1500);
    await expect(page.locator('.support-note')).toHaveCount(0);

    // Eight days later it may appear again.
    await page.evaluate(() => localStorage.setItem('nyxiontech-pdf-tools:pref:supportNote.dismissedAt', String(Date.now() - 8 * 86_400_000)));
    await downloadResult(page);
    await expect(page.locator('.support-note')).toBeVisible();
  });

  test('the sidebar links to GitHub for a star and to Ko-fi', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.nav-links a', { hasText: 'Star on GitHub' })).toHaveAttribute('href', 'https://github.com/jurecki007/nyxiontech-tools');
    await expect(page.locator('.nav-links a', { hasText: 'Support' })).toHaveAttribute('href', 'https://ko-fi.com/nyxiontech');
  });
});
