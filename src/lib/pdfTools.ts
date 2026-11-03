// Stand-alone PDF operations behind the dashboard tools. All run in the browser.
import { degrees, EncryptedPDFError, PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib';
import { embedRegistryFont, hexColor, viewToPdf, visibleBox } from './export';
import { closePdf, normalizeRotation, openPdf, renderPageToBlob } from './pdfjs';

export interface NamedBytes {
  name: string;
  bytes: Uint8Array;
}

export const baseName = (name: string) => name.replace(/\.[^.\\/]+$/, '');

export const pdfBlob = (bytes: Uint8Array) => new Blob([bytes], { type: 'application/pdf' });

/**
 * Loads a PDF for modification, with a readable error for password-protected files.
 * The original document properties are kept: pdf-lib would otherwise stamp itself
 * as producer and creator as soon as a file is loaded.
 */
export async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (e) {
    // With AES-encrypted object streams pdf-lib fails while parsing, before it can
    // report EncryptedPDFError, so also look for the /Encrypt entry ourselves.
    if (e instanceof EncryptedPDFError || isEncrypted(bytes)) {
      throw new Error('This PDF is password-protected. Remove the password with "Unlock PDF" first.');
    }
    throw new Error(`Could not read this PDF (${e instanceof Error ? e.message : String(e)}).`);
  }
}

/** True when the file's trailer or cross-reference stream declares encryption. */
export function isEncrypted(bytes: Uint8Array): boolean {
  // The trailer / xref stream dictionary sits near the end and is never compressed.
  const tail = new TextDecoder('latin1').decode(bytes.subarray(Math.max(0, bytes.length - 64 * 1024)));
  return tail.includes('/Encrypt');
}

export async function pageCountOf(bytes: Uint8Array): Promise<number> {
  return (await loadPdf(bytes)).getPageCount();
}

/**
 * Parses page ranges like "1-3, 5, 8-" into groups of 0-based page indices.
 * An open end ("8-") runs to the last page.
 */
export function parsePageRanges(input: string, count: number): number[][] {
  const groups: number[][] = [];
  for (const part of input.split(/[,;]/).map((p) => p.trim()).filter(Boolean)) {
    const m = /^(\d*)\s*(?:-\s*(\d*))?$/.exec(part);
    if (!m || (!m[1] && !m[2])) throw new Error(`"${part}" is not a page or range.`);
    const isRange = part.includes('-');
    const from = m[1] ? parseInt(m[1], 10) : 1;
    const to = isRange ? (m[2] ? parseInt(m[2], 10) : count) : from;
    if (from < 1 || to > count || from > to) throw new Error(`"${part}" is outside pages 1–${count}.`);
    groups.push(Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i));
  }
  if (!groups.length) throw new Error('Enter at least one page or range.');
  return groups;
}

async function copyInto(out: PDFDocument, src: PDFDocument, indices: number[]) {
  for (const page of await out.copyPages(src, indices)) out.addPage(page);
}

export async function mergePdfs(files: NamedBytes[]): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await loadPdf(f.bytes);
    await copyInto(out, src, src.getPageIndices());
  }
  return out.save();
}

/** One output document per group of page indices. */
export async function splitPdf(bytes: Uint8Array, groups: number[][]): Promise<Uint8Array[]> {
  const src = await loadPdf(bytes);
  const outputs: Uint8Array[] = [];
  for (const indices of groups) {
    const out = await PDFDocument.create();
    await copyInto(out, src, indices);
    outputs.push(await out.save());
  }
  return outputs;
}

export async function rotatePdf(bytes: Uint8Array, angle: 90 | 180 | 270, only?: Set<number>): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  doc.getPages().forEach((page, i) => {
    if (only && !only.has(i)) return;
    page.setRotation(degrees(normalizeRotation(page.getRotation().angle + angle)));
  });
  return doc.save();
}

/** Re-saves with object streams. Keeps everything intact; gains are usually modest. */
export async function resavePdf(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  return doc.save({ useObjectStreams: true });
}

/**
 * Strong compression: every page becomes a JPEG. Text stops being selectable,
 * so this suits scans and image-heavy documents.
 */
export async function rasterizePdf(
  bytes: Uint8Array,
  opts: { dpi: number; quality: number },
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const src = await openPdf(bytes);
  try {
    const out = await PDFDocument.create();
    for (let n = 1; n <= src.numPages; n++) {
      const { blob, width, height } = await renderPageToBlob(src, n, opts.dpi, 'image/jpeg', opts.quality);
      const image = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      out.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
      onProgress?.(n, src.numPages);
    }
    return await out.save({ useObjectStreams: true });
  } finally {
    void closePdf(src);
  }
}

