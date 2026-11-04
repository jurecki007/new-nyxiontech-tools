import { expect, test } from '@playwright/test';
import type { PDFCheckBox, PDFDropdown, PDFTextField } from 'pdf-lib';
import { fixture, loadPdf, openTool, pdfText, runAndDownload, unzip } from './helpers';

test.describe('organize', () => {
  test('merge keeps all pages in the chosen order', async ({ page }) => {
    await openTool(page, 'merge');
    await page.locator('.file-drop input').setInputFiles([fixture('invoice.pdf'), fixture('invoice-changed.pdf')]);
    await expect(page.locator('.file-list li')).toHaveCount(2);
    await page.locator('.file-list li').nth(1).getByTitle('Move up').click();
    const text = await pdfText((await runAndDownload(page)).bytes);
    expect(text).toHaveLength(4);
    expect(text[0]).toContain('1600.00');
    expect(text[2]).toContain('1546.00');
  });

  test('split every page gives a zip of single-page PDFs', async ({ page }) => {
    await openTool(page, 'split');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await page.getByRole('radio', { name: 'Every page' }).click();
    const { name, bytes } = await runAndDownload(page);
    expect(name).toMatch(/\.zip$/);
    const files = unzip(bytes);
    expect(Object.keys(files).sort()).toEqual(['invoice_p1.pdf', 'invoice_p2.pdf']);
    expect((await loadPdf(files['invoice_p2.pdf'])).getPageCount()).toBe(1);
  });

  test('split rejects a range outside the document', async ({ page }) => {
    await openTool(page, 'split');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await expect(page.locator('.single-file')).toContainText('2 pages');
    await page.locator('.option input.text-field').fill('1-9');
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.run-bar .error-text')).toContainText('outside pages 1–2');
  });

  test('rotate selected pages only', async ({ page }) => {
    await openTool(page, 'rotate');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await page.getByRole('radio', { name: 'Selected' }).click();
    await page.getByPlaceholder('e.g. 1, 3-4').fill('2');
    const doc = await loadPdf((await runAndDownload(page)).bytes);
    expect(doc.getPage(0).getRotation().angle).toBe(0);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
  });
});

test.describe('edit', () => {
  test('page numbers', async ({ page }) => {
    await openTool(page, 'page-numbers');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await page.locator('.chip', { hasText: 'Strona 3 z 12' }).click();
    const text = await pdfText((await runAndDownload(page)).bytes);
    expect(text[0]).toContain('Strona 1 z 2');
    expect(text[1]).toContain('Strona 2 z 2');
  });

  test('watermark on every page', async ({ page }) => {
    await openTool(page, 'watermark');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await page.locator('.chip', { hasText: 'ORYGINAŁ' }).click();
    const text = await pdfText((await runAndDownload(page)).bytes);
    for (const t of text) expect(t).toContain('ORYGINAŁ');
  });

  test('metadata is read, edited, and other properties are kept', async ({ page }) => {
    await openTool(page, 'metadata');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    const title = page.locator('.option', { hasText: 'Title' }).locator('input');
    await expect(title).toHaveValue('Test invoice');
    await expect(page.locator('.option', { hasText: 'Producer' }).locator('input')).toHaveValue('nyxiontech-pdf-tools tests');
    await title.fill('Faktura 3/10/2026');
    const doc = await loadPdf((await runAndDownload(page)).bytes);
    expect(doc.getTitle()).toBe('Faktura 3/10/2026');
    expect(doc.getProducer()).toBe('nyxiontech-pdf-tools tests');
  });

  test('fill a form with Polish text, then flatten it', async ({ page }) => {
    await openTool(page, 'fill-form');
    await page.locator('.file-drop input').setInputFiles(fixture('form.pdf'));
    await expect(page.getByText('4 fields found')).toBeVisible();
    await page.locator('.option', { has: page.locator('.option-label', { hasText: /^name$/ }) }).locator('input').fill('Zofia Łęcka-Żółć');
    await page.locator('.option', { hasText: 'address' }).locator('textarea').fill('ul. Żurawia 71A\n15-540 Białystok');
    await page.locator('.option', { hasText: 'consent' }).locator('input[type=checkbox]').check();
    await page.locator('.option', { hasText: 'country' }).locator('select').selectOption('Polska');

    const form = (await loadPdf((await runAndDownload(page)).bytes)).getForm();
    expect((form.getField('name') as PDFTextField).getText()).toBe('Zofia Łęcka-Żółć');
    expect((form.getField('consent') as PDFCheckBox).isChecked()).toBe(true);
    expect((form.getField('country') as PDFDropdown).getSelected()).toEqual(['Polska']);

    await page.getByText('Lock the answers').click();
    const flat = (await runAndDownload(page)).bytes;
    expect((await loadPdf(flat)).getForm().getFields()).toHaveLength(0);
    const text = (await pdfText(flat))[0];
    expect(text).toContain('Zofia Łęcka-Żółć');
    expect(text).toContain('Białystok');
  });

  test('a PDF without fields says so', async ({ page }) => {
    await openTool(page, 'fill-form');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await expect(page.getByText('This PDF has no fillable fields')).toBeVisible();
    await expect(page.locator('.run-bar .btn.primary')).toBeDisabled();
  });
});

// Convert and Security tools are tested in convert.spec.ts and security.spec.ts.
test.describe('optimize', () => {
  test('compress: lossless keeps text, strong still gives a valid PDF', async ({ page }) => {
    await openTool(page, 'compress');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await page.getByRole('radio', { name: 'Lossless' }).click();
    expect((await pdfText((await runAndDownload(page)).bytes))[0]).toContain('Invoice');
    await page.getByRole('radio', { name: 'Strong' }).click();
    const strong = await loadPdf((await runAndDownload(page)).bytes);
    expect(strong.getPageCount()).toBe(2);
    await expect(page.locator('.results-note')).toContainText('→');
  });
});

test.describe('review', () => {
  test('compare finds the changed total', async ({ page }) => {
    await openTool(page, 'compare');
    await page.locator('.file-drop input').first().setInputFiles(fixture('invoice.pdf'));
    await page.locator('.file-drop input').first().setInputFiles(fixture('invoice-changed.pdf'));
    await page.locator('.run-bar .btn.primary').click();
    const compare = page.locator('.compare');
    await expect(compare.locator('.results-head b')).toHaveText('2 changed lines; 1 of 2 pages look different.', { timeout: 60_000 });
    await expect(compare.locator('.diff-line.removed')).toContainText('1546.00');
    await expect(compare.locator('.diff-line.added')).toContainText('1600.00');
    await page.getByRole('radio', { name: 'Visual changes' }).click();
    await expect(page.locator('.diff-image')).toHaveCount(2);
  });
});
