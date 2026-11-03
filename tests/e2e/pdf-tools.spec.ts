import { expect, test } from '@playwright/test';
import { PDFDict, PDFHexString, PDFName, PDFString, type PDFCheckBox, type PDFDropdown, type PDFTextField } from 'pdf-lib';
import { fileContains, fixture, loadPdf, makePng, needsPassword, openTool, pdfjsTitle, pdfText, runAndDownload, unzip } from './helpers';

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

test.describe('convert', () => {
  test('images to PDF: one A4 page per image', async ({ page }) => {
    await openTool(page, 'images-to-pdf');
    const a = await makePng(page, 'a.png', 'logo');
    const b = await makePng(page, 'b.png', 'subject');
    await page.locator('.file-drop input').setInputFiles([a, b]);
    const doc = await loadPdf((await runAndDownload(page)).bytes);
    expect(doc.getPageCount()).toBe(2);
    // Landscape images get landscape A4 with orientation "Auto".
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
  });

  test('PDF to images gives one JPG per page', async ({ page }) => {
    await openTool(page, 'pdf-to-images');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    const files = unzip((await runAndDownload(page)).bytes);
    const names = Object.keys(files).sort();
    expect(names).toEqual(['invoice_page1.jpg', 'invoice_page2.jpg']);
    expect([...files[names[0]].subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  test('PDF to text shows the text of all pages', async ({ page }) => {
    await openTool(page, 'pdf-to-text');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.text-output')).toHaveValue(/Invoice 3\/10\/2026[\s\S]*Second page content/);
  });

  test('PDF to Word', async ({ page }) => {
    await openTool(page, 'pdf-to-word');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('invoice.docx');
    const xml = new TextDecoder().decode(unzip(bytes)['word/document.xml']);
    expect(xml).toContain('Invoice 3/10/2026');
    expect(xml).toContain('Second page content');
  });

  test('Word to PDF previews Polish text and tables', async ({ page }) => {
    await openTool(page, 'word-to-pdf');
    await page.locator('.file-drop input').setInputFiles(fixture('offer.docx'));
    const preview = page.locator('.doc-preview');
    await expect(preview.getByRole('heading', { name: 'Oferta handlowa' })).toBeVisible();
    await expect(preview).toContainText('Zażółć gęślą jaźń');
    await expect(preview.locator('table')).toContainText('145,00 EUR');
    await expect(page.getByRole('button', { name: /Save as PDF/ })).toBeVisible();
  });

  test('Word to PDF drops javascript: links and keeps web links', async ({ page }) => {
    await openTool(page, 'word-to-pdf');
    await page.locator('.file-drop input').setInputFiles(fixture('links.docx'));
    const preview = page.locator('.doc-preview');
    await expect(preview).toContainText('Run script');
    await expect(preview.locator('a[href^="javascript"]')).toHaveCount(0);
    await expect(preview.getByRole('link', { name: 'Website' })).toHaveAttribute('href', 'https://example.com/');
  });

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

test.describe('security', () => {
  test('protect, reject a wrong password, then unlock', async ({ page }) => {
    await openTool(page, 'protect');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    const pw = page.locator('input[type=password]');
    await pw.nth(0).fill('Tajne123');
    await pw.nth(1).fill('Inne');
    await expect(page.getByText('The passwords do not match.')).toBeVisible();
    await expect(page.locator('.run-bar .btn.primary')).toBeDisabled();
    await pw.nth(1).fill('Tajne123');
    const locked = (await runAndDownload(page)).bytes;
    expect(await needsPassword(locked)).toBe(true);

    await openTool(page, 'unlock');
    await page.locator('.file-drop input').setInputFiles({ name: 'locked.pdf', mimeType: 'application/pdf', buffer: locked });
    await page.locator('input[type=password]').fill('wrong');
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.run-bar .error-text')).toContainText('Wrong password');
    await page.locator('input[type=password]').fill('Tajne123');
    expect((await pdfText((await runAndDownload(page)).bytes))[0]).toContain('Invoice 3/10/2026');
  });

  test('tools explain that a protected PDF must be unlocked first', async ({ page }) => {
    await openTool(page, 'protect');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await page.locator('input[type=password]').nth(0).fill('x');
    await page.locator('input[type=password]').nth(1).fill('x');
    const locked = (await runAndDownload(page)).bytes;

    await openTool(page, 'rotate');
    await page.locator('.file-drop input').setInputFiles({ name: 'locked.pdf', mimeType: 'application/pdf', buffer: locked });
    await expect(page.locator('.single-file .error-text')).toContainText('password-protected');
  });

  test('redaction removes the text, not just covers it', async ({ page }) => {
    await openTool(page, 'redact');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await expect(page.locator('.redact-sheet svg').first()).toBeVisible();
    await page.locator('.chip', { hasText: 'Bank account numbers' }).click();
    await page.locator('.chip', { hasText: 'E-mail addresses' }).click();
    await page.locator('.option input.text-field').fill('Example Corporation');
    await page.getByRole('button', { name: 'Mark' }).click();
    await expect(page.locator('.redact-toolbar b')).toHaveText('3 areas to redact');

    const text = await pdfText((await runAndDownload(page)).bytes);
    // The redacted page is an image now; the untouched page keeps its text.
    expect(text[0]).not.toContain('PL88');
    expect(text[0]).not.toContain('Example Corporation');
    expect(text[0]).not.toContain('billing@example.com');
    expect(text[1]).toContain('Second page content');
  });

  test('redaction leaves no hidden copy of a page that another page links to', async ({ page }) => {
    await openTool(page, 'redact');
    await page.locator('.file-drop input').setInputFiles(fixture('linked.pdf'));
    await expect(page.locator('.redact-sheet svg').first()).toBeVisible();
    await page.locator('.option input.text-field').fill('SECRET-PAGE-TWO');
    await page.getByRole('button', { name: 'Mark' }).click();
    await expect(page.locator('.redact-toolbar b')).toHaveText('1 area to redact');

    const { bytes } = await runAndDownload(page);
    const text = await pdfText(bytes);
    expect(text[0]).toContain('Table of contents');
    expect(await fileContains(bytes, 'SECRET-PAGE-TWO')).toBe(false);
  });

  test('protect encrypts strings outside the page content too', async ({ page }) => {
    await openTool(page, 'protect');
    await page.locator('.file-drop input').setInputFiles(fixture('plain-strings.pdf'));
    await page.locator('input[type=password]').nth(0).fill('x');
    await page.locator('input[type=password]').nth(1).fill('x');
    const locked = (await runAndDownload(page)).bytes;
    expect(await needsPassword(locked)).toBe(true);
    expect(await fileContains(locked, 'LEAK-ANNOT')).toBe(false);
    expect(await fileContains(locked, 'LEAK-INFO')).toBe(false);
    expect(await pdfjsTitle(locked, 'x')).toBe('LEAK-INFO');

    // The strings decrypt back to the originals.
    await openTool(page, 'unlock');
    await page.locator('.file-drop input').setInputFiles({ name: 'locked.pdf', mimeType: 'application/pdf', buffer: locked });
    await page.locator('input[type=password]').fill('x');
    const doc = await loadPdf((await runAndDownload(page)).bytes);
    expect(doc.getTitle()).toBe('LEAK-INFO');
    const annot = doc.getPage(0).node.Annots()!.lookup(0, PDFDict);
    expect(annot.lookup(PDFName.of('Contents'), PDFString, PDFHexString).decodeText()).toBe('LEAK-ANNOT');
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
