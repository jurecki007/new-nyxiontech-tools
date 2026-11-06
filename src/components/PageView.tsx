import { useEffect, useRef, type Dispatch } from 'react';
import { AnnotShape } from './AnnotShape';
import { effectiveRotation, ops, viewSize, type HistoryAction } from '../lib/doc';
import { renderPage } from '../lib/pdfjs';
import type { ModeTool } from '../tools';
import type { DragSession } from '../tools/types';
import type { Annot, ImageAnnot, PageInfo, PageRef, RectAnnot, Source } from '../types';
import { useT } from '../i18n';

/** Moving and resizing are shared by all tools; anything else is the tool's own session. */
type Drag =
  | { mode: 'move' | 'resize'; id: string; start: { x: number; y: number }; orig: Annot; moved: boolean }
  | { mode: 'tool'; session: DragSession };

interface Props {
  page: PageRef;
  number: number;
  source: Source;
  info: PageInfo;
  zoom: number;
  annots: Annot[];
  selectedId: string | null;
  tool: ModeTool;
  toolSettings: unknown;
  active: boolean;
  fontsVersion: number;
  dispatch: Dispatch<HistoryAction>;
  onActivate: () => void;
  onSelect: (id: string | null) => void;
  onEditText: () => void;
  setTool: (id: string) => void;
}

export function PageView(props: Props) {
  const { page, source, info, zoom, annots, tool, dispatch, onSelect } = props;
  const rotation = effectiveRotation(info, page);
  const size = viewSize(info, page);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const t = useT();

  useEffect(() => {
    if (!canvasRef.current) return;
    return renderPage(source, page.index, rotation, zoom, canvasRef.current);
  }, [source, page.index, rotation, zoom]);

  const point = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom };
  };
  const find = (id: string | null | undefined) => (id ? annots.find((a) => a.id === id) : undefined);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return;
    props.onActivate();
    const p = point(e);
    const el = e.target as Element;
    const handle = find(el.closest('[data-handle]')?.getAttribute('data-handle'));
    const hit = find(el.closest('[data-annot]')?.getAttribute('data-annot'));
    let next: Drag | null = null;

    if (handle) {
      next = { mode: 'resize', id: handle.id, start: p, orig: handle, moved: false };
    } else if (hit && (tool.selects?.(hit) ?? true)) {
      onSelect(hit.id);
      next = { mode: 'move', id: hit.id, start: p, orig: hit, moved: false };
    } else if (tool.begin) {
      const session = tool.begin(
        {
          page,
          size,
          settings: props.toolSettings,
          dispatch,
          select: onSelect,
          setTool: props.setTool,
          editText: props.onEditText,
        },
        p,
        e.nativeEvent,
      );
      if (session) next = { mode: 'tool', session };
      else e.preventDefault();
    } else {
      onSelect(null);
    }

    if (next) {
      drag.current = next;
      svgRef.current!.setPointerCapture(e.pointerId);
      e.preventDefault();
    }
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) return;
    const p = point(e);
    if (d.mode === 'tool') {
      d.session.move(p, e.nativeEvent);
      return;
    }

    const dx = p.x - d.start.x;
    const dy = p.y - d.start.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) * zoom < 3) return;
      d.moved = true;
      dispatch({ type: 'checkpoint' });
    }

    let patch: Partial<Annot>;
    if (d.mode === 'move') {
      patch = { x: d.orig.x + dx, y: d.orig.y + dy };
    } else {
      const o = d.orig as RectAnnot | ImageAnnot;
      let w = Math.max(4, o.w + dx);
      let h = Math.max(4, o.h + dy);
      if (o.kind === 'image' && !e.shiftKey) {
        const ratio = o.w / o.h;
        if (w / h > ratio) h = w / ratio;
        else w = h * ratio;
      }
      patch = { w, h };
    }
    dispatch({ type: 'apply', fn: ops.updateAnnot(d.id, patch), history: false });
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (d?.mode === 'tool') d.session.end();
  }

  function onDoubleClick(e: React.MouseEvent) {
    const hit = find((e.target as Element).closest('[data-annot]')?.getAttribute('data-annot'));
    if (hit?.kind === 'text') props.onEditText();
  }

  return (
    <div className={`page${props.active ? ' active' : ''}`} id={`page-${page.id}`}>
      <div className="page-label">
        {t.editor.page(props.number)}
        {page.rotation ? t.editor.rotated(page.rotation) : ''}
      </div>
      <div className="page-sheet" style={{ width: size.w * zoom, height: size.h * zoom }}>
        <canvas ref={canvasRef} style={{ width: size.w * zoom, height: size.h * zoom }} />
        <svg
          ref={svgRef}
          className="overlay"
          style={{ cursor: tool.cursor }}
          width={size.w * zoom}
          height={size.h * zoom}
          viewBox={`0 0 ${size.w} ${size.h}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          {annots.map((a) => (
            <AnnotShape
              key={a.id}
              annot={a}
              selected={a.id === props.selectedId}
              interactive
              zoom={zoom}
              fontsVersion={props.fontsVersion}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
