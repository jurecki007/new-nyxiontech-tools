// Redaction that really removes content: pages with redactions are re-rendered
// as images with the boxes burnt in, so the hidden text no longer exists.
import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  PDFStream,
  PDFString,
  type PDFContext,
  type PDFObject,
} from 'pdf-lib';
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

/** What "Find text" or a preset searches for: literal text (any case) or a pattern. */
export type RedactQuery = string | RegExp;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

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
export async function findTextBoxes(doc: PDFDocumentProxy, query: RedactQuery): Promise<Box[][]> {
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
          ? new RegExp(escapeRegex(query), 'gi')
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

/**
 * Redacts the boxes (pages with boxes become images, which drops all their comments and
 * form fields) and, on the pages copied as they are, removes comments and clears form
 * field values that contain any of `queries` (the text and patterns that were searched).
 */
export async function redactPdf(
  bytes: Uint8Array,
  boxesByPage: Box[][],
  dpi: number,
  onProgress?: (done: number, total: number) => void,
  queries: RedactQuery[] = [],
): Promise<Uint8Array> {
  const src = await loadPdf(bytes);
  const render = await openPdf(bytes);
  const out = await PDFDocument.create();
  const copied: number[] = [];
  try {
    for (let i = 0; i < src.getPageCount(); i++) {
      const boxes = boxesByPage[i] ?? [];
      if (!boxes.length) {
        const [copy] = await out.copyPages(src, [i]);
        out.addPage(copy);
        copied.push(i);
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
  cleanAnnotations(out, copied, queries, true);
  dropOrphanPages(out);
  pruneUnreachable(out.context);
  // Metadata can leak too (author, title), so the output starts clean.
  return out.save();
}

/** What cleanAnnotations removes (or would remove). */
export interface AnnotationCleanup {
  /** Comments and other annotations removed, with their replies (popups not counted). */
  comments: number;
  /** Form field widgets whose value is cleared or that are removed. */
  fields: number;
}

const name = (s: string) => PDFName.of(s);

/** Decoded text of a string, a stream (rich text), or an array of them. */
function texts(context: PDFContext, value: PDFObject | undefined, out: string[] = []): string[] {
  const obj = value instanceof PDFRef ? context.lookup(value) : value;
  if (obj instanceof PDFString || obj instanceof PDFHexString) out.push(obj.decodeText());
  else if (obj instanceof PDFArray) for (const v of obj.asArray()) texts(context, v, out);
  else if (obj instanceof PDFRawStream) {
    try {
      const b = decodePDFRawStream(obj).decode();
      const utf16 = b[0] === 0xfe && b[1] === 0xff;
      out.push(new TextDecoder(utf16 ? 'utf-16be' : 'utf-8').decode(utf16 ? b.subarray(2) : b));
    } catch {
      // an unsupported filter: nothing readable to match
    }
  }
  return out;
}

/** Rich text (/RC, /RV) is XHTML: match its plain text too, where tags could split a match. */
const plain = (xhtml: string) =>
  xhtml
    .replace(/<[^>]*>/g, '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

/**
 * Comments, links and form fields keep their own text, which the page-text search never
 * sees, so a page copied as it is could still hold what was redacted elsewhere. On the
 * given pages this finds every annotation whose text matches one of the queries (literal
 * text in any case, like "Find text", or a preset pattern):
 * - a comment (any annotation but a form field) is removed when its text (/Contents),
 *   author (/T), subject (/Subj), rich text (/RC), link URI or attached file name matches,
 *   together with its popup and the replies to it (/IRT), which would otherwise point at it;
 * - a form field loses a matching value (/V, /DV, /RV), tooltip (/TU) or /Contents, and the
 *   appearance of its widgets (which shows the value); a field whose name, options or
 *   caption matches cannot be cleared, so its widget is removed.
 * Dates, IDs and other bookkeeping entries are not searched, so presets like phone numbers
 * do not match timestamps. With `apply` false it only counts.
 */
export function cleanAnnotations(doc: PDFDocument, pageIndices: number[], queries: RedactQuery[], apply: boolean): AnnotationCleanup {
  const result: AnnotationCleanup = { comments: 0, fields: 0 };
  const regexes = queries.map((q) => (typeof q === 'string' ? new RegExp(escapeRegex(q), 'i') : new RegExp(q.source, q.flags.replace(/[gy]/g, ''))));
  if (!regexes.length) return result;
  const context = doc.context;
  const hit = (list: string[]) => list.some((t) => regexes.some((r) => r.test(t)));
  const dictOf = (v: PDFObject | undefined) => {
    const obj = v instanceof PDFRef ? context.lookup(v) : v;
    return obj instanceof PDFDict ? obj : undefined;
  };

  const pages = doc.getPages();
  const entries: { dict: PDFDict; ref?: PDFRef }[] = [];
  for (const i of pageIndices) {
    for (const v of pages[i]?.node.Annots()?.asArray() ?? []) {
      const dict = dictOf(v);
      if (dict) entries.push({ dict, ref: v instanceof PDFRef ? v : undefined });
    }
  }
  const isWidget = (d: PDFDict) => d.get(name('Subtype')) === name('Widget');
  const isPopup = (d: PDFDict) => d.get(name('Subtype')) === name('Popup');

  // Comments.
  const removed = new Set<PDFDict>();
  const remove = (d: PDFDict | undefined) => {
    if (!d || removed.has(d)) return false;
    removed.add(d);
    remove(dictOf(d.get(name('Popup'))));
    return true;
  };
  for (const { dict } of entries) {
    if (isWidget(dict)) continue;
    const found: string[] = [];
    for (const key of ['Contents', 'T', 'Subj', 'RC']) texts(context, dict.get(name(key)), found);
    const rich = texts(context, dict.get(name('RC')));
    found.push(...rich.map(plain));
    texts(context, dictOf(dict.get(name('A')))?.get(name('URI')), found);
    const fs = dict.get(name('FS'));
    texts(context, fs, found);
    for (const key of ['F', 'UF', 'Desc']) texts(context, dictOf(fs)?.get(name(key)), found);
    if (!hit(found)) continue;
    remove(dict);
    // A popup shows its parent's text: the parent goes too.
    if (isPopup(dict)) remove(dictOf(dict.get(name('Parent'))));
  }
  // Replies to a removed comment (and replies to those), and popups of removed comments.
  for (let grew = removed.size > 0; grew; ) {
    grew = false;
    for (const { dict } of entries) {
      if (removed.has(dict) || isWidget(dict)) continue;
      const irt = dictOf(dict.get(name('IRT')));
      const parent = isPopup(dict) ? dictOf(dict.get(name('Parent'))) : undefined;
      if ((irt && removed.has(irt)) || (parent && removed.has(parent))) grew = remove(dict) || grew;
    }
  }
  result.comments = entries.filter(({ dict }) => removed.has(dict) && !isPopup(dict)).length;

  // Form fields: a widget, then the field dictionaries above it (values are inherited).
  const deletes: [PDFDict, string][] = [];
  const blank = new Set<PDFDict>();
  const dropFields = new Set<PDFRef>();
  for (const { dict } of entries) {
    if (!isWidget(dict) || removed.has(dict)) continue;
    let touched = false;
    let drop = false;
    const chain: { dict: PDFDict; ref?: PDFRef }[] = [{ dict }];
    for (let p = dict.get(name('Parent')); p; ) {
      const d = dictOf(p);
      if (!d || chain.some((c) => c.dict === d)) break;
      chain.push({ dict: d, ref: p instanceof PDFRef ? p : undefined });
      p = d.get(name('Parent'));
    }
    for (const link of chain) {
      for (const key of ['V', 'DV', 'RV', 'TU', 'Contents']) {
        const found = texts(context, link.dict.get(name(key)));
        if (key === 'RV') found.push(...found.map(plain));
        if (!hit(found)) continue;
        touched = true;
        deletes.push([link.dict, key]);
        if (key !== 'TU' && key !== 'Contents') blank.add(link.dict);
      }
      const fixed = [...texts(context, link.dict.get(name('T'))), ...texts(context, link.dict.get(name('TM'))), ...texts(context, link.dict.get(name('Opt')))];
      if (hit(fixed)) {
        drop = true;
        if (link.ref) dropFields.add(link.ref);
      }
    }
    const mk = dictOf(dict.get(name('MK')));
    if (mk && hit(['CA', 'RC', 'AC'].flatMap((k) => texts(context, mk.get(name(k)))))) drop = true;
    if (drop) removed.add(dict);
    if (touched || drop) result.fields++;
  }
  if (!apply) return result;

  for (const [d, key] of deletes) d.delete(name(key));
  // The appearance of a field shows its value: blank every widget of a cleared field.
  const seen = new Set<PDFDict>();
  const blankAll = (d: PDFDict | undefined) => {
    if (!d || seen.has(d)) return;
    seen.add(d);
    d.delete(name('AP'));
    for (const kid of d.lookupMaybe(name('Kids'), PDFArray)?.asArray() ?? []) blankAll(dictOf(kid));
  };
  for (const d of blank) blankAll(d);

  for (const i of pageIndices) {
    const annots = pages[i]?.node.Annots();
    if (!annots) continue;
    for (let k = annots.size() - 1; k >= 0; k--) {
      const d = dictOf(annots.get(k));
      if (d && removed.has(d)) annots.remove(k);
    }
  }
  // Delete them outright: anything still pointing at them (a reply elsewhere, a field's
  // /Kids) would otherwise keep them, and their text, in the file. Those references become null.
  for (const { dict, ref } of entries) if (ref && removed.has(dict)) context.delete(ref);
  for (const ref of dropFields) context.delete(ref);
  return result;
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
