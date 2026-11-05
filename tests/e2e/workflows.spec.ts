import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { PDFName } from 'pdf-lib';
import { fixture, loadPdf, makePng, openTool, pdfText, runAndDownload } from './helpers';

async function openEditor(page: Page) {
  await openTool(page, 'edit');
  await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
  await expect(page.locator('.page-sheet canvas').first()).toBeVisible();
}

async function exportPdf(page: Page) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.topbar .btn.primary').click()]);
  return fs.readFileSync((await download.path())!);
}

/** Drags on the first page, in page-relative CSS pixels. */
async function dragOnPage(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.locator('.overlay').first().boundingBox())!;
  await page.mouse.move(box.x + from[0], box.y + from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 5 });
  await page.mouse.up();
}

test.describe('editor workflows', () => {
  test('highlight, box and an inserted image are exported', async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press('h');
    await dragOnPage(page, [60, 60], [300, 90]);
    await page.keyboard.press('b');
    await dragOnPage(page, [60, 120], [300, 160]);
    await expect(page.locator('.overlay .annot')).toHaveCount(2);

    const png = await makePng(page, 'logo.png', 'logo');
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.tool-item', { hasText: 'Image / stamp' }).click()]);
    await chooser.setFiles(png);
    await expect(page.locator('.overlay image')).toHaveCount(1);
    await expect(page.locator('.sidebar .panel-title').first()).toHaveText('Image');

    const doc = await loadPdf(await exportPdf(page));
    expect(doc.getPage(0).node.Resources()?.lookup(PDFName.of('XObject'))).toBeTruthy();
  });

  test('highlight, whiteout and box stay active for several areas; Esc switches back to Select', async ({ page }) => {
    await openEditor(page);
    for (const [key, label] of [['h', 'Highlight'], ['w', 'Whiteout'], ['b', 'Box']] as const) {
      await page.keyboard.press(key);
      await expect(page.locator('.tool-item.on')).toContainText(label);
    }
    await page.keyboard.press('h');
    await dragOnPage(page, [60, 60], [300, 80]);
    await dragOnPage(page, [60, 100], [300, 120]);
    await dragOnPage(page, [60, 140], [300, 160]);
    await expect(page.locator('.overlay .annot')).toHaveCount(3);
    await expect(page.locator('.tool-item.on')).toContainText('Highlight');

    // A plain click (no drag) still adds nothing and keeps the tool.
    await dragOnPage(page, [200, 250], [201, 250]);
    await expect(page.locator('.overlay .annot')).toHaveCount(3);
    await expect(page.locator('.tool-item.on')).toContainText('Highlight');

    await page.keyboard.press('Escape');
    await expect(page.locator('.tool-item.on')).toContainText('Select');
    await dragOnPage(page, [60, 300], [300, 320]);
    await expect(page.locator('.overlay .annot')).toHaveCount(3);
  });

  test('Add PDF appends pages from another file', async ({ page }) => {
    await openEditor(page);
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.topbar').getByRole('button', { name: 'Add PDF' }).click()]);
    await chooser.setFiles(fixture('invoice-changed.pdf'));
    await expect(page.locator('.page-item')).toHaveCount(4);
    const text = await pdfText(await exportPdf(page));
    expect(text).toHaveLength(4);
    // Inserted after the active (first) page.
    expect(text[1]).toContain('1600.00');
  });

  test('save a text as a snippet, insert it, remove it', async ({ page }) => {
    await openEditor(page);
    await page.keyboard.press('t');
    await page.locator('.overlay').first().click({ position: { x: 100, y: 500 } });
    await page.locator('.text-input').fill('Made in EU');
    await page.getByTitle('Save as snippet').click();
    const snippet = page.locator('.snippets li', { hasText: 'Made in EU' });
    await expect(snippet).toBeVisible();

    await snippet.locator('.snippet').click();
    await expect(page.locator('.overlay text', { hasText: 'Made in EU' })).toHaveCount(2);
    await snippet.getByTitle('Remove snippet').click();
    await expect(page.locator('.snippets li', { hasText: 'Made in EU' })).toHaveCount(0);
  });

  test('arrow keys nudge and Delete removes the selection', async ({ page }) => {
    await openEditor(page);
    await page.locator('.snippet').first().click();
    const x = page.locator('.sidebar .field', { hasText: /^X/ }).locator('input');
    const before = Number(await x.inputValue());
    await page.locator('.canvas-area').click({ position: { x: 5, y: 5 } });
    await page.locator('.overlay .annot').first().click();
    await page.keyboard.press('Shift+ArrowRight');
    await expect(x).toHaveValue(String(before + 10));
    await page.keyboard.press('Delete');
    await expect(page.locator('.overlay .annot')).toHaveCount(0);
  });

  test('drawn signature', async ({ page }) => {
    await openTool(page, 'sign');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    const dialog = page.getByRole('dialog', { name: 'Add signature' });
    const pad = (await dialog.locator('.sig-pad').boundingBox())!;
    await page.mouse.move(pad.x + 40, pad.y + 120);
    await page.mouse.down();
    for (const [dx, dy] of [[90, 60], [140, 150], [200, 70], [260, 140], [340, 90]]) await page.mouse.move(pad.x + dx, pad.y + dy, { steps: 5 });
    await page.mouse.up();
    await dialog.getByRole('button', { name: 'Insert signature' }).click();
    await expect(page.locator('.overlay image')).toHaveCount(1);
  });
});

