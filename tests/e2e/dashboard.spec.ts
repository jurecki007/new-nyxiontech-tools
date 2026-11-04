import { expect, test } from '@playwright/test';

test.describe('dashboard', () => {
  test('lists every tool in the sidebar and the grid', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page.locator('.tool-card')).toHaveCount(25);
    // Sidebar: the Dashboard link plus one item per tool.
    await expect(page.locator('.nav-item')).toHaveCount(26);
  });

  test('search filters the sidebar', async ({ page }) => {
    await page.goto('/#/');
    const search = page.getByPlaceholder('Search tools');
    await search.fill('ocr');
    await expect(page.locator('.nav-item')).toHaveCount(1);
    await expect(page.locator('.nav-item')).toHaveText(/OCR/);
    await search.fill('nothing-matches');
    await expect(page.getByText('No tool matches')).toBeVisible();
  });

  test('a tool card opens its page, URL and title', async ({ page }) => {
    await page.goto('/#/');
    await page.locator('.tool-card', { hasText: 'Merge PDF' }).click();
    await expect(page).toHaveURL(/\/merge-pdf$/);
    await expect(page.getByRole('heading', { name: 'Merge PDF' })).toBeVisible();
    await expect(page).toHaveTitle(/Merge PDF/);
    await expect(page.locator('.nav-item.on')).toHaveText(/Merge PDF/);
  });

  test('a tool URL survives a reload', async ({ page }) => {
    await page.goto('/#/tool/qr');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'QR code generator' })).toBeVisible();
  });
});
