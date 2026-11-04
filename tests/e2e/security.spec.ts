// Dashboard "Security" section: Protect PDF, Unlock PDF, Redact PDF.
// Encryption is checked in the file itself (the /Encrypt dictionary, /P flags, and the
// AES-256 password records verified independently with ISO 32000-2 Algorithm 2.B), and
// redaction by looking for the secret in every decoded object and at the burnt-in pixels.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import {
  decodePDFRawStream,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFString,
  StandardFonts,
} from 'pdf-lib';
import { PATTERN_LAYOUT, PATTERN_PAGES, SECRET } from '../fixture-data';
import {
  downloadResult,
  fileContains,
  fixture,
  loadPdf,
  lockedPdf,
  needsPassword,
  openTool,
  pdfjsPermissions,
  pdfjsTitle,
  pdfText,
  run,
  runAndDownload,
} from './helpers';

const drop = (page: Page) => page.locator('.file-drop input');
const asFile = (name: string, buffer: Uint8Array) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(buffer) });

// ---- Encryption dictionary --------------------------------------------------------------------

/** The trailer's /Encrypt dictionary as plain values (bytes for strings). */
async function encryptDict(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const ref = doc.context.trailerInfo.Encrypt;
  if (!ref) return null;
  const dict = doc.context.lookup(ref, PDFDict);
  const num = (k: string) => (dict.lookup(PDFName.of(k)) as PDFNumber | undefined)?.asNumber();
  const str = (k: string) => Buffer.from((dict.lookup(PDFName.of(k), PDFString, PDFHexString) as PDFString | PDFHexString).asBytes());
  const stdCF = (dict.lookup(PDFName.of('CF'), PDFDict).lookup(PDFName.of('StdCF'), PDFDict));
  return {
    filter: String(dict.get(PDFName.of('Filter'))),
    V: num('V'),
    R: num('R'),
    Length: num('Length'),
    cfm: String(stdCF.get(PDFName.of('CFM'))),
    cfLength: (stdCF.lookup(PDFName.of('Length')) as PDFNumber).asNumber(),
    stmF: String(dict.get(PDFName.of('StmF'))),
    strF: String(dict.get(PDFName.of('StrF'))),
    P: num('P')!,
    O: str('O'),
    U: str('U'),
    OE: str('OE'),
    UE: str('UE'),
    Perms: str('Perms'),
    catalog: doc.catalog,
    header: Buffer.from(bytes.subarray(0, 8)).toString('latin1'),
  };
}

/** ISO 32000-2 Algorithm 2.B: the hash behind /U and /O of a revision 6 (AES-256) handler. */
function hash2B(password: Buffer, salt: Buffer, udata: Buffer): Buffer {
  let k = crypto.createHash('sha256').update(Buffer.concat([password, salt, udata])).digest();
  let e = Buffer.alloc(0);
  for (let i = 0; i < 64 || e[e.length - 1] > i - 32; i++) {
    const k1 = Buffer.concat(Array.from({ length: 64 }, () => Buffer.concat([password, k, udata])));
    const cipher = crypto.createCipheriv('aes-128-cbc', k.subarray(0, 16), k.subarray(16, 32)).setAutoPadding(false);
    e = Buffer.concat([cipher.update(k1), cipher.final()]);
    const mod = e.subarray(0, 16).reduce((sum, b) => sum + b, 0) % 3;
    k = crypto.createHash(['sha256', 'sha384', 'sha512'][mod]).update(e).digest();
  }
  return k.subarray(0, 32);
}
const pw = (p: string) => Buffer.from(p, 'utf8').subarray(0, 127);
/** Whether `p` is the user password (Algorithm 11). */
const isUserPassword = (d: { U: Buffer }, p: string) => hash2B(pw(p), d.U.subarray(32, 40), Buffer.alloc(0)).equals(d.U.subarray(0, 32));
/** Whether `p` is the owner password (Algorithm 12). */
const isOwnerPassword = (d: { O: Buffer; U: Buffer }, p: string) => hash2B(pw(p), d.O.subarray(32, 40), d.U.subarray(0, 48)).equals(d.O.subarray(0, 32));

