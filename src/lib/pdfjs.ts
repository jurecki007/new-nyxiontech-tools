import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PageInfo, Rotation, Source } from '../types';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const docs = new Map<string, Promise<PDFDocumentProxy>>();
const infos = new Map<string, Promise<PageInfo>>();

export function loadSource(source: Source): Promise<PDFDocumentProxy> {
  let doc = docs.get(source.id);
  if (!doc) {
    // pdf.js transfers the buffer to its worker, so hand it a copy.
    doc = pdfjs.getDocument({ data: source.bytes.slice() }).promise;
    docs.set(source.id, doc);
  }
  return doc;
}

export async function getPage(source: Source, index: number): Promise<PDFPageProxy> {
  return (await loadSource(source)).getPage(index + 1);
}

export function getPageInfo(source: Source, index: number): Promise<PageInfo> {
  const key = `${source.id}:${index}`;
  let info = infos.get(key);
  if (!info) {
    info = getPage(source, index).then((page) => {
      const [x1, y1, x2, y2] = page.view;
      return { base: normalizeRotation(page.rotate), w: x2 - x1, h: y2 - y1 };
    });
    infos.set(key, info);
  }
  return info;
}

export async function pageCount(source: Source): Promise<number> {
  return (await loadSource(source)).numPages;
}

export function normalizeRotation(deg: number): Rotation {
  return ((((Math.round(deg / 90) * 90) % 360) + 360) % 360) as Rotation;
}

/**
 * Renders a page into a canvas at `scale` CSS pixels per point.
 * Returns a cancel function; safe to call after completion.
 */
export function renderPage(
  source: Source,
  index: number,
  rotation: Rotation,
  scale: number,
  canvas: HTMLCanvasElement,
): () => void {
  let cancelled = false;
  let task: RenderTask | null = null;
  void (async () => {
    const page = await getPage(source, index);
    if (cancelled) return;
    const dpr = window.devicePixelRatio || 1;
    const viewport = page.getViewport({ scale: scale * dpr, rotation });
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    task = page.render({ canvasContext: ctx, viewport });
    await task.promise.catch(() => undefined);
  })();
  return () => {
    cancelled = true;
    task?.cancel();
  };
}

/**
 * Opens arbitrary bytes with pdf.js, outside the source cache. The caller owns
 * the result and should `destroy()` it when done.
 */
export function openPdf(bytes: Uint8Array, password?: string): Promise<PDFDocumentProxy> {
  return pdfjs.getDocument({ data: bytes.slice(), password }).promise;
}

/** Renders one page (1-based) to an image blob at the given resolution. */
export async function renderPageToBlob(
  doc: PDFDocumentProxy,
  pageNumber: number,
  dpi: number,
  type: 'image/png' | 'image/jpeg',
  quality = 0.85,
): Promise<{ blob: Blob; width: number; height: number }> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: dpi / 72 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d')!;
  // JPEG has no transparency; give pages a white background like a viewer would.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality),
  );
  page.cleanup();
  return { blob, width: viewport.width / (dpi / 72), height: viewport.height / (dpi / 72) };
}
