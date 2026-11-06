import type { PageRef, Project, Source } from '../types';
import { uid } from './doc';
import { pageCount } from './pdfjs';

export const isPdf = (f: File) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
/** An image that Images to PDF can read (JPG, PNG, WebP, GIF, HEIC). */
export const isImage = (f: File) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|heic|heif)$/i.test(f.name);

export async function readSources(files: File[]): Promise<Source[]> {
  return Promise.all(
    files.filter(isPdf).map(async (f) => ({ id: uid(), name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) })),
  );
}

export async function pagesOf(sources: Source[]): Promise<PageRef[]> {
  const pages: PageRef[] = [];
  for (const source of sources) {
    const n = await pageCount(source);
    for (let index = 0; index < n; index++) pages.push({ id: uid(), sourceId: source.id, index, rotation: 0 });
  }
  return pages;
}

export async function createProject(files: File[]): Promise<Project | null> {
  const sources = await readSources(files);
  if (!sources.length) return null;
  const now = Date.now();
  return {
    id: uid(),
    name: sources[0].name.replace(/\.pdf$/i, '') + '_edited',
    createdAt: now,
    updatedAt: now,
    sources,
    doc: { pages: await pagesOf(sources), annots: [] },
  };
}

/** Reads an image as a PNG/JPEG data URL (other formats are converted to PNG) with its pixel size. */
export async function readImage(file: File): Promise<{ src: string; w: number; h: number }> {
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const img = new Image();
  img.src = url;
  await img.decode();
  if (/^data:image\/(png|jpeg)/.test(url)) return { src: url, w: img.naturalWidth, h: img.naturalHeight };
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d')!.drawImage(img, 0, 0);
  return { src: canvas.toDataURL('image/png'), w: img.naturalWidth, h: img.naturalHeight };
}

export function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}
