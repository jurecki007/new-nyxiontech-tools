// Redaction that really removes content: pages with redactions are re-rendered
// as images with the boxes burnt in, so the hidden text no longer exists.
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, PDFStream, type PDFContext, type PDFObject } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import * as pdfjs from 'pdfjs-dist';
import { closePdf, openPdf } from './pdfjs';
import { loadPdf } from './pdfTools';

/** A box in page view space (points, top-left origin, as displayed). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const REDACT_PATTERNS: { id: string; label: string; regex: RegExp }[] = [
  { id: 'email', label: 'E-mail addresses', regex: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
  // 9 to 12 digits: Polish numbers have 9 ("600 123 456"), plus an optional country code.
  { id: 'phone', label: 'Phone numbers', regex: /(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){8,11}\d/g },
  // IBAN: country, check digits, then groups of 4 letters or digits (GB29 NWBK …) and a
  // shorter last group (DE…30 00); or a Polish 26-digit account number.
  { id: 'iban', label: 'Bank account numbers', regex: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,3})?\b|\b\d{2}(?:\s?\d{4}){6}\b/g },
  // NIP as 123-456-78-90 or 123-45-67-890 (or without dashes), PESEL as 11 digits.
  { id: 'nip', label: 'NIP / PESEL numbers', regex: /\b\d{3}-?\d{3}-?\d{2}-?\d{2}\b|\b\d{3}-\d{2}-\d{2}-\d{3}\b|\b\d{11}\b/g },
];

let measureCtx: CanvasRenderingContext2D | null = null;

/**
 * Horizontal offsets (as a share of the run's width) where each character of a text run
 * starts, measured with a similar font. Characters differ a lot in width ("il" vs "WM"), so
 * a box placed by average width can miss the start or end of a match and leave it readable.
 */
function charOffsets(text: string, fontFamily: string): number[] | null {
  measureCtx ??= document.createElement('canvas').getContext('2d');
  if (!measureCtx) return null;
  measureCtx.font = `100px ${fontFamily || 'sans-serif'}`;
  const total = measureCtx.measureText(text).width;
  if (!(total > 0)) return null;
  return Array.from({ length: text.length + 1 }, (_, i) => measureCtx!.measureText(text.slice(0, i)).width / total);
}

/**
 * Finds text on every page and returns boxes around each match. Matches are
 * found within pdf.js text runs; a phrase split across runs is not found.
 */
export async function findTextBoxes(doc: PDFDocumentProxy, query: string | RegExp): Promise<Box[][]> {
  const result: Box[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const boxes: Box[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !item.str) continue;
      const regex =
        typeof query === 'string'
          ? new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
          : new RegExp(query.source, query.flags.includes('g') ? query.flags : query.flags + 'g');
      const tx = pdfjs.Util.transform(viewport.transform, item.transform);
      const height = Math.hypot(tx[2], tx[3]);
      const width = item.width * viewport.scale;
      // pdf.js gives only the run's total width. Estimate where the match starts and ends
      // both from measured character widths and from the average width, and cover both
      // estimates, plus half a character on each side for fonts measured imperfectly: a box
      // may be a little wider than the text, never narrower.
      const charW = width / item.str.length;
      const pad = Math.max(1, charW / 2);
      const offsets = charOffsets(item.str, content.styles[item.fontName]?.fontFamily ?? '');
      for (const m of item.str.matchAll(regex)) {
        if (!m[0]) continue;
        const from = m.index!;
        const to = from + m[0].length;
        const x0 = Math.min(charW * from, offsets ? offsets[from] * width : Infinity);
        const x1 = Math.max(charW * to, offsets ? offsets[to] * width : -Infinity);
        boxes.push({ x: tx[4] + x0 - pad, y: tx[5] - height * 0.9 - 1, w: x1 - x0 + 2 * pad, h: height * 1.15 + 2 });
      }
    }
    result.push(boxes);
  }
  return result;
}

export async function redactPdf(bytes: Uint8Array, boxesByPage: Box[][], dpi: number, onProgress?: (done: number, total: number) => void): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const render = await openPdf(bytes);
  const out = await PDFDocument.create();
  try {
    for (let i = 0; i < src.getPageCount(); i++) {
      const boxes = boxesByPage[i] ?? [];
      if (!boxes.length) {
        const [copy] = await out.copyPages(src, [i]);
        out.addPage(copy);
      } else {
        const page = await render.getPage(i + 1);
        const scale = dpi / 72;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvas, viewport }).promise;
        ctx.fillStyle = '#000';
        for (const b of boxes) ctx.fillRect(b.x * scale, b.y * scale, b.w * scale, b.h * scale);
        const png = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
        const image = await out.embedPng(new Uint8Array(await png.arrayBuffer()));
        const w = viewport.width / scale;
        const h = viewport.height / scale;
        out.addPage([w, h]).drawImage(image, { x: 0, y: 0, width: w, height: h });
        page.cleanup();
      }
      onProgress?.(i + 1, src.getPageCount());
    }
  } finally {
    void closePdf(render);
  }
  await out.flush();
  dropOrphanPages(out);
  pruneUnreachable(out.context);
  // Metadata can leak too (author, title), so the output starts clean.
  return out.save();
}

/**
 * copyPages copies everything a page references. A link, form field or article
 * thread on a kept page can point at a redacted page, which would bring the
 * original page (and its text) into the output as a hidden object. Such copies
 * are not in the page tree, so delete them; references to them become null.
 */
function dropOrphanPages(doc: PDFDocument) {
  const kept = new Set(doc.getPages().map((p) => p.ref.toString()));
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFDict && obj.get(PDFName.of('Type')) === PDFName.of('Page') && !kept.has(ref.toString())) {
      doc.context.delete(ref);
    }
  }
}

/** Deletes every object not reachable from the catalog or document info. */
function pruneUnreachable(context: PDFContext) {
  const seen = new Set<string>();
  const visit = (obj: PDFObject | undefined) => {
    if (obj instanceof PDFRef) {
      if (seen.has(obj.toString())) return;
      seen.add(obj.toString());
      visit(context.lookup(obj));
    } else if (obj instanceof PDFDict) {
      for (const [, value] of obj.entries()) visit(value);
    } else if (obj instanceof PDFArray) {
      for (const value of obj.asArray()) visit(value);
    } else if (obj instanceof PDFStream) {
      visit(obj.dict);
    }
  };
  visit(context.trailerInfo.Root);
  visit(context.trailerInfo.Info);
  for (const [ref] of context.enumerateIndirectObjects()) {
    if (!seen.has(ref.toString())) context.delete(ref);
  }
}
