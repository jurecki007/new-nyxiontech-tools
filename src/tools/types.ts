import type { Dispatch, FC, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { HistoryAction } from '../lib/doc';
import type { Annot, PageRef } from '../types';

export type Point = { x: number; y: number };
export type Size = { w: number; h: number };

export type ToolGroup = 'general' | 'annotate' | 'insert';

export const TOOL_GROUPS: { id: ToolGroup; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'annotate', label: 'Annotate' },
  { id: 'insert', label: 'Insert' },
];

interface ToolBase {
  id: string;
  label: string;
  icon: LucideIcon;
  group: ToolGroup;
  /** Single key, shown in the sidebar and handled by the editor. */
  shortcut?: string;
  /** One-line explanation shown under the tool options. */
  hint?: string;
}

/** Everything a mode tool may use while handling a pointer on a page. */
export interface PageToolContext<S> {
  page: PageRef;
  /** Displayed page size in points. */
  size: Size;
  settings: S;
  dispatch: Dispatch<HistoryAction>;
  select: (id: string | null) => void;
  setTool: (id: string) => void;
  /** Focuses the text box of the selected text element in the properties panel. */
  editText: () => void;
}

/** Receives the rest of a drag that a tool started. Points are in page view space. */
export interface DragSession {
  move: (p: Point, e: PointerEvent) => void;
  end: () => void;
}

export interface ToolOptionsProps<S> {
  value: S;
  onChange: (patch: Partial<S>) => void;
}

/**
 * A tool that stays active and acts on pointer input on a page
 * (select, text, shapes, ...).
 */
export interface ModeTool<S = any> extends ToolBase {
  kind: 'mode';
  /** CSS cursor over the page. */
  cursor?: string;
  /** Whether clicking an existing element selects it instead of using the tool. Defaults to true. */
  selects?: (annot: Annot) => boolean;
  /** Pointer down on the page. Return a session to receive the drag that follows. */
  begin?: (ctx: PageToolContext<S>, p: Point, e: PointerEvent) => DragSession | void;
  /** Initial settings; the user's changes are remembered per tool. */
  defaults?: S;
  /** Settings UI shown in the tools sidebar while the tool is active. */
  Options?: FC<ToolOptionsProps<S>>;
}

/** Everything an action tool may use. */
export interface EditorToolContext {
  /** Page the user last worked on, and its displayed size. */
  page: PageRef | null;
  size: Size | null;
  add: (annot: Annot) => void;
  setTool: (id: string) => void;
  reportError: (message: string) => void;
  /** Shows a modal; `render` receives a function that closes it. */
  openDialog: (render: (close: () => void) => ReactNode) => void;
}

/** A tool that runs once when picked (e.g. opens a file dialog). */
export interface ActionTool extends ToolBase {
  kind: 'action';
  run: (ctx: EditorToolContext) => void | Promise<void>;
}

export type ToolDef = ModeTool | ActionTool;

/** Identity helper that infers the settings type of a mode tool. */
export const defineModeTool = <S,>(tool: ModeTool<S>): ModeTool<S> => tool;
