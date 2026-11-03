// OCR with Tesseract, run fully locally: worker, WASM and language data are
// served from public/vendor (see scripts/copy-assets.mjs).
import {
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  rotateAndSkewTextRadiansAndTranslate,
  setCharacterSqueeze,
  setFontAndSize,
  setTextRenderingMode,
  showText,
  TextRenderingMode,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import type Tesseract from 'tesseract.js';
import { embedRegistryFont, viewToPdf, visibleBox } from './export';
import { closePdf, normalizeRotation, openPdf } from './pdfjs';
import { loadPdf } from './pdfTools';

export type OcrLanguage = 'pol' | 'eng';

const vendor = (path: string) => new URL(`${import.meta.env.BASE_URL}vendor/${path}`, window.location.origin).href;

async function createOcrWorker(langs: OcrLanguage[], onStatus?: (status: string, progress: number) => void) {
  const { createWorker, OEM } = await import('tesseract.js');
  return createWorker(langs, OEM.LSTM_ONLY, {
    workerPath: vendor('tesseract/worker.min.js'),
    corePath: vendor('tesseract-core'),
    langPath: vendor('tessdata'),
    gzip: true,
    workerBlobURL: false,
    logger: (m) => onStatus?.(m.status, m.progress),
  });
}

export interface OcrProgress {
  page: number;
  pages: number;
  status: string;
}

export interface OcrResult {
  pdf: Uint8Array;
  text: string;
  /** Pages skipped because they already had a text layer. */
  skipped: number[];
}

/**
 * Makes a scanned PDF searchable: recognised words are drawn as invisible text
 * over the untouched original page, so it looks the same but can be selected,
 * searched and copied.
 */
export async function ocrPdf(
  bytes: Uint8Array,
  opts: { langs: OcrLanguage[]; dpi: number; skipPagesWithText: boolean },
  onProgress?: (p: OcrProgress) => void,
): Promise<OcrResult> {
  const render = await openPdf(bytes);
  const doc = await loadPdf(bytes);
  const font = await embedRegistryFont(doc, 'arimo');
  let page = 0;
  const worker = await createOcrWorker(opts.langs, (status) => onProgress?.({ page, pages: render.numPages, status }));
  const texts: string[] = [];
  const skipped: number[] = [];
  try {
    for (page = 1; page <= render.numPages; page++) {
      const src = await render.getPage(page);
      if (opts.skipPagesWithText) {
        const content = await src.getTextContent();
        const chars = content.items.reduce((n, it) => n + ('str' in it ? it.str.trim().length : 0), 0);
        if (chars > 20) {
          skipped.push(page);
          texts.push('');
          continue;
        }
      }
      onProgress?.({ page, pages: render.numPages, status: 'rendering page' });
      const scale = opts.dpi / 72;
      const viewport = src.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await src.render({ canvas, viewport }).promise;
      src.cleanup();

      const { data } = await worker.recognize(canvas, {}, { text: true, blocks: true });
      texts.push(data.text.trim());
      addTextLayer(doc.getPage(page - 1), font, data, scale);
    }
  } finally {
    await worker.terminate();
    void closePdf(render);
  }
  return { pdf: await doc.save(), text: texts.filter(Boolean).join('\n\n'), skipped };
}

/** Draws each recognised word as invisible text stretched to the word's box. */
function addTextLayer(page: PDFPage, font: PDFFont, data: Tesseract.Page, scale: number) {
  const rot = normalizeRotation(page.getRotation().angle);
  const toPdf = viewToPdf(visibleBox(page), rot);
  const angle = (rot * Math.PI) / 180;
  const fontKey = page.node.newFontDictionary(font.name, font.ref);
  const ops = [pushGraphicsState(), setTextRenderingMode(TextRenderingMode.Invisible)];

  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        // Baseline in view space, interpolated along the line; fall back to the box bottom.
        const b = line.baseline;
        const top = line.bbox.y0 / scale;
        for (const word of line.words) {
          const text = word.text.trim();
          if (!text || word.confidence < 30) continue;
          const x = word.bbox.x0 / scale;
          const w = (word.bbox.x1 - word.bbox.x0) / scale;
          const t = b && b.x1 !== b.x0 ? (word.bbox.x0 - b.x0) / (b.x1 - b.x0) : 0;
          const baseline = b && b.x1 !== b.x0 ? (b.y0 + (b.y1 - b.y0) * t) / scale : line.bbox.y1 / scale;
          // Ascenders reach about 0.8 of the font size above the baseline in most fonts.
          const size = Math.max(2, (baseline - top) / 0.8);
          const natural = font.widthOfTextAtSize(text, size);
          if (natural <= 0) continue;
          const p = toPdf(x, baseline);
          ops.push(
            beginText(),
            setFontAndSize(fontKey, size),
            setCharacterSqueeze((w / natural) * 100),
            rotateAndSkewTextRadiansAndTranslate(angle, 0, 0, p.x, p.y),
            showText(font.encodeText(text)),
            endText(),
          );
        }
      }
    }
  }
  ops.push(popGraphicsState());
  page.pushOperators(...ops);
}