export async function pdfToImages(
  bytes: Uint8Array,
  opts: { format: 'png' | 'jpeg'; dpi: number; indices?: number[] },
  onProgress?: (done: number, total: number) => void,
): Promise<Blob[]> {
  const src = await openPdf(bytes);
  try {
    const indices = opts.indices ?? Array.from({ length: src.numPages }, (_, i) => i);
    const blobs: Blob[] = [];
    for (const [i, index] of indices.entries()) {
      const { blob } = await renderPageToBlob(src, index + 1, opts.dpi, `image/${opts.format}`, 0.9);
      blobs.push(blob);
      onProgress?.(i + 1, indices.length);
    }
    return blobs;
  } finally {
    void closePdf(src);
  }
}

/** Plain text of every page, separated by blank lines. Scanned pages have no text. */
export async function extractText(bytes: Uint8Array): Promise<string> {
  const src = await openPdf(bytes);
  try {
    const pages: string[] = [];
    for (let n = 1; n <= src.numPages; n++) {
      const page = await src.getPage(n);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items) {
        if (!('str' in item)) continue;
        text += item.str + (item.hasEOL ? '\n' : '');
      }
      pages.push(text.trim());
    }
    return pages.join('\n\n');
  } finally {
    void closePdf(src);
  }
}

// ---- Drawing helpers that respect page rotation ------------------------------

/** Displayed size of a page and a mapper from view space (top-left origin) to PDF space. */
function pageView(page: PDFPage) {
  const rot = normalizeRotation(page.getRotation().angle);
  const box = visibleBox(page);
  const size = rot % 180 === 0 ? { w: box.w, h: box.h } : { w: box.h, h: box.w };
  return { rot, size, toPdf: viewToPdf(box, rot) };
}

export type NumberPosition = 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';

export interface PageNumberOptions {
  position: NumberPosition;
  /** `{n}` is the page number, `{total}` the page count. */
  format: string;
  startAt: number;
  skipFirst: boolean;
  size: number;
  margin: number;
  color: string;
  font: string;
}

export async function addPageNumbers(bytes: Uint8Array, o: PageNumberOptions): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const font = await embedRegistryFont(doc, o.font);
  const pages = doc.getPages();
  const numbered = o.skipFirst ? pages.length - 1 : pages.length;
  pages.forEach((page, i) => {
    if (o.skipFirst && i === 0) return;
    const n = o.startAt + (o.skipFirst ? i - 1 : i);
    const label = o.format.replaceAll('{n}', String(n)).replaceAll('{total}', String(o.startAt + numbered - 1));
    const { rot, size, toPdf } = pageView(page);
    const w = font.widthOfTextAtSize(label, o.size);
    const [v, h] = o.position.split('-');
    const x = h === 'left' ? o.margin : h === 'right' ? size.w - o.margin - w : (size.w - w) / 2;
    const y = v === 'top' ? o.margin + o.size * 0.8 : size.h - o.margin;
    page.drawText(label, { ...toPdf(x, y), size: o.size, font, color: hexColor(o.color), rotate: degrees(rot) });
  });
  return doc.save();
}

export interface WatermarkOptions {
  text: string;
  size: number;
  color: string;
  opacity: number;
  /** Counter-clockwise, as seen on the page. */
  angle: number;
  tiled: boolean;
  font: string;
  bold: boolean;
}

export async function addWatermark(bytes: Uint8Array, o: WatermarkOptions): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  const font = await embedRegistryFont(doc, o.font, o.bold);
  const textWidth = font.widthOfTextAtSize(o.text, o.size);
  const capHeight = font.heightAtSize(o.size, { descender: false });
  const a = (o.angle * Math.PI) / 180;
  // Baseline direction and "up" direction in view space (y grows downwards).
  const dir = { x: Math.cos(a), y: -Math.sin(a) };
  const up = { x: -Math.sin(a), y: -Math.cos(a) };

  for (const page of doc.getPages()) {
    const { rot, size, toPdf } = pageView(page);
    const centres: { x: number; y: number }[] = [];
    if (o.tiled) {
      const stepX = textWidth * Math.abs(Math.cos(a)) + o.size * 3;
      const stepY = textWidth * Math.abs(Math.sin(a)) + o.size * 3;
      for (let y = stepY / 2; y < size.h + stepY; y += stepY) {
        for (let x = stepX / 2; x < size.w + stepX; x += stepX) centres.push({ x, y });
      }
    } else {
      centres.push({ x: size.w / 2, y: size.h / 2 });
    }
    for (const c of centres) {
      const start = {
        x: c.x - (dir.x * textWidth) / 2 - (up.x * capHeight) / 2,
        y: c.y - (dir.y * textWidth) / 2 - (up.y * capHeight) / 2,
      };
      drawText(page, o.text, toPdf(start.x, start.y), font, o, rot + o.angle);
    }
  }
  return doc.save();
}

