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
  { id: 'phone', label: 'Phone numbers', regex: /(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){9,11}\d/g },
  { id: 'iban', label: 'Bank account numbers', regex: /\b[A-Z]{2}\d{2}(?:\s?\d{4}){4,7}\b|\b\d{2}(?:\s?\d{4}){6}\b/g },
  { id: 'nip', label: 'NIP / PESEL numbers', regex: /\b\d{3}-?\d{3}-?\d{2}-?\d{2}\b|\b\d{11}\b/g },
];

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
      // Characters are assumed equally wide within a run, which is close enough for a cover box.
      const charW = width / item.str.length;
      for (const m of item.str.matchAll(regex)) {
        if (!m[0]) continue;
        boxes.push({ x: tx[4] + charW * m.index! - 1, y: tx[5] - height * 0.9 - 1, w: charW * m[0].length + 2, h: height * 1.15 + 2 });
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
