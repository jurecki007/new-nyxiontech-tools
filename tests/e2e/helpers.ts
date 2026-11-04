import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { decodePDFRawStream, PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRawStream, PDFString, type PDFObject } from 'pdf-lib';
import { toolPath, type ToolId } from '../../src/utilities/routes';
import { PDFDocument as CantooDocument, PDFHexString as CantooHexString, PDFString as CantooString, StandardFonts } from '@cantoo/pdf-lib';

export const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.fixtures');
export const fixture = (name: string) => path.join(FIXTURES, name);
/** Checked-in sample files (tests/fixtures), as opposed to the generated ones above. */
export const staticFixture = (name: string) => path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', name);

/** Opens a dashboard tool with fresh state, at its public address (e.g. /merge-pdf). */
export async function openTool(page: Page, id: ToolId) {
  await page.goto('about:blank');
  await page.goto(toolPath(id, 'en'));
  await expect(page.locator('.tool-page')).toBeVisible();
}

/** Clicks the tool's run button and waits for results (fails on a shown error). */
export async function run(page: Page) {
  const button = page.locator('.run-bar .btn.primary');
  await button.click();
  // On a re-run the previous results are still shown, so wait for the job itself to finish.
  await expect(button).not.toHaveText('Working…', { timeout: 100_000 });
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
    // Objects packed in compressed object streams are only readable once parsed:
    // search every object's own text (dictionaries, strings, arrays) as well.
    chunks.push(obj instanceof PDFRawStream ? obj.dict.toString() : obj.toString());
    for (const s of strings(obj)) chunks.push(s);
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

/** Decoded text of every string inside an object (literal escapes and UTF-16 resolved). */
function strings(obj: PDFObject | undefined, out: string[] = []): string[] {
  if (obj instanceof PDFString || obj instanceof PDFHexString) out.push(obj.decodeText());
  else if (obj instanceof PDFArray) for (const v of obj.asArray()) strings(v, out);
  else if (obj instanceof PDFDict) for (const [, v] of obj.entries()) strings(v, out);
  else if (obj instanceof PDFRawStream) strings(obj.dict, out);
  return out;
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

// pdf.js 5+ insists on a trailing '/' (not path.sep); Node's fs accepts mixed separators on Windows.
const STANDARD_FONTS = path.join(path.dirname(fileURLToPath(import.meta.resolve('pdfjs-dist/package.json'))), 'standard_fonts') + '/';

async function openWithPdfjs(bytes: Uint8Array, password?: string) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs.getDocument({ data: new Uint8Array(bytes), password, isEvalSupported: false, standardFontDataUrl: STANDARD_FONTS }).promise;
}

/** Document title as pdf.js reads it (an independent check of decryption). */
export async function pdfjsTitle(bytes: Uint8Array, password?: string): Promise<string | undefined> {
  const doc = await openWithPdfjs(bytes, password);
  const { info } = await doc.getMetadata();
  await doc.loadingTask.destroy();
  return (info as { Title?: string }).Title;
}

/** Whether pdf.js asks for a password to open the file. */
export async function needsPassword(bytes: Uint8Array): Promise<boolean> {
  try {
    await (await openWithPdfjs(bytes)).loadingTask.destroy();
    return false;
  } catch (e) {
    return (e as Error).name === 'PasswordException';
  }
}

/** pdf.js permission flags (PermissionFlag values), or null when the file sets no restrictions. */
export async function pdfjsPermissions(bytes: Uint8Array, password?: string): Promise<number[] | null> {
  const doc = await openWithPdfjs(bytes, password);
  const perms = await doc.getPermissions();
  await doc.loadingTask.destroy();
  return perms ? Array.from(perms) : null;
}

/** Pixel size of a PNG (IHDR) or JPEG (first SOFn marker). */
export function imageSize(bytes: Uint8Array): { type: 'png' | 'jpeg'; width: number; height: number } {
  const b = Buffer.from(bytes);
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { type: 'png', width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  if (b[0] !== 0xff || b[1] !== 0xd8) throw new Error('Neither PNG nor JPEG');
  for (let i = 2; i < b.length; ) {
    if (b[i] !== 0xff) throw new Error(`Bad JPEG marker at ${i}`);
    const marker = b[i + 1];
    const len = b.readUInt16BE(i + 2);
    // SOF0..SOF15 except DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { type: 'jpeg', height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('No JPEG frame header');
}

/** Text of every page, extracted with pdf.js in Node. */
export async function pdfText(bytes: Uint8Array, password?: string): Promise<string[]> {
  const doc = await openWithPdfjs(bytes, password);
  const pages: string[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    pages.push(content.items.map((i) => ('str' in i ? i.str : '')).join(' '));
  }
  await doc.loadingTask.destroy();
  return pages;
}

/**
 * An AES-256 PDF locked outside the app (by @cantoo/pdf-lib directly), for testing Unlock
 * on its own. That library encrypts streams but writes strings in clear text, which every
 * reader then "decrypts" into garbage, so the document info strings are encrypted here with
 * the object's key, as ISO 32000 requires (the app's Protect does the same for all strings).
 */
export async function lockedPdf(o: {
  user: string;
  owner: string;
  text: string;
  info?: { title?: string; author?: string; producer?: string };
  permissions?: { printing?: boolean; copying?: boolean; modifying?: boolean };
}): Promise<Uint8Array> {
  const doc = await CantooDocument.create({ updateMetadata: false });
  if (o.info?.title) doc.setTitle(o.info.title);
  if (o.info?.author) doc.setAuthor(o.info.author);
  if (o.info?.producer) doc.setProducer(o.info.producer);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([595, 842]).drawText(o.text, { x: 50, y: 780, size: 12, font });
  doc.encrypt({ userPassword: o.user, ownerPassword: o.owner, permissions: o.permissions ?? { printing: false, copying: false, modifying: false } });
  const ref = doc.context.trailerInfo.Info as { objectNumber: number; generationNumber: number } | undefined;
  if (ref) {
    const info = doc.context.lookup(ref as never) as unknown as { entries(): [unknown, unknown][]; set(k: unknown, v: unknown): void };
    const encrypt = doc.context.security!.getEncryptFn(ref.objectNumber, ref.generationNumber);
    for (const [key, value] of info.entries()) {
      if (value instanceof CantooString || value instanceof CantooHexString) {
        info.set(key, CantooHexString.of(Buffer.from(encrypt(value.asBytes())).toString('hex')));
      }
    }
  }
  return doc.save({ useObjectStreams: false });
}

export const unzip =(bytes: Uint8Array): Record<string, Uint8Array> => unzipSync(new Uint8Array(bytes));

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

/**
 * Decodes an image (JPEG/PNG/WebP bytes) in the browser and returns its size and
 * the average colour of its left and right quarters (used for the red|blue HEIC sample).
 */
export async function imageHalves(page: Page, bytes: Uint8Array, mime = 'image/jpeg') {
  return page.evaluate(
    async ({ b64, mime }) => {
      const bmp = await createImageBitmap(await (await fetch(`data:${mime};base64,${b64}`)).blob());
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      const x = c.getContext('2d')!;
      x.drawImage(bmp, 0, 0);
      const avg = (x0: number) => {
        const d = x.getImageData(x0, Math.round(c.height / 4), Math.round(c.width / 4), Math.round(c.height / 2)).data;
        const sum = [0, 0, 0];
        for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) sum[k] += d[i + k];
        return sum.map((s) => Math.round(s / (d.length / 4)));
      };
      return { width: bmp.width, height: bmp.height, left: avg(Math.round(c.width / 8)), right: avg(Math.round((c.width * 5) / 8)) };
    },
    { b64: Buffer.from(bytes).toString('base64'), mime },
  );
}

/** Asserts a decoded HEIC sample is the left-red / right-blue picture from tests/fixtures. */
export function expectRedBlue(halves: { left: number[]; right: number[] }) {
  const [lr, lg, lb] = halves.left;
  const [rr, rg, rb] = halves.right;
  // Source colours: (220, 30, 30) and (30, 60, 220); allow for HEIC/JPEG compression.
  expect(lr).toBeGreaterThan(180);
  expect(Math.max(lg, lb)).toBeLessThan(80);
  expect(rb).toBeGreaterThan(180);
  expect(Math.max(rr, rg)).toBeLessThan(100);
}

/** Collects Content-Security-Policy violations the page reports in its console. */
export function cspViolations(page: Page): string[] {
  const found: string[] = [];
  page.on('console', (m) => {
    if (/Content Security Policy|unsafe-eval/i.test(m.text())) found.push(m.text());
  });
  return found;
}
