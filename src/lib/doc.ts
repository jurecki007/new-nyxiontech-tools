import type { Annot, Doc, PageInfo, PageRef, Rotation } from '../types';

export const uid = () => crypto.randomUUID();

/** Rotation the page is displayed with: built-in /Rotate plus the user's rotation. */
export function effectiveRotation(info: PageInfo, page: PageRef): Rotation {
  return ((info.base + page.rotation) % 360) as Rotation;
}

/** Displayed page size in points. */
export function viewSize(info: PageInfo, page: PageRef): { w: number; h: number } {
  return effectiveRotation(info, page) % 180 === 0 ? { w: info.w, h: info.h } : { w: info.h, h: info.w };
}

// ---- Undo history -------------------------------------------------------

const HISTORY_LIMIT = 200;

export interface HistoryState {
  doc: Doc;
  past: Doc[];
  future: Doc[];
}

export type HistoryAction =
  | { type: 'reset'; doc: Doc }
  /** Applies a change. `history: false` is for continuous edits after a `checkpoint`. */
  | { type: 'apply'; fn: (doc: Doc) => Doc; history: boolean }
  /** Records the current doc as an undo step before a series of `history: false` edits. */
  | { type: 'checkpoint' }
  /** Throws away everything since the last checkpoint. */
  | { type: 'rollback' }
  | { type: 'undo' }
  | { type: 'redo' };

/** Drops trailing checkpoints that never got followed by a change. */
function trimPast(past: Doc[], doc: Doc): Doc[] {
  let end = past.length;
  while (end > 0 && past[end - 1] === doc) end--;
  return end === past.length ? past : past.slice(0, end);
}

export function historyReducer(s: HistoryState, a: HistoryAction): HistoryState {
  switch (a.type) {
    case 'reset':
      return { doc: a.doc, past: [], future: [] };
    case 'checkpoint':
      if (s.past.at(-1) === s.doc) return s;
      return { doc: s.doc, past: [...s.past, s.doc].slice(-HISTORY_LIMIT), future: [] };
    case 'rollback':
      if (!s.past.length) return s;
      return { doc: s.past.at(-1)!, past: s.past.slice(0, -1), future: s.future };
    case 'apply': {
      const doc = a.fn(s.doc);
      if (doc === s.doc) return s;
      if (!a.history) return { ...s, doc };
      return { doc, past: [...trimPast(s.past, s.doc), s.doc].slice(-HISTORY_LIMIT), future: [] };
    }
    case 'undo': {
      const past = trimPast(s.past, s.doc);
      if (!past.length) return s.past === past ? s : { ...s, past };
      return { doc: past.at(-1)!, past: past.slice(0, -1), future: [s.doc, ...s.future] };
    }
    case 'redo':
      if (!s.future.length) return s;
      return { doc: s.future[0], past: [...trimPast(s.past, s.doc), s.doc], future: s.future.slice(1) };
  }
}

export function canUndo(s: HistoryState) {
  return trimPast(s.past, s.doc).length > 0;
}

// ---- Doc operations (pure, curried for `apply`) --------------------------

export const ops = {
  addAnnot: (annot: Annot) => (d: Doc): Doc => ({ ...d, annots: [...d.annots, annot] }),

  updateAnnot:
    (id: string, patch: Partial<Annot>) =>
    (d: Doc): Doc => ({
      ...d,
      annots: d.annots.map((a) => (a.id === id ? ({ ...a, ...patch } as Annot) : a)),
    }),

  removeAnnot: (id: string) => (d: Doc): Doc => ({ ...d, annots: d.annots.filter((a) => a.id !== id) }),

  /** Moves an annotation to the top (`front`) or bottom of the stacking order. */
  restack:
    (id: string, front: boolean) =>
    (d: Doc): Doc => {
      const annot = d.annots.find((a) => a.id === id);
      if (!annot) return d;
      const rest = d.annots.filter((a) => a.id !== id);
      return { ...d, annots: front ? [...rest, annot] : [annot, ...rest] };
    },

  insertPages:
    (pages: PageRef[], afterId: string | null) =>
    (d: Doc): Doc => {
      const at = afterId ? d.pages.findIndex((p) => p.id === afterId) + 1 : d.pages.length;
      return { ...d, pages: [...d.pages.slice(0, at), ...pages, ...d.pages.slice(at)] };
    },

  removePage: (id: string) => (d: Doc): Doc => ({
    pages: d.pages.filter((p) => p.id !== id),
    annots: d.annots.filter((a) => a.pageId !== id),
  }),

  duplicatePage:
    (id: string, newId: string) =>
    (d: Doc): Doc => {
      const i = d.pages.findIndex((p) => p.id === id);
      if (i < 0) return d;
      const copy = { ...d.pages[i], id: newId };
      const annots = d.annots.filter((a) => a.pageId === id).map((a) => ({ ...a, id: uid(), pageId: newId }));
      return {
        pages: [...d.pages.slice(0, i + 1), copy, ...d.pages.slice(i + 1)],
        annots: [...d.annots, ...annots],
      };
    },

  movePage:
    (id: string, to: number) =>
    (d: Doc): Doc => {
      const from = d.pages.findIndex((p) => p.id === id);
      if (from < 0 || from === to) return d;
      const pages = [...d.pages];
      const [page] = pages.splice(from, 1);
      pages.splice(Math.max(0, Math.min(to, pages.length)), 0, page);
      return { ...d, pages };
    },

  /**
   * Rotates a page by 90° (clockwise when `cw`) and carries its annotations
   * along so they stay over the same content. `size` is the size before rotating.
   */
  rotatePage:
    (id: string, cw: boolean, size: { w: number; h: number }) =>
    (d: Doc): Doc => ({
      pages: d.pages.map((p) =>
        p.id === id ? { ...p, rotation: (((p.rotation + (cw ? 90 : 270)) % 360) as Rotation) } : p,
      ),
      annots: d.annots.map((a) => {
        if (a.pageId !== id) return a;
        const turn = (x: number, y: number) => (cw ? { x: size.h - y, y: x } : { x: y, y: size.w - x });
        if (a.kind === 'text') return { ...a, ...turn(a.x, a.y) };
        if (a.kind === 'image') {
          // Images are not rotated themselves, so keep their size and move their centre.
          const c = turn(a.x + a.w / 2, a.y + a.h / 2);
          return { ...a, x: c.x - a.w / 2, y: c.y - a.h / 2 };
        }
        return cw
          ? { ...a, x: size.h - (a.y + a.h), y: a.x, w: a.h, h: a.w }
          : { ...a, x: a.y, y: size.w - (a.x + a.w), w: a.h, h: a.w };
      }),
    }),
};
