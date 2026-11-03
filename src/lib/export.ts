import { PDFDocument, PDFPage, degrees, rgb, type PDFFont, type PDFImage } from 'pdf-lib';
import { LINE_HEIGHT, resolveFace } from './fonts';
import { fontkitAdapter } from './fontkitAdapter';
import { normalizeRotation } from './pdfjs';
import type { Doc, Rotation, Source } from '../types';

export function hexColor(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Visible page area, as pdf.js computes it: crop box clipped to the media box. */
export function visibleBox(page: PDFPage) {
  const m = page.getMediaBox();
  const c = page.getCropBox();
  const x = Math.max(m.x, c.x);
  const y = Math.max(m.y, c.y);
  return { x, y, w: Math.min(m.x + m.width, c.x + c.width) - x, h: Math.min(m.y + m.height, c.y + c.height) - y };
}

/** Maps a view-space point (top-left origin, after rotation) to PDF user space. */
export function viewToPdf(box: { x: number; y: number; w: number; h: number }, rot: Rotation) {
  return (vx: number, vy: number): { x: number; y: number } => {
    switch (rot) {
      case 0:
        return { x: box.x + vx, y: box.y + box.h - vy };
      case 90:
        return { x: box.x + vy, y: box.y + vx };
      case 180:
        return { x: box.x + box.w - vx, y: box.y + vy };
      case 270:
        return { x: box.x + box.w - vy, y: box.y + box.h - vx };
    }
  };
}

/** Builds the final PDF: copies pages in order, applies rotation and draws annotations. */
export async function exportPdf(sources: Source[], doc: Doc): Promise<Uint8Array> {
  const out = await PDFDocument.create();
  out.registerFontkit(fontkitAdapter);

  const loaded = new Map<string, Promise<PDFDocument>>();
  const fonts = new Map<string, Promise<PDFFont>>();
  const images = new Map<string, Promise<PDFImage>>();

  const loadSource = (id: string) => {
    let d = loaded.get(id);
    if (!d) {
      const source = sources.find((s) => s.id === id);
      if (!source) throw new Error(`Missing source ${id}`);
      d = PDFDocument.load(source.bytes, { ignoreEncryption: true });
      loaded.set(id, d);
    }
    return d;
  };
  const getFont = (url: string) => {
    let f = fonts.get(url);
    if (!f) {
      f = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((bytes) => out.embedFont(bytes, { subset: true }));
      fonts.set(url, f);
    }
    return f;
  };
  const getImage = (src: string) => {
    let img = images.get(src);
    if (!img) {
      img = fetch(src)
        .then((r) => r.arrayBuffer())
        .then((bytes) => (src.startsWith('data:image/png') ? out.embedPng(bytes) : out.embedJpg(bytes)));
      images.set(src, img);
    }
    return img;
  };

  for (const ref of doc.pages) {
    const [page] = await out.copyPages(await loadSource(ref.sourceId), [ref.index]);
    out.addPage(page);
    const rot = normalizeRotation(page.getRotation().angle + ref.rotation);
    page.setRotation(degrees(rot));
    const toPdf = viewToPdf(visibleBox(page), rot);
    const rotate = degrees(rot);

    for (const a of doc.annots) {
      if (a.pageId !== ref.id) continue;
      if (a.kind === 'text') {
        const font = await getFont(resolveFace(a.font, a.bold, a.italic).url);
        a.text.split('\n').forEach((line, i) => {
          if (!line) return;
          const p = toPdf(a.x, a.y + i * a.size * LINE_HEIGHT);
          page.drawText(line, { ...p, size: a.size, font, color: hexColor(a.color), opacity: a.opacity, rotate });
        });
      } else if (a.kind === 'rect') {
        // pdf-lib rotates rectangles and images around their bottom-left corner.
        const p = toPdf(a.x, a.y + a.h);
        page.drawRectangle({
          ...p,
          width: a.w,
          height: a.h,
          rotate,
          color: a.fill ? hexColor(a.fill) : undefined,
          opacity: a.opacity,
          borderColor: a.stroke ? hexColor(a.stroke) : undefined,
          borderWidth: a.stroke ? a.strokeWidth : 0,
          borderOpacity: a.opacity,
        });
      } else {
        const p = toPdf(a.x, a.y + a.h);
        page.drawImage(await getImage(a.src), { ...p, width: a.w, height: a.h, rotate, opacity: a.opacity });
      }
    }
  }
  return out.save();
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Embeds a font from the registry into a document (subset), using fontkit 2. */
export async function embedRegistryFont(doc: PDFDocument, id: string, bold = false, italic = false): Promise<PDFFont> {
  doc.registerFontkit(fontkitAdapter);
  const bytes = await (await fetch(resolveFace(id, bold, italic).url)).arrayBuffer();
  return doc.embedFont(bytes, { subset: true });
}
