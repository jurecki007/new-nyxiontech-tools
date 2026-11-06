// Fonts are bundled TTFs used both on screen (via FontFace) and embedded on export,
// so text measures identically in the editor and in the PDF. All of them cover Polish
// diacritics, unlike the 14 standard PDF fonts.
import { FONT_LIST } from './fontFiles';
import type { FontId } from '../types';

export const LINE_HEIGHT = 1.2;

export type Face = 'regular' | 'bold' | 'italic' | 'boldItalic';

export interface FontDef {
  id: FontId;
  label: string;
  category: 'sans' | 'serif' | 'mono' | 'script';
  /** Shown next to the name, e.g. which core font it is metric-compatible with. */
  note?: string;
  /** URLs of the available faces; `regular` is always present. */
  faces: Partial<Record<Face, string>> & { regular: string };
}

/** Font menu sections, in order. Their names are in the dictionaries (src/i18n, `editor.fontCategories`). */
export const FONT_CATEGORIES: { id: FontDef['category'] }[] = [{ id: 'sans' }, { id: 'serif' }, { id: 'mono' }, { id: 'script' }];

export const FONTS = FONT_LIST;

/** Arimo has Arial's metrics, which matches most generated invoices. */
export const DEFAULT_FONT: FontId = 'arimo';

const byId = new Map(FONTS.map((f) => [f.id, f]));

export function getFont(id: FontId): FontDef {
  return byId.get(id) ?? byId.get('sans')!;
}

export function hasFace(id: FontId, bold: boolean, italic: boolean): boolean {
  return !!getFont(id).faces[faceKey(bold, italic)];
}

function faceKey(bold: boolean, italic: boolean): Face {
  return bold ? (italic ? 'boldItalic' : 'bold') : italic ? 'italic' : 'regular';
}

/**
 * The face actually used for a style. Fonts without a bold or italic variant
 * fall back to the closest one instead of letting the browser fake it.
 */
export function resolveFace(id: FontId, bold: boolean, italic: boolean): { url: string; bold: boolean; italic: boolean } {
  const { faces } = getFont(id);
  for (const [b, i] of [
    [bold, italic],
    [bold, false],
    [false, italic],
    [false, false],
  ] as const) {
    const url = faces[faceKey(b, i)];
    if (url) return { url, bold: b, italic: i };
  }
  return { url: faces.regular, bold: false, italic: false };
}

export function cssFamily(id: FontId): string {
  return `PdfFont-${getFont(id).id}`;
}

/** SVG/CSS props for rendering text in a given font and style. */
export function fontStyle(id: FontId, bold: boolean, italic: boolean) {
  const face = resolveFace(id, bold, italic);
  return {
    fontFamily: cssFamily(id),
    fontWeight: face.bold ? 700 : 400,
    fontStyle: face.italic ? 'italic' : 'normal',
    fontSynthesis: 'none',
  } as const;
}

const loading = new Map<string, Promise<void>>();

function loadFace(font: FontDef, face: Face): Promise<void> {
  const url = font.faces[face];
  if (!url) return Promise.resolve();
  const key = `${font.id}:${face}`;
  const existing = loading.get(key);
  if (existing) return existing;
  const fontFace = new FontFace(cssFamily(font.id), `url(${url})`, {
    weight: face === 'bold' || face === 'boldItalic' ? '700' : '400',
    style: face === 'italic' || face === 'boldItalic' ? 'italic' : 'normal',
  });
  const p = fontFace.load().then(
    (f) => {
      document.fonts.add(f);
    },
    () => {
      // Allow a retry next time.
      loading.delete(key);
    },
  );
  loading.set(key, p);
  return p;
}

/** Loads every face of the given fonts for on-screen use. Resolves once all are ready. */
export function loadFonts(ids: Iterable<FontId>): Promise<void> {
  return Promise.all(
    [...new Set(ids)].flatMap((id) => {
      const font = getFont(id);
      return (Object.keys(font.faces) as Face[]).map((face) => loadFace(font, face));
    }),
  ).then(() => undefined);
}

/** Loads just the regular face of every font, for previews in the font picker. */
export function loadFontPreviews(): Promise<void> {
  return Promise.all(FONTS.map((f) => loadFace(f, 'regular'))).then(() => undefined);
}
