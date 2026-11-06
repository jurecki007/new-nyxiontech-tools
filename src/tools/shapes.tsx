import type { ReactNode } from 'react';
import { Eraser, Highlighter, Square, type LucideIcon } from 'lucide-react';
import { ColorField, NumberField } from '../components/fields';
import { ops, uid } from '../lib/doc';
import type { RectAnnot } from '../types';
import { defineModeTool, type ToolOptionsProps } from './types';
import { useT } from '../i18n';

export type RectStyle = Pick<RectAnnot, 'fill' | 'stroke' | 'strokeWidth' | 'opacity'>;

export const RECT_PRESETS = {
  whiteout: { fill: '#ffffff', stroke: null, strokeWidth: 1, opacity: 1 },
  highlight: { fill: '#ffe066', stroke: null, strokeWidth: 1, opacity: 0.45 },
  box: { fill: null, stroke: '#d32f2f', strokeWidth: 1.5, opacity: 1 },
} satisfies Record<string, RectStyle>;

/** Tools that draw a rectangle by dragging; they differ only in style. */
function rectTool(opts: {
  id: keyof typeof RECT_PRESETS;
  icon: LucideIcon;
  shortcut: string;
  Options: (props: ToolOptionsProps<RectStyle>) => ReactNode;
}) {
  return defineModeTool<RectStyle>({
    kind: 'mode',
    group: 'annotate',
    cursor: 'crosshair',
    // Always draw, even when starting over another element.
    selects: () => false,
    defaults: RECT_PRESETS[opts.id],
    ...opts,
    begin: (ctx, start) => {
      const annot: RectAnnot = {
        kind: 'rect',
        id: uid(),
        pageId: ctx.page.id,
        x: start.x,
        y: start.y,
        w: 0,
        h: 0,
        ...RECT_PRESETS[opts.id],
        ...ctx.settings,
      };
      ctx.dispatch({ type: 'checkpoint' });
      ctx.dispatch({ type: 'apply', fn: ops.addAnnot(annot), history: false });
      ctx.select(annot.id);
      let size = { w: 0, h: 0 };
      return {
        move: (p) => {
          size = { w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
          const patch = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), ...size };
          ctx.dispatch({ type: 'apply', fn: ops.updateAnnot(annot.id, patch), history: false });
        },
        end: () => {
          // The tool stays active so several areas can be drawn in a row (Esc or V switches back to Select).
          // The new rectangle stays selected, so its style can be adjusted or it can be deleted right away.
          if (size.w < 3 || size.h < 3) {
            // A click without a drag: forget the empty rectangle.
            ctx.dispatch({ type: 'rollback' });
            ctx.select(null);
          }
        },
      };
    },
  });
}

export const whiteoutTool = rectTool({
  id: 'whiteout',
  icon: Eraser,
  shortcut: 'W',
  Options: function WhiteoutOptions({ value, onChange }) {
    const t = useT();
    return <ColorField label={t.editor.coverColour} value={value.fill ?? '#ffffff'} onChange={(fill) => onChange({ fill })} />;
  },
});

export const highlightTool = rectTool({
  id: 'highlight',
  icon: Highlighter,
  shortcut: 'H',
  Options: function HighlightOptions({ value, onChange }) {
    const t = useT();
    return (
      <div className="row">
        <ColorField label={t.editor.colour} value={value.fill ?? '#ffe066'} onChange={(fill) => onChange({ fill })} />
        <NumberField
          label={t.editor.opacityPercent}
          value={value.opacity * 100}
          min={5}
          step={5}
          onChange={(n) => onChange({ opacity: Math.min(100, n) / 100 })}
        />
      </div>
    );
  },
});

export const boxTool = rectTool({
  id: 'box',
  icon: Square,
  shortcut: 'B',
  Options: function BoxOptions({ value, onChange }) {
    const t = useT();
    return (
      <div className="row">
        <ColorField label={t.editor.border} value={value.stroke ?? '#d32f2f'} onChange={(stroke) => onChange({ stroke })} />
        <NumberField label={t.editor.width} value={value.strokeWidth} min={0.25} step={0.25} onChange={(strokeWidth) => onChange({ strokeWidth })} />
      </div>
    );
  },
});
