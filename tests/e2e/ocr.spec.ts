import { expect, test } from '@playwright/test';
import { makePng, openTool, pdfText, runAndDownload } from './helpers';

// Loads the Tesseract WASM and Polish/English data; the slowest test in the suite.
test('OCR turns a photo of text into a searchable PDF', async ({ page }) => {
  test.setTimeout(180_000);
  await openTool(page, 'ocr');
  await page.locator('.file-drop input').setInputFiles(await makePng(page, 'scan.png', 'text', 'FAKTURA VAT 2026\nBiałystok, ul. Żurawia'));
  const { name, bytes } = await runAndDownload(page);
  expect(name).toBe('scan_ocr.pdf');
  await expect(page.locator('.text-output')).toHaveValue(/FAKTURA/);
  await expect(page.locator('.text-output')).toHaveValue(/Białystok/);

  const [text] = await pdfText(bytes);
  expect(text).toContain('FAKTURA');
  expect(text).toContain('Białystok');
});