test.describe('dashboard workflows', () => {
  test('duplicate and delete a recent document', async ({ page }) => {
    await openEditor(page);
    await page.getByTitle('Back to dashboard').click();
    const cards = page.locator('.card', { hasText: 'invoice_edited' });
    await expect(cards.first()).toBeVisible();
    const before = await cards.count();
    await cards.first().getByTitle('Duplicate').click();
    await expect(page.locator('.card', { hasText: 'invoice_edited (copy)' }).first()).toBeVisible();

    page.once('dialog', (d) => void d.accept());
    await page.locator('.card', { hasText: 'invoice_edited (copy)' }).first().getByTitle('Delete').click();
    await expect(page.locator('.card', { hasText: 'invoice_edited' })).toHaveCount(before);
  });

  test('Clear all documents empties the recent list', async ({ page }) => {
    await openEditor(page);
    await page.getByTitle('Back to dashboard').click();
    await expect(page.locator('.recent .card').first()).toBeVisible();

    page.once('dialog', (d) => void d.dismiss());
    await page.getByRole('button', { name: 'Clear all documents' }).click();
    await expect(page.locator('.recent .card').first()).toBeVisible();

    page.once('dialog', (d) => void d.accept());
    await page.getByRole('button', { name: 'Clear all documents' }).click();
    await expect(page.locator('.recent .card')).toHaveCount(0);
    await expect(page.getByText('Nothing here yet')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear all documents' })).toBeHidden();
    await page.reload();
    await expect(page.locator('.recent .card')).toHaveCount(0);
  });

  test('"Open in editor" takes a merged result into the editor', async ({ page }) => {
    await openTool(page, 'merge');
    await page.locator('.file-drop input').setInputFiles([fixture('invoice.pdf'), fixture('invoice-changed.pdf')]);
    await page.locator('.run-bar .btn.primary').click();
    await page.getByRole('button', { name: 'Open in editor' }).click();
    await expect(page.locator('.editor .page-item')).toHaveCount(4);
  });
});

test.describe('more tool options', () => {
  test('split: extract selected pages into one file', async ({ page }) => {
    await openTool(page, 'split');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await page.getByRole('radio', { name: 'Extract pages' }).click();
    await page.locator('.option input.text-field').fill('2');
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('invoice_extract.pdf');
    const text = await pdfText(bytes);
    expect(text).toHaveLength(1);
    expect(text[0]).toContain('Second page content');
  });

  test('redact: a box drawn by hand, and clicking it removes it', async ({ page }) => {
    await openTool(page, 'redact');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    const sheet = page.locator('.redact-sheet svg').first();
    await expect(sheet).toBeVisible();
    const box = (await sheet.boundingBox())!;
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 250, box.y + 90, { steps: 4 });
    await page.mouse.up();
    await expect(page.locator('.redact-toolbar b')).toHaveText('1 area to redact');
    await page.locator('.redact-box').first().click();
    await expect(page.locator('.redact-toolbar b')).toHaveText('0 areas to redact');
    await expect(page.locator('.run-bar .btn.primary')).toBeDisabled();
  });

  test('QR contact card', async ({ page }) => {
    await openTool(page, 'qr');
    await page.getByRole('radio', { name: 'Contact' }).click();
    await expect(page.getByText('Fill in the form')).toBeVisible();
    await page.locator('.option', { hasText: 'Full name' }).locator('input').fill('Jan Kowalski');
    await page.locator('.option', { hasText: 'Phone' }).locator('input').fill('+48 600 000 000');
    await expect(page.locator('.qr-image svg')).toBeVisible();
  });
});