// Permission bits (ISO 32000 Table 22) and the matching pdf.js PermissionFlag values.
const PERM = { print: 4, modify: 8, copy: 16, annotate: 32, fillForms: 256, accessibility: 512, assemble: 1024, printHigh: 2048 };
const permsSet = (P: number) => Object.fromEntries(Object.entries(PERM).map(([k, bit]) => [k, (P & bit) !== 0]));

async function protect(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }, password: string, opts: { owner?: string; print?: boolean; copy?: boolean; modify?: boolean } = {}) {
  await openTool(page, 'protect');
  await drop(page).setInputFiles(file);
  const pws = page.locator('input[type=password]');
  await pws.nth(0).fill(password);
  await pws.nth(1).fill(password);
  if (opts.owner) await page.locator('.option', { hasText: 'Owner password' }).locator('input').fill(opts.owner);
  for (const [key, label] of [
    ['print', 'Allow printing'],
    ['copy', 'Allow copying text and images'],
    ['modify', 'Allow editing and annotating'],
  ] as const) {
    if (opts[key] !== undefined) await page.getByLabel(label).setChecked(opts[key]!);
  }
  return runAndDownload(page);
}

// ---- Protect -----------------------------------------------------------------------------------

test.describe('Protect PDF', () => {
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

  test('AES-256: V5/R6 with AESV3 for streams and strings; the password opens it and nothing else does', async ({ page }) => {
    const { name, bytes } = await protect(page, fixture('invoice.pdf'), 'Tajne123');
    expect(name).toBe('invoice_protected.pdf');
    const d = (await encryptDict(bytes))!;
    expect(d).not.toBeNull();
    expect({ filter: d.filter, V: d.V, R: d.R, Length: d.Length, cfm: d.cfm, cfLength: d.cfLength, stmF: d.stmF, strF: d.strF }).toEqual({
      filter: '/Standard',
      V: 5,
      R: 6,
      Length: 256,
      cfm: '/AESV3',
      cfLength: 32,
      stmF: '/StdCF',
      strF: '/StdCF',
    });
    // 48-byte password records, 32-byte wrapped keys, 16-byte /Perms.
    expect([d.O.length, d.U.length, d.OE.length, d.UE.length, d.Perms.length]).toEqual([48, 48, 32, 32, 16]);
    // AES-256 needs PDF 2.0, or 1.7 with Adobe extension level 8.
    if (d.header === '%PDF-1.7') {
      const adbe = d.catalog.lookup(PDFName.of('Extensions'), PDFDict).lookup(PDFName.of('ADBE'), PDFDict);
      expect((adbe.lookup(PDFName.of('ExtensionLevel')) as PDFNumber).asNumber()).toBeGreaterThanOrEqual(8);
    } else {
      expect(d.header).toBe('%PDF-2.0');
    }

    expect(isUserPassword(d, 'Tajne123')).toBe(true);
    expect(isUserPassword(d, 'tajne123')).toBe(false);
    // Without an owner password a random one is used, so the user password cannot lift the restrictions.
    expect(isOwnerPassword(d, 'Tajne123')).toBe(false);
    expect(isOwnerPassword(d, '')).toBe(false);

    expect(await needsPassword(bytes)).toBe(true);
    await expect(pdfText(bytes, 'tajne123')).rejects.toThrow();
    expect((await pdfText(bytes, 'Tajne123'))[0]).toContain('Invoice 3/10/2026');
    // No readable copy of the page text or the title is left in the file.
    expect(await fileContains(bytes, 'Invoice 3/10/2026')).toBe(false);
    expect(await fileContains(bytes, 'Test invoice')).toBe(false);
    expect(await pdfjsTitle(bytes, 'Tajne123')).toBe('Test invoice');
  });

  test('default permissions: printing allowed, copying and editing not', async ({ page }) => {
    await openTool(page, 'protect');
    await expect(page.getByLabel('Allow printing')).toBeChecked();
    await expect(page.getByLabel('Allow copying text and images')).not.toBeChecked();
    await expect(page.getByLabel('Allow editing and annotating')).not.toBeChecked();
    const { bytes } = await protect(page, fixture('invoice.pdf'), 'x');
    expect(permsSet((await encryptDict(bytes))!.P)).toEqual({
      print: true,
      printHigh: true,
      copy: false,
      modify: false,
      annotate: false,
      assemble: false,
      fillForms: true,
      accessibility: true,
    });
    expect((await pdfjsPermissions(bytes, 'x'))!.sort((a, b) => a - b)).toEqual([PERM.print, PERM.fillForms, PERM.accessibility, PERM.printHigh]);
  });

  test('each permission checkbox sets its /P bits (all on, all off, one at a time)', async ({ page }) => {
    const all = await protect(page, fixture('invoice.pdf'), 'x', { print: true, copy: true, modify: true });
    const P = (await encryptDict(all.bytes))!.P;
    expect(permsSet(P)).toEqual({ print: true, printHigh: true, copy: true, modify: true, annotate: true, assemble: true, fillForms: true, accessibility: true });
    // Bits 1–2 must be 0, bits 7–8 and 13–32 must be 1.
    expect(P & 0b11).toBe(0);
    expect(P & 0b11000000).toBe(0b11000000);
    expect(P >>> 12).toBe(0xfffff);
    expect((await pdfjsPermissions(all.bytes, 'x'))!.length).toBe(8);

    const none = await protect(page, fixture('invoice.pdf'), 'x', { print: false, copy: false, modify: false });
    expect(permsSet((await encryptDict(none.bytes))!.P)).toEqual({
      print: false,
      printHigh: false,
      copy: false,
      modify: false,
      annotate: false,
      assemble: false,
      fillForms: true,
      accessibility: true,
    });
    expect((await pdfjsPermissions(none.bytes, 'x'))!.sort((a, b) => a - b)).toEqual([PERM.fillForms, PERM.accessibility]);

    const copyOnly = await protect(page, fixture('invoice.pdf'), 'x', { print: false, copy: true, modify: false });
    expect(permsSet((await encryptDict(copyOnly.bytes))!.P)).toMatchObject({ print: false, printHigh: false, copy: true, modify: false, annotate: false, assemble: false });

    const modifyOnly = await protect(page, fixture('invoice.pdf'), 'x', { print: false, copy: false, modify: true });
    expect(permsSet((await encryptDict(modifyOnly.bytes))!.P)).toMatchObject({ print: false, copy: false, modify: true, annotate: true, assemble: true });
  });

  test('a separate owner password is recorded as the owner password and also opens the file', async ({ page }) => {
    const { bytes } = await protect(page, fixture('invoice.pdf'), 'czytelnik', { owner: 'Właściciel#9' });
    const d = (await encryptDict(bytes))!;
    expect(isUserPassword(d, 'czytelnik')).toBe(true);
    expect(isOwnerPassword(d, 'Właściciel#9')).toBe(true);
    expect(isOwnerPassword(d, 'czytelnik')).toBe(false);
    expect(isUserPassword(d, 'Właściciel#9')).toBe(false);
    expect((await pdfText(bytes, 'Właściciel#9'))[0]).toContain('Invoice 3/10/2026');
  });

  test('a Polish (non-ASCII) password works in pdf.js and in Unlock', async ({ page }) => {
    const password = 'Zażółć-gęślą 2026';
    const { bytes } = await protect(page, fixture('invoice.pdf'), password);
    const d = (await encryptDict(bytes))!;
    // Stored as UTF-8, as revision 6 requires.
    expect(isUserPassword(d, password)).toBe(true);
    expect((await pdfText(bytes, password))[0]).toContain('Invoice 3/10/2026');
    await expect(pdfText(bytes, 'Zazolc-gesla 2026')).rejects.toThrow();

    await openTool(page, 'unlock');
    await drop(page).setInputFiles(asFile('pl.pdf', bytes));
    await page.locator('input[type=password]').fill(password);
    expect((await pdfText((await runAndDownload(page)).bytes))[0]).toContain('Invoice 3/10/2026');
  });

  test('input checks: no file or no password disables Protect; an already protected file is refused', async ({ page }) => {
    await openTool(page, 'protect');
    const runButton = page.locator('.run-bar .btn.primary');
    const pws = page.locator('input[type=password]');
    await pws.nth(0).fill('x');
    await pws.nth(1).fill('x');
    await expect(runButton).toBeDisabled();
    await drop(page).setInputFiles(fixture('invoice.pdf'));
    await expect(runButton).toBeEnabled();
    await pws.nth(0).fill('');
    await pws.nth(1).fill('');
    await expect(runButton).toBeDisabled();
    // Only the repeat field typed so far: still a mismatch.
    await pws.nth(1).fill('abc');
    await expect(page.getByText('The passwords do not match.')).toBeVisible();
    await expect(runButton).toBeDisabled();

    await openTool(page, 'protect');
    await drop(page).setInputFiles(fixture('owner-only.pdf'));
    await pws.nth(0).fill('x');
    await pws.nth(1).fill('x');
    await runButton.click();
    await expect(page.locator('.run-bar .error-text')).toHaveText('This PDF is already password-protected. Unlock it first.');
    await expect(page.locator('.results')).toHaveCount(0);
  });

  test('document properties are kept, only encrypted', async ({ page }) => {
    const { bytes } = await protect(page, fixture('invoice.pdf'), 'x');
    await openTool(page, 'unlock');
    await drop(page).setInputFiles(asFile('p.pdf', bytes));
    await page.locator('input[type=password]').fill('x');
    const doc = await loadPdf((await runAndDownload(page)).bytes);
    expect(doc.getTitle()).toBe('Test invoice');
    // Neither Protect nor Unlock should stamp pdf-lib as the producer (the app keeps it everywhere else).
    expect(doc.getProducer()).toBe('nyxiontech-pdf-tools tests');
  });
});

