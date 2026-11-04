import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { openTool, staticFixture } from './helpers';

// pdf.js decodes JPEG 2000 (JPXDecode) and JBIG2 (JBIG2Decode) images with
// WebAssembly modules it fetches from `wasmUrl` at runtime. When that breaks it
// skips the image with only a console warning and the page renders blank, so
// check the pixels as well as the console. Samples: tests/fixtures/README.md.
const SAMPLES = [
  { codec: 'JPEG 2000', file: 'bug_jpx.pdf' },
  { codec: 'JBIG2', file: 'jbig2_symbol_offset.pdf' },
];

const DECODE_PROBLEM = /Unable to decode image|JpxError|Jbig2Error|OpenJPEG|wasm/i;

/** Share of dark pixels and the spread of luminance on the first page's canvas. */
function canvasStats(page: Page) {
  return page
    .locator('.page-sheet canvas')
    .first()
    .evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
      const n = d.length / 4;
      let dark = 0;
      let sum = 0;
      let sq = 0;
      for (let i = 0; i < d.length; i += 4) {
        // Composite over white, like the page sheet shows it.
        const a = d[i + 3] / 255;
        const lum = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) * a + 255 * (1 - a);
        if (lum < 128) dark++;
        sum += lum;
        sq += lum * lum;
      }
      const mean = sum / n;
      return { dark: dark / n, stddev: Math.sqrt(sq / n - mean * mean) };
    });
}

test.describe('image codecs', () => {
  for (const { codec, file } of SAMPLES) {
    test(`renders a PDF with ${codec} images`, async ({ page }, testInfo) => {
      const problems: string[] = [];
      // pdf.js reports decoder failures from its worker; Playwright surfaces those here too.
      page.on('console', (m) => {
        if (DECODE_PROBLEM.test(m.text())) problems.push(`${m.type()}: ${m.text()}`);
      });
      page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

      await openTool(page, 'edit');
      await page.locator('.file-drop input').setInputFiles(staticFixture(file));
      const canvas = page.locator('.page-sheet canvas').first();
      await expect(canvas).toBeVisible();

      // Rendering is asynchronous: wait for the image to appear on the canvas.
      await expect.poll(async () => (await canvasStats(page)).dark).toBeGreaterThan(0.002);
      expect((await canvasStats(page)).stddev).toBeGreaterThan(10);
      expect(problems).toEqual([]);

      const png = await canvas.evaluate((c: HTMLCanvasElement) => c.toDataURL('image/png').split(',')[1]);
      await testInfo.attach(`${path.parse(file).name}.png`, { body: Buffer.from(png, 'base64'), contentType: 'image/png' });
    });
  }
});