function drawText(page: PDFPage, text: string, at: { x: number; y: number }, font: PDFFont, o: WatermarkOptions, angle: number) {
  page.drawText(text, { ...at, size: o.size, font, color: hexColor(o.color), opacity: o.opacity, rotate: degrees(angle) });
}

// ---- Metadata --------------------------------------------------------------------

export interface Metadata {
  title: string;
  author: string;
  subject: string;
  keywords: string;
  creator: string;
  producer: string;
}

export async function readMetadata(bytes: Uint8Array): Promise<Metadata> {
  const doc = await loadPdf(bytes);
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: doc.getKeywords() ?? '',
    creator: doc.getCreator() ?? '',
    producer: doc.getProducer() ?? '',
  };
}

export async function writeMetadata(bytes: Uint8Array, m: Metadata): Promise<Uint8Array> {
  const doc = await loadPdf(bytes);
  doc.setTitle(m.title);
  doc.setAuthor(m.author);
  doc.setSubject(m.subject);
  doc.setKeywords(m.keywords ? m.keywords.split(/\s*[,;]\s*/) : []);
  doc.setCreator(m.creator);
  doc.setProducer(m.producer);
  return doc.save();
}

// ---- Passwords (the @cantoo fork of pdf-lib can encrypt and decrypt) -------------

export interface ProtectOptions {
  userPassword: string;
  ownerPassword: string;
  allowPrinting: boolean;
  allowCopying: boolean;
  allowModifying: boolean;
}

export async function protectPdf(bytes: Uint8Array, o: ProtectOptions): Promise<Uint8Array> {
  const cantoo = await import('@cantoo/pdf-lib');
  const doc = await cantoo.PDFDocument.load(bytes).catch(() => {
    throw new Error('This PDF is already password-protected. Unlock it first.');
  });
  doc.encrypt({
    userPassword: o.userPassword,
    // Without a separate owner password, anyone who can open the file could lift the restrictions.
    ownerPassword: o.ownerPassword || o.userPassword + crypto.randomUUID(),
    permissions: {
      printing: o.allowPrinting ? 'highResolution' : false,
      copying: o.allowCopying,
      modifying: o.allowModifying,
      annotating: o.allowModifying,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: o.allowModifying,
    },
  });
  encryptStrings(cantoo, doc);
  // Without object streams every object is written on its own, with its strings
  // encrypted above, which is what the PDF spec and every reader expect.
  return doc.save({ useObjectStreams: false });
}

type Cantoo = typeof import('@cantoo/pdf-lib');

/**
 * @cantoo/pdf-lib encrypts stream contents but writes strings (document info,
 * annotations, form values, outlines) in clear text, although its own reader
 * and every other reader decrypt them. Encrypt every string with its object's key.
 */
function encryptStrings(lib: Cantoo, doc: Awaited<ReturnType<Cantoo['PDFDocument']['load']>>) {
  const { PDFArray, PDFDict, PDFHexString, PDFName, PDFStream, PDFString } = lib;
  const { context } = doc;
  const security = context.security;
  if (!security) return;
  for (const [ref, obj] of context.enumerateIndirectObjects()) {
    if (ref === context.trailerInfo.Encrypt) continue;
    // A signature's /Contents is never encrypted (and the signature breaks on re-save anyway).
    const isSig = obj instanceof PDFDict && obj.lookup(PDFName.of('Type')) === PDFName.of('Sig');
    const encrypt = security.getEncryptFn(ref.objectNumber, ref.generationNumber);
    const convert = (v: unknown) =>
      v instanceof PDFString || v instanceof PDFHexString
        ? PDFHexString.of(Array.from(encrypt(v.asBytes()), (b) => b.toString(16).padStart(2, '0')).join(''))
        : undefined;
    const walk = (node: unknown) => {
      if (node instanceof PDFDict) {
        for (const [key, value] of node.entries()) {
          if (isSig && node === obj && key === PDFName.of('Contents')) continue;
          const enc = convert(value);
          if (enc) node.set(key, enc);
          else walk(value);
        }
      } else if (node instanceof PDFArray) {
        for (let i = 0; i < node.size(); i++) {
          const enc = convert(node.get(i));
          if (enc) node.set(i, enc);
          else walk(node.get(i));
        }
      }
    };
    walk(obj instanceof PDFStream ? obj.dict : obj);
  }
}

export async function unlockPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const { PDFDocument: CantooDocument } = await import('@cantoo/pdf-lib');
  let doc;
  try {
    doc = await CantooDocument.load(bytes, { password });
  } catch {
    throw new Error('Wrong password, or this PDF could not be decrypted.');
  }
  return doc.save();
}
