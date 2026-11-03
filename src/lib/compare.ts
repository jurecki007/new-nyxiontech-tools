// Comparing two PDFs: a line diff of their text and a pixel diff of each page.
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type DiffLine = { kind: 'same' | 'added' | 'removed'; text: string };

/** Line-level diff (longest common subsequence). */
export function diffLines(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  // For very long documents fall back to a cheaper comparison to stay responsive.
  if (n * m > 4_000_000) {
    const setB = new Set(b);
    const setA = new Set(a);
    return [
      ...a.map((text) => ({ kind: setB.has(text) ? 'same' : 'removed', text }) as DiffLine),
      ...b.filter((t) => !setA.has(t)).map((text) => ({ kind: 'added', text }) as DiffLine),
    ];
  }
  const lcs = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ kind: 'removed', text: a[i++] });
    else out.push({ kind: 'added', text: b[j++] });
  }
  while (i < n) out.push({ kind: 'removed', text: a[i++] });
  while (j < m) out.push({ kind: 'added', text: b[j++] });
  return out;
}

/** Text of every page as trimmed, non-empty lines. */
export async function pageLines(doc: PDFDocumentProxy): Promise<string[][]> {
  const pages: string[][] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent();
    let text = '';
    for (const it of content.items) if ('str' in it) text += it.str + (it.hasEOL ? '\n' : ' ');
    pages.push(
      text
        .split('\n')
        .map((l) => l.replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    );
  }
  return pages;
}

async function renderToCanvas(doc: PDFDocumentProxy, n: number, width: number): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(n);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

export interface PageVisualDiff {
  page: number;
  /** Faded page A with changed pixels in red (removed/moved) and green (added). */
  image: string;
  changedRatio: number;
  changedPixels: number;
  missingIn?: 'a' | 'b';
}

/**
 * Both versions are rendered identically, so unchanged pages differ by zero
 * pixels; a handful is enough to count (a single changed digit is ~50 pixels).
 */
export const pageChanged = (p: PageVisualDiff) => !!p.missingIn || p.changedPixels >= 8;

/** Renders both versions of a page at the same width and marks differing pixels. */
export async function visualDiff(a: PDFDocumentProxy, b: PDFDocumentProxy, n: number, width = 700): Promise<PageVisualDiff> {
  const hasA = n <= a.numPages;
  const hasB = n <= b.numPages;
  if (!hasA || !hasB) {
    const only = await renderToCanvas(hasA ? a : b, n, width);
    return { page: n, image: only.toDataURL('image/png'), changedRatio: 1, changedPixels: Infinity, missingIn: hasA ? 'b' : 'a' };
  }
  const ca = await renderToCanvas(a, n, width);
  const cb = await renderToCanvas(b, n, width);
  const w = ca.width;
  const h = Math.max(ca.height, cb.height);
  const da = ca.getContext('2d')!.getImageData(0, 0, w, h).data;
  const db = cb.getContext('2d')!.getImageData(0, 0, w, h).data;
  const out = new ImageData(w, h);
  const o = out.data;
  let changed = 0;
  for (let i = 0; i < o.length; i += 4) {
    const la = (da[i] + da[i + 1] + da[i + 2]) / 3;
    const lb = (db[i] + db[i + 1] + db[i + 2]) / 3;
    if (Math.abs(la - lb) > 40) {
      changed++;
      // Darker in A than in B: something was there and is gone; otherwise it is new.
      if (la < lb) o.set([220, 38, 38, 255], i);
      else o.set([22, 163, 74, 255], i);
    } else {
      const faded = 255 - (255 - la) * 0.25;
      o.set([faded, faded, faded, 255], i);
    }
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d')!.putImageData(out, 0, 0);
  return { page: n, image: canvas.toDataURL('image/png'), changedRatio: changed / (w * h), changedPixels: changed };
}