// ---- Unlock ------------------------------------------------------------------------------------

/** A file locked outside the app, so Unlock is tested independently of Protect. */
const lockedElsewhere = (password: string, owner = 'owner-' + password) =>
  lockedPdf({ user: password, owner, text: 'Lease agreement body', info: { title: 'Umowa najmu', author: 'Łukasz Żak', producer: 'external producer' } });

test.describe('Unlock PDF', () => {
  test('the right password removes encryption entirely and keeps text and properties', async ({ page }) => {
    const locked = await lockedElsewhere('Sezam');
    expect(await needsPassword(locked)).toBe(true);
    await openTool(page, 'unlock');
    await drop(page).setInputFiles(asFile('umowa.pdf', locked));
    await page.locator('input[type=password]').fill('Sezam');
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('umowa_unlocked.pdf');
    expect(await encryptDict(bytes)).toBeNull();
    expect(Buffer.from(bytes).toString('latin1')).not.toContain('/Encrypt');
    expect(await needsPassword(bytes)).toBe(false);
    expect(await pdfjsPermissions(bytes)).toBeNull();
    const doc = await loadPdf(bytes);
    expect(doc.isEncrypted).toBe(false);
    expect(doc.getTitle()).toBe('Umowa najmu');
    expect(doc.getAuthor()).toBe('Łukasz Żak');
    expect(doc.getProducer()).toBe('external producer');
    expect((await pdfText(bytes))[0]).toContain('Lease agreement body');
    // Readable in the clear now.
    expect(await fileContains(bytes, 'Umowa najmu')).toBe(true);
  });

  test('the owner password unlocks too', async ({ page }) => {
    await openTool(page, 'unlock');
    await drop(page).setInputFiles(asFile('umowa.pdf', await lockedElsewhere('Sezam', 'Admin!')));
    await page.locator('input[type=password]').fill('Admin!');
    const { bytes } = await runAndDownload(page);
    expect(await encryptDict(bytes)).toBeNull();
    expect((await pdfText(bytes))[0]).toContain('Lease agreement body');
  });

  test('wrong or missing password is refused with a message, then the right one works', async ({ page }) => {
    await openTool(page, 'unlock');
    const runButton = page.locator('.run-bar .btn.primary');
    await expect(runButton).toBeDisabled();
    await drop(page).setInputFiles(asFile('umowa.pdf', await lockedElsewhere('Sezam')));
    // Empty password: allowed to try (for owner-only files), but refused here.
    await runButton.click();
    await expect(page.locator('.run-bar .error-text')).toHaveText('Wrong password, or this PDF could not be decrypted.');
    await page.locator('input[type=password]').fill('sezam');
    await runButton.click();
    await expect(page.locator('.run-bar .error-text')).toHaveText('Wrong password, or this PDF could not be decrypted.');
    await expect(page.locator('.results')).toHaveCount(0);
    await page.locator('input[type=password]').fill('Sezam');
    await run(page);
    expect((await pdfText((await downloadResult(page)).bytes))[0]).toContain('Lease agreement body');
  });

  test('a file that opens without a password but has restrictions is freed with an empty password', async ({ page }) => {
    const original = fs.readFileSync(fixture('owner-only.pdf'));
    // The fixture really is restricted: no password needed, printing and copying denied.
    expect(await needsPassword(original)).toBe(false);
    const perms = await pdfjsPermissions(original);
    expect(perms).not.toContain(PERM.print);
    expect(perms).not.toContain(PERM.copy);

    await openTool(page, 'unlock');
    await drop(page).setInputFiles(fixture('owner-only.pdf'));
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('owner-only_unlocked.pdf');
    expect(await encryptDict(bytes)).toBeNull();
    expect(await pdfjsPermissions(bytes)).toBeNull();
    expect((await pdfText(bytes))[0]).toContain('Restricted but readable');
    expect((await loadPdf(bytes)).getTitle()).toBe('Owner-only title');
  });

  test('a PDF without a password passes through unchanged in content', async ({ page }) => {
    await openTool(page, 'unlock');
    await drop(page).setInputFiles(fixture('invoice.pdf'));
    const { bytes } = await runAndDownload(page);
    expect(await encryptDict(bytes)).toBeNull();
    const text = await pdfText(bytes);
    expect(text).toHaveLength(2);
    expect(text[0]).toContain('IBAN: PL88 1050 1823 1000 0090 8181 8081');
    expect(text[1]).toContain('Second page content');
    expect((await loadPdf(bytes)).getTitle()).toBe('Test invoice');
  });
});

