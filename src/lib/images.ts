// Image decoding/encoding in the browser, shared by the image tools and Images → PDF.
import { PDFDocument } from 'pdf-lib';

export const isHeic = (f: File) => /\.(heic|heif)$/i.test(f.name) || /image\/hei[cf]/.test(f.type);

/**
 * Decodes an iPhone HEIC/HEIF photo straight to pixels (libheif applies the
 * photo's rotation itself). Loaded on demand. The `csp` build is libheif compiled
 * without `eval`/`new Function`, so it runs under the app's Content-Security-Policy;
 * it decodes in a blob: worker (allowed by worker-src) and needs no extra files.
 */
async function decodeHeic(file: File): Promise<ImageBitmap> {
  const { heicTo } = await import('heic-to/csp');
  return heicTo({ blob: file, type: 'bitmap' });
}

/** Decodes any supported image, honouring EXIF orientation (phone photos). */
export async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    if (isHeic(file)) return await decodeHeic(file);
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`Could not read ${file.name} as an image.`);
  }
}

export type ImageFormat = 'jpeg' | 'png' | 'webp';

export interface EncodeOptions {
  format: ImageFormat;
  /** 0–1, ignored for PNG. */
  quality: number;
  maxWidth?: number;
  maxHeight?: number;
  /** Fill colour behind transparent areas when writing JPEG. */
  background?: string;
}

export async function encodeImage(bitmap: ImageBitmap, o: EncodeOptions): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, (o.maxWidth || Infinity) / bitmap.width, (o.maxHeight || Infinity) / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (o.format === 'jpeg') {
    ctx.fillStyle = o.background ?? '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), `image/${o.format}`, o.quality),
  );
  return { blob, width, height };
}

export const extensionFor = (format: ImageFormat) => (format === 'jpeg' ? 'jpg' : format);

// ---- Images → PDF --------------------------------------------------------------------

export type PageSizeOption = 'fit' | 'a4' | 'letter';
export type OrientationOption = 'auto' | 'portrait' | 'landscape';

const PAGE_SIZES = { a4: [595.28, 841.89], letter: [612, 792] } as const;

export async function imagesToPdf(
  files: File[],
  o: { pageSize: PageSizeOption; orientation: OrientationOption; margin: number; quality: number },
  onProgress?: (done: number, total: number) => void,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const [i, file] of files.entries()) {
    const bitmap = await decodeImage(file);
    // Re-encoding applies EXIF rotation, which PDF viewers would otherwise ignore.
    const isPng = file.type === 'image/png';
    const { blob } = await encodeImage(bitmap, { format: isPng ? 'png' : 'jpeg', quality: o.quality });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const image = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    // 96 dpi pixels → points for "fit" pages.
    const imgW = bitmap.width * 0.75;
    const imgH = bitmap.height * 0.75;
    bitmap.close();

    let pageW: number;
    let pageH: number;
    if (o.pageSize === 'fit') {
      pageW = imgW + o.margin * 2;
      pageH = imgH + o.margin * 2;
    } else {
      const [w, h] = PAGE_SIZES[o.pageSize];
      const landscape = o.orientation === 'landscape' || (o.orientation === 'auto' && imgW > imgH);
      [pageW, pageH] = landscape ? [h, w] : [w, h];
    }
    const boxW = pageW - o.margin * 2;
    const boxH = pageH - o.margin * 2;
    const scale = o.pageSize === 'fit' ? 1 : Math.min(boxW / imgW, boxH / imgH);
    const w = imgW * scale;
    const h = imgH * scale;
    doc.addPage([pageW, pageH]).drawImage(image, { x: (pageW - w) / 2, y: (pageH - h) / 2, width: w, height: h });
    onProgress?.(i + 1, files.length);
  }
  return doc.save();
}
