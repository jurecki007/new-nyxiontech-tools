// Dashboard "Convert" section: OCR, Images to PDF, PDF to images, PDF to text, PDF to Word, Word to PDF.
// Outputs are parsed (page boxes, image streams, pixel sizes, docx XML, extracted text), not just downloaded.
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { decodePDFRawStream, PDFArray, PDFDocument, PDFName, PDFRawStream, PDFStream, StandardFonts, type PDFDict } from 'pdf-lib';
import { POLISH } from '../fixture-data';
import { cspViolations, downloadResult, expectRedBlue, fixture, imageHalves, imageSize, loadPdf, makePng, openTool, pdfText, run, runAndDownload, staticFixture, unzip } from './helpers';

const drop = (page: Page) => page.locator('.file-drop input');
const radio = (page: Page, name: string) => page.getByRole('radio', { name, exact: true });
const close = (a: number, b: number, eps = 0.05) => expect(Math.abs(a - b)).toBeLessThan(eps);

/** A solid image (with a transparent hole when `alpha`) encoded by the browser in the given format. */
async function makeImage(page: Page, name: string, w: number, h: number, type: 'png' | 'jpeg' | 'webp', alpha = false) {
  const b64 = await page.evaluate(
    ({ w, h, type, alpha }) => {
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const x = c.getContext('2d')!;
      x.fillStyle = '#2a6fdb';
      x.fillRect(0, 0, w, h);
      if (alpha) x.clearRect(w / 4, h / 4, w / 2, h / 2);
      return c.toDataURL(`image/${type}`, 0.9).split(',')[1];
    },
    { w, h, type, alpha },
  );
  return { name, mimeType: `image/${type}`, buffer: Buffer.from(b64, 'base64') };
}

/** Decoded content stream(s) of a page. */
function contentOf(doc: PDFDocument, index: number): string {
  const contents = doc.getPage(index).node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map((r) => doc.context.lookup(r)) : [contents];
  return streams.map((s) => (s instanceof PDFRawStream ? Buffer.from(decodePDFRawStream(s).decode()).toString('latin1') : '')).join('\n');
}

