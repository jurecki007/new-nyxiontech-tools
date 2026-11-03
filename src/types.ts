export type Rotation = 0 | 90 | 180 | 270;

/** An uploaded PDF file. Never mutated; pages reference it by id. */
export interface Source {
  id: string;
  name: string;
  bytes: Uint8Array;
}

/** One page of the working document: a page of some source plus a user rotation. */
export interface PageRef {
  id: string;
  sourceId: string;
  index: number;
  rotation: Rotation;
}

/**
 * Annotations live in "view space": points (1/72 in), origin at the top-left
 * of the page as it is displayed (i.e. after rotation), y growing downwards.
 */
interface AnnotBase {
  id: string;
  pageId: string;
  x: number;
  y: number;
  opacity: number;
}

/** Id of a font in the registry (`lib/fontFiles.ts`). */
export type FontId = string;

/** x/y is the left end of the first line's baseline. */
export interface TextAnnot extends AnnotBase {
  kind: 'text';
  text: string;
  font: FontId;
  size: number;
  color: string;
  bold: boolean;
  italic: boolean;
}

/** x/y is the top-left corner. */
export interface RectAnnot extends AnnotBase {
  kind: 'rect';
  w: number;
  h: number;
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
}

export interface ImageAnnot extends AnnotBase {
  kind: 'image';
  w: number;
  h: number;
  /** data: URL, PNG or JPEG */
  src: string;
}

export type Annot = TextAnnot | RectAnnot | ImageAnnot;

/** The undoable part of a project. */
export interface Doc {
  pages: PageRef[];
  annots: Annot[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sources: Source[];
  doc: Doc;
}

export type TextStyle = Pick<TextAnnot, 'font' | 'size' | 'color' | 'bold' | 'italic'>;

export interface Snippet extends TextStyle {
  id: string;
  text: string;
}

/** Unrotated size and built-in /Rotate of a source page. */
export interface PageInfo {
  base: Rotation;
  w: number;
  h: number;
}
