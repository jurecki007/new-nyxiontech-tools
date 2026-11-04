import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PDFName } from 'pdf-lib';
import { fixture, fontNames, loadPdf, openTool, pdfText } from './helpers';

async function openEditor(page: Page, tool = 'edit') {
  await openTool(page, tool);
  await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
  await expect(page.locator('.page-sheet canvas').first()).toBeVisible();
  await expect(page.locator('.page-item')).toHaveCount(2);
}

async function exportPdf(page: Page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.topbar .btn.primary').click()]);
  return fs.readFileSync((await download.path())!);
}

test.describe('editor', () => {
  test('snippet and typed text with Polish characters end up in the PDF', async ({ page }) => {
    await openEditor(page);
    await page.locator('.snippet', { hasText: 'Approved for payment' }).click();

    await page.locator('.tool-item', { hasText: 'Text' }).click();
    await page.locator('.overlay').first().click({ position: { x: 120, y: 600 } });
    const input = page.locator('.text-input');
    await expect(input).toBeFocused();
    await input.fill('Zażółć gęślą jaźń');
    await expect(page.locator('.overlay text', { hasText: 'Zażółć' })).toBeVisible();

    const [first] = await pdfText(await exportPdf(page));
    expect(first).toContain('Approved for payment');
    expect(first).toContain('Zażółć gęślą jaźń');
    expect(first).toContain('Invoice 3/10/2026');
  });

  test('font picker changes the font that is embedded', async ({ page }) => {
    await openEditor(page);
    await page.locator('.snippet').first().click();
    await page.locator('.sidebar .font-picker-button').click();
    await page.locator('.font-option', { hasText: 'Cousine' }).click();
    await expect(page.locator('.sidebar .font-picker-button')).toContainText('Cousine');

    const fonts = await fontNames(await exportPdf(page));
    expect(fonts.some((f) => f.includes('Cousine'))).toBe(true);
  });

  test('whiteout, undo and redo', async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press('w');
    await expect(page.locator('.tool-item.on')).toContainText('Whiteout');
    const box = (await page.locator('.overlay').first().boundingBox())!;
    await page.mouse.move(box.x + 60, box.y + 60);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 100, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator('.overlay .annot')).toHaveCount(1);

    await page.locator('.canvas-area').click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('Control+z');
    await expect(page.locator('.overlay .annot')).toHaveCount(0);
    await page.keyboard.press('Control+y');
    await expect(page.locator('.overlay .annot')).toHaveCount(1);
  });

  test('page rotate and delete are applied on export', async ({ page }) => {
    await openEditor(page);
    const second = page.locator('.page-item').nth(1);
    await second.hover();
    await second.getByTitle('Delete page').click();
    await expect(page.locator('.page-item')).toHaveCount(1);
    const first = page.locator('.page-item').first();
    await first.hover();
    await first.getByTitle('Rotate right').click();

    const doc = await loadPdf(await exportPdf(page));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });

  test('Sign PDF opens the signature dialog and places an image', async ({ page }) => {
    await openEditor(page, 'sign');
    const dialog = page.getByRole('dialog', { name: 'Add signature' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Type' }).click();
    // Real keystrokes: editor shortcuts (e.g. "i" = insert image) must not fire inside the dialog.
    await dialog.getByPlaceholder('Your name').pressSequentially('Jan Kowalski i Piotr');
    await expect(dialog.getByPlaceholder('Your name')).toHaveValue('Jan Kowalski i Piotr');
    await dialog.getByRole('button', { name: 'Insert signature' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator('.overlay image')).toHaveCount(1);

    const doc = await loadPdf(await exportPdf(page));
    expect(doc.getPage(0).node.Resources()?.lookup(PDFName.of('XObject'))).toBeTruthy();
  });

  test('work is autosaved and shown under Recent documents', async ({ page }) => {
    await openEditor(page);
    await page.locator('.snippet').first().click();
    await page.getByTitle('Back to dashboard').click();
    // Back on the dashboard's clean address.
    await expect(page).toHaveURL(/:\d+\/$/);
    const card = page.locator('.card', { hasText: 'invoice_edited' }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText('1 edit');
  });
});
