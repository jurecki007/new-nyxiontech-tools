import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { decodePDFRawStream, PDFDict, PDFDocument, PDFName, PDFRawStream } from 'pdf-lib';

export const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.fixtures');
export const fixture = (name: string) => path.join(FIXTURES, name);

/** Opens a dashboard tool with fresh state. */
export async function openTool(page: Page, id: string) {
  await page.goto('about:blank');
  await page.goto(`/#/tool/${id}`);
  await expect(page.locator('.tool-page')).toBeVisible();
}

/** Clicks the tool's run button and waits for results (fails on a shown error). */
export async function run(page: Page) {
  await page.locator('.run-bar .btn.primary').click();
  await expect(page.locator('.results, .run-bar .error-text').first()).toBeVisible({ timeout: 100_000 });
  await expect(page.locator('.run-bar .error-text')).toHaveCount(0);
}

/** Downloads the result (the single file, or the zip of several) and returns its name and bytes. */
export async function downloadResult(page: Page): Promise<{ name: string; bytes: Buffer }> {
  const button = page.locator('.results-head button', { hasText: /Download/ }).last();
  const [download] = await Promise.all([page.waitForEvent('download'), button.click()]);
  return { name: download.suggestedFilename(), bytes: fs.readFileSync((await download.path())!) };
}

export async function runAndDownload(page: Page) {
  await run(page);
  return downloadResult(page);
}

/** Loads a PDF without pdf-lib rewriting its producer/creator metadata. */
export const loadPdf = (bytes: Uint8Array) => PDFDocument.load(bytes, { updateMetadata: false });

/**
 * Whether a string appears anywhere in the file: in the raw bytes or in any
 * decompressed stream, as literal, hex or UTF-16 hex text. Finds hidden copies
 * that text extraction from the page tree would miss.
 */
export async function fileContains(bytes: Uint8Array, marker: string): Promise<boolean> {
  const chunks = [Buffer.from(bytes).toString('latin1')];
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    try {
      chunks.push(Buffer.from(decodePDFRawStream(obj).decode()).toString('latin1'));
    } catch {
      // encrypted or unsupported filter: the raw bytes are already included
    }
  }
  const haystack = chunks.join('\n').toLowerCase();
  const forms = [marker, Buffer.from(marker, 'latin1').toString('hex'), 'feff' + Buffer.from(marker, 'utf16le').swap16().toString('hex')];
  return forms.some((f) => haystack.includes(f.toLowerCase()));
}

/** Base font names of every font in the document (object streams included). */
export async function fontNames(bytes: Uint8Array): Promise<string[]> {
  const doc = await loadPdf(bytes);
  const names: string[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict) || obj.get(PDFName.of('Type')) !== PDFName.of('Font')) continue;
    const base = obj.get(PDFName.of('BaseFont'));
    if (base instanceof PDFName) names.push(base.decodeText());
  }
  return names;
}

const STANDARD_FONTS = path.join(path.dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json'))), 'standard_fonts') + path.sep;

async function openWithPdfjs(bytes: Uint8Array, password?: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs.getDocument({ data: new Uint8Array(bytes), password, isEvalSupported: false, standardFontDataUrl: STANDARD_FONTS }).promise;
}

/** Document title as pdf.js reads it (an independent check of decryption). */
export async function pdfjsTitle(bytes: Uint8Array, password?: string): Promise<string | undefined> {
  const doc = await openWithPdfjs(bytes, password);
  const { info } = await doc.getMetadata();
  await doc.destroy();
  return (info as { Title?: string }).Title;
}

/** Whether pdf.js asks for a password to open the file. */
export async function needsPassword(bytes: Uint8Array): Promise<boolean> {
  try {
    await (await openWithPdfjs(bytes)).destroy();
    return false;
  } catch (e) {
    return (e as Error).name === 'PasswordException';
  }
}

/** Text of every page, extracted with pdf.js in Node. */
export async function pdfText(bytes: Uint8Array): Promise<string[]> {
  const doc = await openWithPdfjs(bytes);
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map((i) => ('str' in i ? i.str : '')).join(' '));
  }
  await doc.destroy();
  return pages;
}

export const unzip = (bytes: Uint8Array): Record<string, Uint8Array> => unzipSync(new Uint8Array(bytes));

/** Draws a PNG in the browser (Node has no canvas) and returns it as a file payload. */
export async function makePng(page: Page, name: string, draw: 'text' | 'subject' | 'logo', text = '') {
  const b64 = await page.evaluate(
    ({ draw, text }) => {
      const c = document.createElement('canvas');
      const x = c.getContext('2d')!;
      if (draw === 'text') {
        c.width = 1400;
        c.height = 400;
        x.fillStyle = '#fff';
        x.fillRect(0, 0, c.width, c.height);
        x.fillStyle = '#000';
        x.font = '64px Arial';
        text.split('\n').forEach((line, i) => x.fillText(line, 60, 120 + i * 110));
      } else if (draw === 'subject') {
        // A red disc on a gradient: something a salient-object model should cut out.
        c.width = 600;
        c.height = 400;
        const g = x.createLinearGradient(0, 0, 600, 400);
        g.addColorStop(0, '#9ec5e8');
        g.addColorStop(1, '#e8d39e');
        x.fillStyle = g;
        x.fillRect(0, 0, 600, 400);
        x.fillStyle = '#c0392b';
        x.beginPath();
        x.arc(300, 210, 120, 0, Math.PI * 2);
        x.fill();
      } else {
        // A blue logo block on white paper.
        c.width = 400;
        c.height = 200;
        x.fillStyle = '#fff';
        x.fillRect(0, 0, 400, 200);
        x.fillStyle = '#1f3fae';
        x.fillRect(100, 50, 200, 100);
      }
      return c.toDataURL('image/png').split(',')[1];
    },
    { draw, text },
  );
  return { name, mimeType: 'image/png', buffer: Buffer.from(b64, 'base64') };
}

/** Share of fully transparent and fully opaque pixels in a PNG, measured in the browser. */
export async function alphaStats(page: Page, png: Buffer): Promise<{ transparent: number; opaque: number }> {
  return page.evaluate(async (b64) => {
    const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    const x = c.getContext('2d')!;
    x.drawImage(bmp, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    let t = 0;
    let o = 0;
    for (let i = 3; i < d.length; i += 4) {
      if (d[i] < 20) t++;
      else if (d[i] > 235) o++;
    }
    const n = d.length / 4;
    return { transparent: t / n, opaque: o / n };
  }, png.toString('base64'));
}