// ---- Redact ------------------------------------------------------------------------------------

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

async function openRedact(page: Page, file: Parameters<Page['setInputFiles']>[1]) {
  await openTool(page, 'redact');
  await drop(page).setInputFiles(file);
  await expect(page.locator('.redact-sheet svg').first()).toBeVisible();
}

/** Redaction boxes on page `i` of the preview, in page points (top-left origin). */
function boxesOn(page: Page, i: number): Promise<Rect[]> {
  return page
    .locator('.redact-page')
    .nth(i)
    .locator('svg')
    .evaluate((svg) =>
      [...svg.querySelectorAll('rect.redact-box:not(.draft)')].map((r) => ({
        x: Number(r.getAttribute('x')),
        y: Number(r.getAttribute('y')),
        w: Number(r.getAttribute('width')),
        h: Number(r.getAttribute('height')),
      })),
    );
}

/** Pixels of the single image that makes up a redacted page. */
async function pageRaster(bytes: Uint8Array, index: number) {
  const doc = await loadPdf(bytes);
  const p = doc.getPage(index);
  const xobjects = p.node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
  const [ref] = xobjects.values();
  const img = doc.context.lookup(ref) as PDFRawStream;
  const width = (img.dict.lookup(PDFName.of('Width')) as PDFNumber).asNumber();
  const height = (img.dict.lookup(PDFName.of('Height')) as PDFNumber).asNumber();
  const data = decodePDFRawStream(img).decode();
  return { width, height, channels: data.length / (width * height), data, scale: width / p.getWidth(), pageW: p.getWidth(), pageH: p.getHeight() };
}