/** Where each page's image is drawn (composing the cm operators before `Do`) and how it is stored. */
async function imagePages(bytes: Uint8Array) {
  const doc = await loadPdf(bytes);
  return doc.getPages().map((p, i) => {
    const content = contentOf(doc, i);
    const m = /q\s+([\s\S]*?)\/(\S+)\s+Do/.exec(content)!;
    let [a, b, c, d, e, f] = [1, 0, 0, 1, 0, 0];
    for (const cm of m[1].matchAll(/(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm/g)) {
      const [a2, b2, c2, d2, e2, f2] = cm.slice(1).map(Number);
      // New CTM = M × CTM (row-vector convention used by PDF).
      [a, b, c, d, e, f] = [a2 * a + b2 * c, a2 * b + b2 * d, c2 * a + d2 * c, c2 * b + d2 * d, e2 * a + f2 * c + e, e2 * b + f2 * d + f];
    }
    const xobj = p.node.Resources()!.lookup(PDFName.of('XObject')) as PDFDict;
    const img = doc.context.lookup(xobj.get(PDFName.of(m[2]))) as PDFStream;
    const { width, height } = p.getSize();
    return {
      page: { w: width, h: height },
      img: { x: e, y: f, w: a, h: d },
      filter: String(img.dict.get(PDFName.of('Filter'))),
      px: { w: Number(String(img.dict.get(PDFName.of('Width')))), h: Number(String(img.dict.get(PDFName.of('Height')))) },
      smask: img.dict.has(PDFName.of('SMask')),
      /** Raw stream bytes (for DCTDecode, the JPEG file itself). */
      data: img instanceof PDFRawStream ? img.contents : undefined,
    };
  });
}

// ---------------------------------------------------------------------------------------------

test.describe('Images to PDF', () => {
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

  test('A4 + Auto + Small margin: each page follows its image, which is scaled to fit and centred', async ({ page }) => {
    await openTool(page, 'images-to-pdf');
    // Defaults: A4, Auto, Small (20 pt).
    await expect(radio(page, 'A4')).toHaveAttribute('aria-checked', 'true');
    await expect(radio(page, 'Auto')).toHaveAttribute('aria-checked', 'true');
    await expect(radio(page, 'Small')).toHaveAttribute('aria-checked', 'true');
    await drop(page).setInputFiles([await makeImage(page, 'wide.png', 400, 200, 'png'), await makeImage(page, 'tall.png', 200, 400, 'png')]);
    const [wide, tall] = await imagePages((await runAndDownload(page)).bytes);

    close(wide.page.w, 841.89);
    close(wide.page.h, 595.28);
    // 300×150 pt image, scale limited by the width: fills 841.89 − 2×20 across.
    close(wide.img.x, 20);
    close(wide.img.w, 801.89);
    close(wide.img.h, 400.945);
    close(wide.img.y, (595.28 - 400.945) / 2);

    close(tall.page.w, 595.28);
    close(tall.page.h, 841.89);
    // 150×300 pt image, limited by the width as well: 555.28 wide, 1110.56 would be too tall → by height: 801.89 tall.
    close(tall.img.h, 801.89);
    close(tall.img.w, 400.945);
    close(tall.img.y, 20);
    close(tall.img.x, (595.28 - 400.945) / 2);
    expect(tall.px).toEqual({ w: 200, h: 400 });
  });

  test('Portrait and Landscape override the image shape; Letter uses 612×792', async ({ page }) => {
    await openTool(page, 'images-to-pdf');
    await drop(page).setInputFiles([await makeImage(page, 'wide.png', 400, 200, 'png')]);

    await radio(page, 'Portrait').click();
    let [p] = await imagePages((await runAndDownload(page)).bytes);
    close(p.page.w, 595.28);
    close(p.page.h, 841.89);
    close(p.img.w, 555.28);
    close(p.img.x, 20);

    await radio(page, 'Letter').click();
    await radio(page, 'Landscape').click();
    [p] = await imagePages((await runAndDownload(page)).bytes);
    expect(p.page).toEqual({ w: 792, h: 612 });
    // 300×150 pt into 752×572: limited by the width.
    close(p.img.w, 752);
    close(p.img.h, 376);

    await radio(page, 'Portrait').click();
    [p] = await imagePages((await runAndDownload(page)).bytes);
    expect(p.page).toEqual({ w: 612, h: 792 });
  });

  test('"Same as image" sizes the page to the image (96 dpi) plus the margin, and hides Orientation', async ({ page }) => {
    await openTool(page, 'images-to-pdf');
    await drop(page).setInputFiles([await makeImage(page, 'photo.jpg', 400, 200, 'jpeg')]);
    await radio(page, 'Same as image').click();
    await expect(page.locator('.option-label', { hasText: 'Orientation' })).toHaveCount(0);

    await radio(page, 'None').click();
    let [p] = await imagePages((await runAndDownload(page)).bytes);
    expect(p.page).toEqual({ w: 300, h: 150 });
    expect(p.img).toEqual({ x: 0, y: 0, w: 300, h: 150 });

    await radio(page, 'Large').click();
    [p] = await imagePages((await runAndDownload(page)).bytes);
    expect(p.page).toEqual({ w: 400, h: 250 });
    expect(p.img).toEqual({ x: 50, y: 50, w: 300, h: 150 });
  });

  test('Margin None lets the image touch the page edge; Large keeps 50 pt free on A4', async ({ page }) => {
    await openTool(page, 'images-to-pdf');
    await drop(page).setInputFiles([await makeImage(page, 'wide.png', 400, 200, 'png')]);
    await radio(page, 'None').click();
    let [p] = await imagePages((await runAndDownload(page)).bytes);
    close(p.img.x, 0);
    close(p.img.w, 841.89);

    await radio(page, 'Large').click();
    [p] = await imagePages((await runAndDownload(page)).bytes);
    close(p.img.x, 50);
    close(p.img.w, 741.89);
    close(p.img.y, (595.28 - 370.945) / 2);
  });

  test('files can be reordered and removed; the result is named after the first file', async ({ page }) => {
    await openTool(page, 'images-to-pdf');
    await radio(page, 'Same as image').click();
    await radio(page, 'None').click();
    // Distinct sizes identify the pages: 100, 200 and 300 px wide.
    await drop(page).setInputFiles([
      await makeImage(page, 'one.png', 100, 40, 'png'),
      await makeImage(page, 'two.png', 200, 40, 'png'),
      await makeImage(page, 'three.png', 300, 40, 'png'),
    ]);
    const items = page.locator('.file-list li');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0).getByTitle('Move up')).toBeDisabled();
    await expect(items.nth(2).getByTitle('Move down')).toBeDisabled();
    await items.nth(2).getByTitle('Move up').click();
    await items.nth(1).getByTitle('Move up').click();
    await expect(items.locator('.file-name')).toHaveText(['three.png', 'one.png', 'two.png']);
    await expect(items.locator('.file-index')).toHaveText(['1', '2', '3']);

    let out = await runAndDownload(page);
    expect(out.name).toBe('three_and_more.pdf');
    expect((await imagePages(out.bytes)).map((p) => p.page.w)).toEqual([225, 75, 150]);

    await items.nth(0).getByTitle('Remove').click();
    await items.nth(1).getByTitle('Remove').click();
    await expect(items.locator('.file-name')).toHaveText(['one.png']);
    out = await runAndDownload(page);
    expect(out.name).toBe('one.pdf');
    expect((await imagePages(out.bytes)).map((p) => p.page.w)).toEqual([75]);

    // Adding more files appends them to the list.
    await drop(page).setInputFiles([await makeImage(page, 'four.png', 400, 40, 'png')]);
    await expect(items.locator('.file-name')).toHaveText(['one.png', 'four.png']);
  });

  test('JPG, PNG and WebP inputs; PNG transparency is kept', async ({ page }) => {
    await openTool(page, 'images-to-pdf');
    await radio(page, 'Same as image').click();
    await radio(page, 'None').click();
    await drop(page).setInputFiles([
      await makeImage(page, 'a.jpg', 120, 80, 'jpeg'),
      await makeImage(page, 'b.png', 160, 80, 'png', true),
      await makeImage(page, 'c.webp', 200, 80, 'webp'),
    ]);
    const pages = await imagePages((await runAndDownload(page)).bytes);
    expect(pages.map((p) => p.page)).toEqual([
      { w: 90, h: 60 },
      { w: 120, h: 60 },
      { w: 150, h: 60 },
    ]);
    expect(pages.map((p) => p.px)).toEqual([
      { w: 120, h: 80 },
      { w: 160, h: 80 },
      { w: 200, h: 80 },
    ]);
    // JPEG and WebP are stored as JPEG; PNG losslessly with its alpha channel as a soft mask.
    expect(pages.map((p) => p.filter)).toEqual(['/DCTDecode', '/FlateDecode', '/DCTDecode']);
    expect(pages.map((p) => p.smask)).toEqual([false, true, false]);
  });

  // HEIC is decoded by heic-to's CSP build (libheif without eval/new Function), so it
  // works under the app's real Content-Security-Policy that `vite preview` serves.
  test('iPhone HEIC photo becomes a page', async ({ page }) => {
    const csp = cspViolations(page);
    await openTool(page, 'images-to-pdf');
    await radio(page, 'Same as image').click();
    await radio(page, 'None').click();
    // 320×160 px, left half red, right half blue; generated with pillow-heif (see tests/fixtures/README.md).
    await drop(page).setInputFiles({ name: 'sample.heic', mimeType: 'image/heic', buffer: fs.readFileSync(staticFixture('sample.heic')) });
    const out = await runAndDownload(page);
    expect(out.name).toBe('sample.pdf');
    const [p] = await imagePages(out.bytes);
    expect(p.page).toEqual({ w: 240, h: 120 });
    expect(p.px).toEqual({ w: 320, h: 160 });
    expect(p.filter).toBe('/DCTDecode');
    // The embedded JPEG really holds the photo, not a blank or garbled frame.
    const halves = await imageHalves(page, p.data!);
    expect([halves.width, halves.height]).toEqual([320, 160]);
    expectRedBlue(halves);
    expect(csp).toEqual([]);
  });

  test('a corrupt image gives a clear error and no result', async ({ page }) => {
    await openTool(page, 'images-to-pdf');
    await drop(page).setInputFiles([
      await makeImage(page, 'good.png', 100, 50, 'png'),
      { name: 'broken.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('this is not a JPEG at all') },
    ]);
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.run-bar .error-text')).toHaveText('Could not read broken.jpg as an image.');
    await expect(page.locator('.results')).toHaveCount(0);
    // Removing the bad file recovers.
    await page.locator('.file-list li').nth(1).getByTitle('Remove').click();
    await run(page);
    expect((await loadPdf((await downloadResult(page)).bytes)).getPageCount()).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------

test.describe('PDF to images', () => {
  test('PDF to images gives one JPG per page', async ({ page }) => {
    await openTool(page, 'pdf-to-images');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    const files = unzip((await runAndDownload(page)).bytes);
    const names = Object.keys(files).sort();
    expect(names).toEqual(['invoice_page1.jpg', 'invoice_page2.jpg']);
    expect([...files[names[0]].subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
  });

  test('JPG at the default 150 dpi: pixels = page size × 150/72; a rotated page comes out rotated', async ({ page }) => {
    await openTool(page, 'pdf-to-images');
    await expect(radio(page, 'JPG')).toHaveAttribute('aria-checked', 'true');
    await expect(radio(page, 'Standard (150 dpi)')).toHaveAttribute('aria-checked', 'true');
    await drop(page).setInputFiles(fixture('sizes.pdf'));
    await expect(page.locator('.single-file')).toContainText('3 pages');
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('sizes_images.zip');
    const files = unzip(bytes);
    expect(Object.keys(files).sort()).toEqual(['sizes_page1.jpg', 'sizes_page2.jpg', 'sizes_page3.jpg']);
    // Page 1 is A4 (595×842) with /Rotate 90, so it is landscape.
    expect(imageSize(files['sizes_page1.jpg'])).toEqual({ type: 'jpeg', width: 1755, height: 1240 });
    expect(imageSize(files['sizes_page2.jpg'])).toEqual({ type: 'jpeg', width: 1275, height: 1650 });
    expect(imageSize(files['sizes_page3.jpg'])).toEqual({ type: 'jpeg', width: 417, height: 209 });

    // The black square from the page's own top-left corner is at the top-right after a 90° turn.
    const corners = await page.evaluate(async (b64) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/jpeg;base64,${b64}`)).blob());
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const x = c.getContext('2d')!;
      x.drawImage(bmp, 0, 0);
      const lum = (px: number, py: number) => {
        const d = x.getImageData(px, py, 1, 1).data;
        return (d[0] + d[1] + d[2]) / 3;
      };
      return { topLeft: lum(40, 40), topRight: lum(c.width - 40, 40), bottomLeft: lum(40, c.height - 40) };
    }, Buffer.from(files['sizes_page1.jpg']).toString('base64'));
    expect(corners.topRight).toBeLessThan(40);
    expect(corners.topLeft).toBeGreaterThan(215);
    expect(corners.bottomLeft).toBeGreaterThan(215);
  });

  test('PNG at 72 and 300 dpi', async ({ page }) => {
    await openTool(page, 'pdf-to-images');
    await drop(page).setInputFiles(fixture('sizes.pdf'));
    await radio(page, 'PNG').click();
    await radio(page, 'Screen (72 dpi)').click();
    let files = unzip((await runAndDownload(page)).bytes);
    expect(Object.keys(files).sort()).toEqual(['sizes_page1.png', 'sizes_page2.png', 'sizes_page3.png']);
    expect(imageSize(files['sizes_page1.png'])).toEqual({ type: 'png', width: 842, height: 595 });
    expect(imageSize(files['sizes_page2.png'])).toEqual({ type: 'png', width: 612, height: 792 });
    expect(imageSize(files['sizes_page3.png'])).toEqual({ type: 'png', width: 200, height: 100 });

    await radio(page, 'Print (300 dpi)').click();
    await page.getByPlaceholder('e.g. 1, 3-5').fill('2-3');
    files = unzip((await runAndDownload(page)).bytes);
    expect(Object.keys(files).sort()).toEqual(['sizes_page2.png', 'sizes_page3.png']);
    expect(imageSize(files['sizes_page2.png'])).toEqual({ type: 'png', width: 2550, height: 3300 });
    expect(imageSize(files['sizes_page3.png'])).toEqual({ type: 'png', width: 834, height: 417 });
  });

  test('page selection: one page downloads directly, lists keep their order, repeats get unique names', async ({ page }) => {
    await openTool(page, 'pdf-to-images');
    await drop(page).setInputFiles(fixture('sizes.pdf'));
    const pages = page.getByPlaceholder('e.g. 1, 3-5');

    await pages.fill('2');
    let out = await runAndDownload(page);
    expect(out.name).toBe('sizes_page2.jpg');
    expect(imageSize(out.bytes)).toEqual({ type: 'jpeg', width: 1275, height: 1650 });
    await expect(page.locator('.results-head b')).toHaveText('Done: 1 file');

    await pages.fill('3, 1');
    await run(page);
    await expect(page.locator('.results .file-list .file-name')).toHaveText(['sizes_page3.jpg', 'sizes_page1.jpg']);

    await pages.fill('1, 1');
    await run(page);
    out = await downloadResult(page);
    expect(Object.keys(unzip(out.bytes)).sort()).toEqual(['sizes_page1 (2).jpg', 'sizes_page1.jpg']);
  });

  test('a page outside the document or a malformed range is refused', async ({ page }) => {
    await openTool(page, 'pdf-to-images');
    await drop(page).setInputFiles(fixture('sizes.pdf'));
    const pages = page.getByPlaceholder('e.g. 1, 3-5');
    await pages.fill('5');
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.run-bar .error-text')).toHaveText('"5" is outside pages 1–3.');
    await pages.fill('a-b');
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.run-bar .error-text')).toHaveText('"a-b" is not a page or range.');
    await expect(page.locator('.results')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------

test.describe('PDF to text', () => {
  test('PDF to text shows the text of all pages', async ({ page }) => {
    await openTool(page, 'pdf-to-text');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.text-output')).toHaveValue(/Invoice 3\/10\/2026[\s\S]*Second page content/);
  });

  const POLISH_TEXT = [
    [POLISH.heading, POLISH.line1, POLISH.line2, POLISH.para2].join('\n'),
    '',
    [POLISH.page3, POLISH.stdBold, POLISH.stdSmall].join('\n'),
  ].join('\n\n');

  test('keeps Polish diacritics, one line per line, and a blank line between pages (also for an empty page)', async ({ page }) => {
    await openTool(page, 'pdf-to-text');
    await drop(page).setInputFiles(fixture('polish.pdf'));
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.text-output')).toHaveValue(POLISH_TEXT);
    await expect(page.locator('.results-head b')).toHaveText(`${POLISH_TEXT.length} characters`);
  });

  test('Download .txt and Copy give the same UTF-8 text', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await openTool(page, 'pdf-to-text');
    await drop(page).setInputFiles(fixture('polish.pdf'));
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.text-output')).toHaveValue(POLISH_TEXT);

    const { name, bytes } = await downloadResult(page);
    expect(name).toBe('polish.txt');
    expect(new TextDecoder('utf-8', { fatal: true }).decode(bytes)).toBe(POLISH_TEXT);

    await page.getByRole('button', { name: 'Copy' }).click();
    // Windows turns line breaks into CRLF on the clipboard.
    await expect.poll(async () => (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(POLISH_TEXT);
  });

  test('a PDF without text says so, disables the buttons and points to OCR', async ({ page }) => {
    await openTool(page, 'pdf-to-text');
    await drop(page).setInputFiles(fixture('blank.pdf'));
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.results-head b')).toHaveText('No text found');
    await expect(page.locator('.text-output')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copy' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Download .txt' })).toBeDisabled();
    // OCR is a tool in this app now, not "on the roadmap".
    await expect(page.locator('.results .hint')).toContainText('OCR: searchable PDF');
    await expect(page.locator('.results .hint')).not.toContainText('roadmap');
  });
});

// ---------------------------------------------------------------------------------------------

/** Paragraphs of word/document.xml with their text, bold flag, size (half-points) and spacing after. */
function docxParagraphs(xml: string) {
  return [...xml.matchAll(/<w:p>([\s\S]*?)<\/w:p>|<w:p [^>]*>([\s\S]*?)<\/w:p>/g)].map((m) => {
    const body = m[1] ?? m[2];
    const runs = [...body.matchAll(/<w:r>([\s\S]*?)<\/w:r>/g)].map((r) => ({
      text: [...r[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((t) => t[1]).join(''),
      bold: /<w:b\/>|<w:b w:val="(true|1|on)"\/>/.test(r[1]),
      size: Number(/<w:sz w:val="(\d+)"/.exec(r[1])?.[1] ?? NaN),
    }));
    return {
      text: runs.map((r) => r.text).join(''),
      runs,
      after: Number(/<w:spacing [^>]*w:after="(\d+)"/.exec(body)?.[1] ?? 0),
      pageBreak: /<w:br w:type="page"\/>/.test(body),
    };
  });
}

test.describe('PDF to Word', () => {
  test('PDF to Word', async ({ page }) => {
    await openTool(page, 'pdf-to-word');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('invoice.docx');
    const xml = new TextDecoder().decode(unzip(bytes)['word/document.xml']);
    expect(xml).toContain('Invoice 3/10/2026');
    expect(xml).toContain('Second page content');
  });

  test('keeps Polish text, bold and font sizes, one paragraph per line, page breaks between pages', async ({ page }) => {
    await openTool(page, 'pdf-to-word');
    await drop(page).setInputFiles(fixture('polish.pdf'));
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('polish.docx');
    const paras = docxParagraphs(new TextDecoder().decode(unzip(bytes)['word/document.xml']));
    const texts = paras.filter((p) => p.text).map((p) => p.text);
    expect(texts).toEqual([POLISH.heading, POLISH.line1, POLISH.line2, POLISH.para2, POLISH.page3, POLISH.stdBold, POLISH.stdSmall]);
    // Pages 1→2 and 2→3: two page breaks, in order.
    expect(paras.map((p) => (p.pageBreak ? 'BREAK' : p.text)).filter(Boolean)).toEqual([
      POLISH.heading,
      POLISH.line1,
      POLISH.line2,
      POLISH.para2,
      'BREAK',
      'BREAK',
      POLISH.page3,
      POLISH.stdBold,
      POLISH.stdSmall,
    ]);

    const byText = (t: string) => paras.find((p) => p.text === t)!;
    // Sizes in half-points: 20 pt heading, 11 pt body, 14 pt and 9 pt standard-font lines.
    expect(byText(POLISH.heading).runs.every((r) => r.size === 40)).toBe(true);
    expect(byText(POLISH.line1).runs.every((r) => r.size === 22)).toBe(true);
    expect(byText(POLISH.stdBold).runs.every((r) => r.size === 28)).toBe(true);
    expect(byText(POLISH.stdSmall).runs.every((r) => r.size === 18)).toBe(true);
  });

  test('bold text stays bold (embedded and standard fonts), regular text does not', async ({ page }) => {
    await openTool(page, 'pdf-to-word');
    await drop(page).setInputFiles(fixture('polish.pdf'));
    const paras = docxParagraphs(new TextDecoder().decode(unzip((await runAndDownload(page)).bytes)['word/document.xml']));
    const bold = (t: string) => paras.find((p) => p.text === t)!.runs.filter((r) => r.text).every((r) => r.bold);
    expect(bold(POLISH.heading)).toBe(true);
    expect(bold(POLISH.stdBold)).toBe(true);
    expect(bold(POLISH.line1)).toBe(false);
    expect(bold(POLISH.stdSmall)).toBe(false);
  });

  test('a big vertical gap starts a new paragraph with space after the previous one; wrapped lines get none', async ({ page }) => {
    await openTool(page, 'pdf-to-word');
    await drop(page).setInputFiles(fixture('polish.pdf'));
    const paras = docxParagraphs(new TextDecoder().decode(unzip((await runAndDownload(page)).bytes)['word/document.xml']));
    const after = (t: string) => paras.find((p) => p.text === t)!.after;
    // line1 → line2 is 15 pt (a wrapped line), line2 → para2 is 45 pt (a new paragraph).
    expect(after(POLISH.line1)).toBe(0);
    expect(after(POLISH.line2)).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------------------------

test.describe('Word to PDF', () => {
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

  test('preview has headings, bullet and numbered lists, a table, an inline image and formatting', async ({ page }) => {
    await openTool(page, 'word-to-pdf');
    await drop(page).setInputFiles(fixture('rich.docx'));
    const preview = page.locator('.doc-preview');
    await expect(preview.locator('h1')).toHaveText('Raport kwartalny');
    await expect(preview.locator('h2')).toHaveText('Podsumowanie');
    await expect(preview.locator('strong')).toHaveText('Pogrubione:');
    await expect(preview.locator('em')).toHaveText('kursywa');
    await expect(preview).toContainText('zwykły tekst: Żółć.');
    await expect(preview.locator('ul > li')).toHaveText(['Punkt pierwszy', 'Punkt drugi', 'Punkt trzeci']);
    await expect(preview.locator('ol > li')).toHaveText(['Krok jeden', 'Krok dwa']);
    await expect(preview.locator('table tr')).toHaveCount(2);
    await expect(preview.locator('table td')).toHaveText(['Miasto', 'Kwota', 'Gdańsk', '1 234,56 zł']);
    const img = preview.locator('img');
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute('src', /^data:image\/png;base64,/);
    // The embedded image really decodes (40×20 px red).
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth)).toBe(40);
  });

  test('unsafe link targets and HTML-looking text are neutralised; safe links open safely', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await openTool(page, 'word-to-pdf');
    await drop(page).setInputFiles(fixture('rich.docx'));
    const preview = page.locator('.doc-preview');
    await expect(preview.locator('h1')).toBeVisible();

    // The literal text stays text: no script element, no extra image, no handler attributes.
    await expect(preview).toContainText('<script>alert(1)</script> <img src=x onerror=alert(2)>');
    await expect(preview.locator('script')).toHaveCount(0);
    await expect(preview.locator('img')).toHaveCount(1);
    expect(await preview.evaluate((el) => [...el.querySelectorAll('*')].flatMap((n) => n.getAttributeNames()).filter((a) => a.startsWith('on')))).toEqual([]);

    // javascript: (any case, leading space), data: and vbscript: lose their target; the text stays.
    for (const name of ['JS upper', 'Data link', 'VB link']) {
      const a = preview.locator('a', { hasText: name });
      await expect(a).toHaveCount(1);
      expect(await a.getAttribute('href')).toBeNull();
    }
    expect(await preview.evaluate((el) => [...el.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))).toEqual([
      'mailto:biuro@example.com',
      'https://example.com/oferta',
      '#doc-top',
    ]);
    await expect(preview.getByRole('link', { name: 'Web' })).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(preview.getByRole('link', { name: 'Mail us' })).toHaveAttribute('rel', 'noopener noreferrer');
    // In-document links point at the prefixed bookmark id, so they cannot target the app's own elements.
    await expect(preview.locator('#doc-top')).toHaveCount(1);

    await preview.locator('a', { hasText: 'JS upper' }).click();
    await page.waitForTimeout(300);
    expect(dialogs).toEqual([]);
    expect(await page.title()).not.toContain('pwned');
  });

  test('Save as PDF prints the document from a sandboxed frame without scripts; the printout keeps Polish text', async ({ page, context }) => {
    await openTool(page, 'word-to-pdf');
    await drop(page).setInputFiles(fixture('rich.docx'));
    await expect(page.locator('.doc-preview h1')).toBeVisible();
    // Capture the print frame as soon as it is added, and replace its print() with a recorder.
    await page.evaluate(() => {
      const w = window as unknown as { printJob: Promise<{ sandbox: string | null; html: string; title: string }> };
      w.printJob = new Promise((resolve) => {
        new MutationObserver((records, obs) => {
          for (const r of records)
            for (const n of r.addedNodes)
              if (n instanceof HTMLIFrameElement) {
                obs.disconnect();
                n.contentWindow!.print = () =>
                  resolve({ sandbox: n.getAttribute('sandbox'), html: n.contentDocument!.documentElement.outerHTML, title: n.contentDocument!.title });
              }
        }).observe(document.body, { childList: true });
      });
    });
    await page.getByRole('button', { name: /Save as PDF/ }).click();
    const job = await page.evaluate(() => (window as unknown as { printJob: Promise<{ sandbox: string | null; html: string; title: string }> }).printJob);
    expect(job.sandbox!.split(/\s+/).sort()).toEqual(['allow-modals', 'allow-same-origin']);
    expect(job.title).toBe('rich');
    expect(job.html).toContain('@page { size: A4');
    expect(job.html).not.toMatch(/<script/i);
    expect(job.html).not.toMatch(/javascript:/i);

    // What the print dialog would save: render the same document to PDF and read it back.
    const printer = await context.newPage();
    await printer.setContent(job.html);
    const text = (await pdfText(await printer.pdf({ format: 'A4' }))).join('\n');
    await printer.close();
    expect(text).toContain('Raport kwartalny');
    expect(text).toContain('Gdańsk');
    expect(text).toContain('Żółć');
  });

  test('"Change file" clears the previous preview', async ({ page }) => {
    await openTool(page, 'word-to-pdf');
    await drop(page).setInputFiles(fixture('rich.docx'));
    await expect(page.locator('.doc-preview h1')).toHaveText('Raport kwartalny');
    await page.getByRole('button', { name: 'Change file' }).click();
    // The old document must not stay on screen (and "Save as PDF" would have no file name).
    await expect(page.locator('.doc-preview')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Save as PDF/ })).toHaveCount(0);
    await drop(page).setInputFiles(fixture('offer.docx'));
    await expect(page.locator('.doc-preview h1')).toHaveText('Oferta handlowa');
  });

  test('a corrupt .docx or another file type shows an error instead of a preview', async ({ page }) => {
    const errors: Error[] = [];
    page.on('pageerror', (e) => errors.push(e));
    await openTool(page, 'word-to-pdf');
    await drop(page).setInputFiles({ name: 'broken.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('not a zip file') });
    await expect(page.locator('.tool-page > .error-text')).toBeVisible();
    await expect(page.locator('.doc-preview')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Save as PDF/ })).toHaveCount(0);

    // A PDF renamed .docx is no better.
    await page.getByRole('button', { name: 'Change file' }).click();
    await drop(page).setInputFiles({ name: 'invoice.docx', mimeType: 'application/octet-stream', buffer: fs.readFileSync(fixture('invoice.pdf')) });
    await expect(page.locator('.tool-page > .error-text')).toBeVisible();
    await expect(page.locator('.doc-preview')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------------

/** A two-page PDF: page 1 has a real text layer, page 2 is only an image of text (a "scan"). */
async function mixedScan(page: Page): Promise<Buffer> {
  const png = await makePng(page, 'scan.png', 'text', 'SCANNED INVOICE 2026\nTotal amount due');
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText('This page already has a real text layer.', { x: 50, y: 780, size: 14, font });
  const img = await doc.embedPng(png.buffer);
  doc.addPage([1050, 300]).drawImage(img, { x: 0, y: 0, width: 1050, height: 300 });
  return Buffer.from(await doc.save());
}

/** Language data files the OCR worker downloads. */
function trackTessdata(page: Page) {
  const langs = new Set<string>();
  page.context().on('request', (r) => {
    const m = /tessdata\/(\w+)\.traineddata/.exec(r.url());
    if (m) langs.add(m[1]);
  });
  return langs;
}

test.describe('OCR', () => {
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

  test('scanned PDF (English, Fast): text page is skipped, the scan gets an invisible text layer, pages look the same', async ({ page }) => {
    test.setTimeout(180_000);
    const langs = trackTessdata(page);
    await openTool(page, 'ocr');
    const input = await mixedScan(page);
    await drop(page).setInputFiles({ name: 'mixed.pdf', mimeType: 'application/pdf', buffer: input });
    await radio(page, 'English').click();
    await radio(page, 'Fast').click();
    await expect(page.getByLabel('Skip pages that already contain text')).toBeChecked();
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('mixed_ocr.pdf');
    await expect(page.locator('.results-note')).toContainText('Skipped 1 page(s) that already had text: 1.');
    await expect(page.locator('.text-output')).toHaveValue(/SCANNED INVOICE 2026/);
    await expect(page.locator('.text-output')).not.toHaveValue(/already has a real text layer/);

    const [before, after] = [await loadPdf(input), await loadPdf(bytes)];
    expect(after.getPageCount()).toBe(2);
    expect(after.getPages().map((p) => p.getSize())).toEqual(before.getPages().map((p) => p.getSize()));
    // Page 1 is untouched; page 2 keeps its original drawing (the image, wrapped in q…Q
    // by pdf-lib) and gains invisible text (text render mode 3) after it.
    expect(contentOf(after, 0)).toBe(contentOf(before, 0));
    const original = contentOf(before, 1);
    const scan = contentOf(after, 1);
    expect(original).toMatch(/\/\S+ Do/);
    expect(scan).toContain(original);
    expect(scan.slice(scan.indexOf(original) + original.length)).toMatch(/\b3 Tr\b[\s\S]*\bTj\b/);
    const text = await pdfText(bytes);
    expect(text[0].match(/already has a real text layer/g)).toHaveLength(1);
    expect(text[1]).toContain('SCANNED');
    expect(text[1]).toContain('INVOICE');

    expect([...langs]).toEqual(['eng']);
  });

  test('"Skip pages that already contain text" off: every page is recognised (Polish only)', async ({ page }) => {
    test.setTimeout(180_000);
    const langs = trackTessdata(page);
    await openTool(page, 'ocr');
    await drop(page).setInputFiles({ name: 'mixed.pdf', mimeType: 'application/pdf', buffer: await mixedScan(page) });
    await radio(page, 'Polish').click();
    await radio(page, 'Fast').click();
    await page.getByLabel('Skip pages that already contain text').uncheck();
    const { bytes } = await runAndDownload(page);
    await expect(page.locator('.results-note')).not.toContainText('Skipped');
    await expect(page.locator('.text-output')).toHaveValue(/already has a real text layer[\s\S]*SCANNED/);
    // The real text plus the invisible recognised copy.
    expect((await pdfText(bytes))[0].match(/already/g)!.length).toBeGreaterThanOrEqual(2);
    expect([...langs]).toEqual(['pol']);
  });

  test('several photos become one PDF in the chosen order', async ({ page }) => {
    test.setTimeout(180_000);
    await openTool(page, 'ocr');
    await drop(page).setInputFiles([await makePng(page, 'first.png', 'text', 'ALPHA PAGE'), await makePng(page, 'second.png', 'text', 'OMEGA PAGE')]);
    await page.locator('.file-list li').nth(1).getByTitle('Move up').click();
    await radio(page, 'Fast').click();
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('second_ocr.pdf');
    await expect(page.locator('.text-output')).toHaveValue(/OMEGA[\s\S]*ALPHA/);
    const doc = await loadPdf(bytes);
    // "Same as image" pages: 1400×400 px at 96 dpi.
    expect(doc.getPages().map((p) => p.getSize())).toEqual([
      { width: 1050, height: 300 },
      { width: 1050, height: 300 },
    ]);
    const text = await pdfText(bytes);
    expect(text[0]).toContain('OMEGA');
    expect(text[1]).toContain('ALPHA');
  });

  test('an iPhone HEIC photo is accepted next to other photos', async ({ page }) => {
    test.setTimeout(180_000);
    await openTool(page, 'ocr');
    await drop(page).setInputFiles([
      { name: 'sample.heic', mimeType: 'image/heic', buffer: fs.readFileSync(staticFixture('sample.heic')) },
      await makePng(page, 'second.png', 'text', 'OMEGA PAGE'),
    ]);
    await radio(page, 'Fast').click();
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('sample_ocr.pdf');
    await expect(page.locator('.text-output')).toHaveValue(/OMEGA/);
    // The 320×160 px HEIC becomes a 240×120 pt page (96 dpi), followed by the text photo.
    expect((await loadPdf(bytes)).getPages().map((p) => p.getSize())).toEqual([
      { width: 240, height: 120 },
      { width: 1050, height: 300 },
    ]);
  });

  test('input rules: one PDF at a time, and not mixed with photos', async ({ page }) => {
    await openTool(page, 'ocr');
    const runButton = page.locator('.run-bar .btn.primary');
    await expect(runButton).toBeDisabled();
    await drop(page).setInputFiles([fixture('invoice.pdf'), fixture('blank.pdf')]);
    await expect(page.locator('.tool-page > .error-text')).toHaveText('Add one PDF at a time (or only images).');
    await expect(runButton).toBeDisabled();
    await page.locator('.file-list li').nth(1).getByTitle('Remove').click();
    await expect(runButton).toBeEnabled();
    await drop(page).setInputFiles(await makePng(page, 'photo.png', 'logo'));
    await expect(runButton).toBeDisabled();
  });
});