/** Share of dark pixels inside a box given in page points (top-left origin). */
function darkShare(r: Awaited<ReturnType<typeof pageRaster>>, box: Rect): number {
  const x0 = Math.max(0, Math.floor(box.x * r.scale));
  const y0 = Math.max(0, Math.floor(box.y * r.scale));
  const x1 = Math.min(r.width, Math.ceil((box.x + box.w) * r.scale));
  const y1 = Math.min(r.height, Math.ceil((box.y + box.h) * r.scale));
  let dark = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const o = (y * r.width + x) * r.channels;
      if ((r.data[o] + r.data[o + 1] + r.data[o + 2]) / 3 < 100) dark++;
      n++;
    }
  }
  return dark / n;
}

/** Glyph extents of each line of patterns.pdf, from the Helvetica metrics the fixture was drawn with. */
async function patternGeometry() {
  const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
  const { x, top, step, size, pageH } = PATTERN_LAYOUT;
  const width = (t: string) => font.widthOfTextAtSize(t, size);
  return PATTERN_PAGES.map(({ lines }) =>
    lines.map((l, i) => {
      const baseline = pageH - (top - i * step);
      const match = l.match ?? l.text;
      const start = x + width(l.text.slice(0, l.text.indexOf(match)));
      // Cap height of Helvetica is 0.718 em; the band holds the glyphs of the line above the baseline.
      return { ...l, baseline, match, line: { x, y: baseline - 8.6, w: width(l.text), h: 8.6 }, glyphs: { x: start, y: baseline - 8.6, w: width(match), h: 8.6 } };
    }),
  );
}

test.describe('Redact PDF', () => {
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

  for (const [index, { preset, lines }] of PATTERN_PAGES.entries()) {
    test(`preset "${preset}" boxes every match whole, skips look-alikes, and burns the boxes in`, async ({ page }) => {
      const geometry = (await patternGeometry())[index];
      await openRedact(page, fixture('patterns.pdf'));
      await page.locator('.chip', { hasText: preset }).click();
      await expect(page.locator('.option span.hint')).toHaveText(new RegExp(`^${preset.replace(/[/]/g, '\\/')}: \\d+ match(es)? marked\\.$`));
      const hits = lines.filter((l) => l.hit).length;
      await expect(page.locator('.redact-page > .muted').nth(index)).toHaveText(`Page ${index + 1} · ${hits} ${hits === 1 ? 'area' : 'areas'}`);

      // Which line each box sits on, and whether it covers the whole match.
      const boxes = await boxesOn(page, index);
      const report = geometry.map((g) => {
        const own = boxes.filter((b) => b.y <= g.baseline - 6 && b.y + b.h >= g.baseline);
        const covers = own.some((b) => b.x <= g.glyphs.x && b.x + b.w >= g.glyphs.x + g.glyphs.w);
        return { text: g.text, boxed: own.length > 0, covers };
      });
      expect(report).toEqual(geometry.map((g) => ({ text: g.text, boxed: g.hit, covers: g.hit })));

      await run(page);
      const { name, bytes } = await downloadResult(page);
      expect(name).toBe('patterns_redacted.pdf');
      const text = await pdfText(bytes);
      expect(text[index]).toBe('');
      for (const g of geometry.filter((l) => l.hit)) expect(await fileContains(bytes, g.match), g.match).toBe(false);
      // In the page image the matches are solid black, look-alike lines are ordinary text.
      const raster = await pageRaster(bytes, index);
      expect(raster.scale).toBeCloseTo(200 / 72, 2);
      for (const g of geometry) {
        if (g.hit) expect(darkShare(raster, g.glyphs), g.text).toBeGreaterThan(0.98);
        else expect(darkShare(raster, g.line), g.text).toBeLessThan(0.6);
      }
    });
  }

  test('find text: case-insensitive, every occurrence on every page, Enter works, counters add up', async ({ page }) => {
    await openRedact(page, fixture('patterns.pdf'));
    const count = (q: string) => PATTERN_PAGES.map(({ lines }) => lines.reduce((n, l) => n + (l.text.toLowerCase().split(q.toLowerCase()).length - 1), 0));
    const input = page.getByPlaceholder('e.g. a name or account number');
    const mark = page.getByRole('button', { name: 'Mark' });
    await expect(mark).toBeDisabled();

    await input.fill('pl61');
    await mark.click();
    expect(count('pl61')).toEqual([0, 0, 2, 0]);
    await expect(page.locator('.option span.hint')).toHaveText('"pl61": 2 matches marked.');
    await expect(page.locator('.redact-toolbar b')).toHaveText('2 areas to redact');

    await input.fill('  1234 ');
    await input.press('Enter');
    const c = count('1234');
    const total = c.reduce((a, b) => a + b, 0);
    expect(c.filter(Boolean).length).toBeGreaterThan(1);
    await expect(page.locator('.option span.hint')).toHaveText(`"1234": ${total} ${total === 1 ? 'match' : 'matches'} marked.`);
    await expect(page.locator('.redact-toolbar b')).toHaveText(`${2 + total} areas to redact`);
    const perPage = count('pl61').map((n, i) => n + c[i]);
    for (const [i, n] of perPage.entries()) {
      await expect(page.locator('.redact-page > .muted').nth(i)).toHaveText(n ? `Page ${i + 1} · ${n} ${n === 1 ? 'area' : 'areas'}` : `Page ${i + 1}`);
    }

    // Text that is not there.
    await input.fill('no such text');
    await mark.click();
    await expect(page.locator('.option span.hint')).toHaveText('"no such text": 0 matches marked.');
    await expect(page.locator('.redact-toolbar b')).toHaveText(`${2 + total} areas to redact`);
  });

  test('drawn boxes: drag to add, click to remove, Clear all; the box is burnt in, other pages keep their text', async ({ page }) => {
    await openRedact(page, fixture('invoice.pdf'));
    const runButton = page.locator('.run-bar .btn.primary');
    const counter = page.locator('.redact-toolbar b');
    await expect(counter).toHaveText('0 areas to redact');
    await expect(runButton).toBeDisabled();

    const svg = page.locator('.redact-page').first().locator('svg');
    const drag = async (from: [number, number], to: [number, number]) => {
      const box = (await svg.boundingBox())!;
      const s = box.width / 595;
      await page.mouse.move(box.x + from[0] * s, box.y + from[1] * s);
      await page.mouse.down();
      await page.mouse.move(box.x + to[0] * s, box.y + to[1] * s, { steps: 5 });
      await page.mouse.up();
    };
    // "Invoice 3/10/2026" has its baseline 62 pt from the top; "Total due" 206 pt.
    await drag([45, 48], [200, 68]);
    await expect(counter).toHaveText('1 area to redact');
    await drag([45, 192], [250, 212]);
    await expect(counter).toHaveText('2 areas to redact');
    await expect(page.locator('.redact-page > .muted').first()).toHaveText('Page 1 · 2 areas');
    // A click without a real drag adds nothing.
    await drag([300, 400], [301, 401]);
    await expect(counter).toHaveText('2 areas to redact');

    await svg.locator('rect.redact-box').nth(1).click();
    await expect(counter).toHaveText('1 area to redact');
    const [drawn] = await boxesOn(page, 0);
    expect(drawn.x).toBeCloseTo(45, 0);
    expect(drawn.y).toBeCloseTo(48, 0);
    expect(drawn.w).toBeCloseTo(155, 0);
    expect(drawn.h).toBeCloseTo(20, 0);

    await page.getByRole('button', { name: 'Clear all' }).click();
    await expect(counter).toHaveText('0 areas to redact');
    await expect(runButton).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Clear all' })).toBeDisabled();

    await drag([45, 48], [200, 68]);
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('invoice_redacted.pdf');
    await expect(page.locator('.results-note')).toContainText('Pages with redactions are saved as images');
    const doc = await loadPdf(bytes);
    expect(doc.getPages().map((p) => p.getSize())).toEqual([
      { width: 595, height: 842 },
      { width: 595, height: 842 },
    ]);
    const text = await pdfText(bytes);
    expect(text[0]).toBe('');
    expect(text[1]).toBe('Second page content');
    expect(await fileContains(bytes, 'Invoice 3/10/2026')).toBe(false);
    const raster = await pageRaster(bytes, 0);
    expect(darkShare(raster, { x: 46, y: 49, w: 153, h: 18 })).toBeGreaterThan(0.98);
    // The rest of page 1 is still visible as an image (e.g. the total line), not blacked out.
    const total = darkShare(raster, { x: 50, y: 197, w: 120, h: 9 });
    expect(total).toBeGreaterThan(0.05);
    expect(total).toBeLessThan(0.6);
  });

  test('nothing secret survives in properties, XMP, outline, comments, form fields or attachments', async ({ page }) => {
    const original = fs.readFileSync(fixture('secrets.pdf'));
    expect(await fileContains(original, SECRET)).toBe(true);
    await openRedact(page, fixture('secrets.pdf'));
    const input = page.getByPlaceholder('e.g. a name or account number');
    await input.fill(SECRET.toLowerCase());
    await input.press('Enter');
    await expect(page.locator('.redact-toolbar b')).toHaveText('1 area to redact');
    const { bytes } = await runAndDownload(page);

    expect(await fileContains(bytes, SECRET)).toBe(false);
    expect(await fileContains(bytes, SECRET.toLowerCase())).toBe(false);
    const doc = await loadPdf(bytes);
    expect(doc.getTitle()).toBeUndefined();
    expect(doc.getAuthor()).toBeUndefined();
    expect(doc.getSubject()).toBeUndefined();
    expect(doc.getKeywords()).toBeUndefined();
    for (const key of ['Outlines', 'Metadata', 'Names', 'AcroForm']) expect(doc.catalog.get(PDFName.of(key)), key).toBeUndefined();
    expect(doc.getPage(0).node.Annots()?.size() ?? 0).toBe(0);
    expect(doc.getPageCount()).toBe(2);
    const text = await pdfText(bytes);
    expect(text[0]).toBe('');
    expect(text[1]).toBe('Untouched page text');
  });

  // BUG: "Find text" only searches the page text. The same string in a comment on a page
  // without redactions is not marked, and that page is copied as it is, so the redacted
  // text stays in the output file (the comment's /Contents). Found by this test.
  test('a comment on another page that repeats the found text does not keep it in the file', async ({ page }) => {
    test.fail();
    await openRedact(page, fixture('secret-comment.pdf'));
    const input = page.getByPlaceholder('e.g. a name or account number');
    await input.fill(SECRET);
    await input.press('Enter');
    await expect(page.locator('.redact-toolbar b')).toHaveText('1 area to redact');
    const { bytes } = await runAndDownload(page);
    expect((await pdfText(bytes))[1]).toBe('Reviewer notes');
    expect(await fileContains(bytes, SECRET)).toBe(false);
  });

  test('a password-protected PDF cannot be redacted until unlocked', async ({ page }) => {
    await openTool(page, 'redact');
    await drop(page).setInputFiles(asFile('locked.pdf', await lockedElsewhere('x')));
    await expect(page.locator('.single-file .error-text')).toContainText('password-protected');
    await expect(page.locator('.redact-sheet')).toHaveCount(0);
    await expect(page.locator('.run-bar .btn.primary')).toBeDisabled();
  });
});
