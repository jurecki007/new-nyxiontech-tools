import { useEffect, useRef, type Dispatch } from 'react';
import { BringToFront, Copy, SendToBack, Stamp, Trash2 } from 'lucide-react';
import { ColorField, NumberField, TextStyleFields } from './fields';
import { ops, uid, type HistoryAction } from '../lib/doc';
import { RECT_PRESETS } from '../tools/shapes';
import type { Annot, TextAnnot } from '../types';
import { useT } from '../i18n';

interface Props {
  annot: Annot | null;
  dispatch: Dispatch<HistoryAction>;
  focusToken: number;
  onSelect: (id: string | null) => void;
  onSaveSnippet: (annot: TextAnnot) => void;
}

export function Inspector({ annot: a, dispatch, focusToken, onSelect, onSaveSnippet }: Props) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const t = useT();

  useEffect(() => {
    if (!focusToken || !textRef.current) return;
    textRef.current.focus();
    textRef.current.select();
  }, [focusToken]);

  if (!a) {
    return (
      <section className="panel">
        <div className="panel-title">{t.editor.properties}</div>
        <p className="hint">{t.editor.propertiesHint}</p>
        <p className="hint">
          {t.editor.changeTextBefore} <b>{t.editor.tools.whiteout.label}</b> {t.editor.changeTextAfter}
        </p>
      </section>
    );
  }

  // Continuous inputs (typing, sliders, pickers) record one undo step on focus, then edit live.
  const checkpoint = () => dispatch({ type: 'checkpoint' });
  const live = (patch: Partial<Annot>) => dispatch({ type: 'apply', fn: ops.updateAnnot(a.id, patch), history: false });
  const commit = (patch: Partial<Annot>) => dispatch({ type: 'apply', fn: ops.updateAnnot(a.id, patch), history: true });

  const title = t.editor.kinds[a.kind];

  return (
    <section className="panel">
      <div className="panel-title">{title}</div>

      {a.kind === 'text' && (
        <>
          <textarea
            ref={textRef}
            className="text-input"
            rows={3}
            value={a.text}
            onFocus={checkpoint}
            onChange={(e) => live({ text: e.target.value })}
          />
          <TextStyleFields value={a} onBeginEdit={checkpoint} onChange={(patch, discrete) => (discrete ? commit(patch) : live(patch))} />
        </>
      )}

      {a.kind === 'rect' && (
        <>
          <div className="row presets">
            <button className="chip" onClick={() => commit(RECT_PRESETS.whiteout)}>{t.editor.presets.whiteout}</button>
            <button className="chip" onClick={() => commit(RECT_PRESETS.highlight)}>{t.editor.presets.highlight}</button>
            <button className="chip" onClick={() => commit(RECT_PRESETS.box)}>{t.editor.presets.box}</button>
          </div>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={a.fill !== null} onChange={(e) => commit({ fill: e.target.checked ? '#ffffff' : null })} />
              {t.editor.fill}
            </label>
            {a.fill !== null && <ColorField label="" value={a.fill} onFocus={checkpoint} onChange={(fill) => live({ fill })} />}
          </div>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={a.stroke !== null} onChange={(e) => commit({ stroke: e.target.checked ? '#000000' : null })} />
              {t.editor.border}
            </label>
            {a.stroke !== null && <ColorField label="" value={a.stroke} onFocus={checkpoint} onChange={(stroke) => live({ stroke })} />}
            {a.stroke !== null && (
              <NumberField label={t.editor.width} value={a.strokeWidth} min={0.25} step={0.25} onFocus={checkpoint} onChange={(strokeWidth) => live({ strokeWidth })} />
            )}
          </div>
        </>
      )}

      <div className="row">
        <NumberField label="X" value={a.x} onFocus={checkpoint} onChange={(x) => live({ x })} />
        <NumberField label="Y" value={a.y} onFocus={checkpoint} onChange={(y) => live({ y })} />
      </div>
      {a.kind !== 'text' && (
        <div className="row">
          <NumberField label={t.editor.w} value={a.w} min={1} onFocus={checkpoint} onChange={(w) => live({ w })} />
          <NumberField label={t.editor.h} value={a.h} min={1} onFocus={checkpoint} onChange={(h) => live({ h })} />
        </div>
      )}

      <label className="field">
        <span>{t.editor.opacity(Math.round(a.opacity * 100))}</span>
        <input
          type="range"
          min={5}
          max={100}
          value={Math.round(a.opacity * 100)}
          onFocus={checkpoint}
          onPointerDown={checkpoint}
          onChange={(e) => live({ opacity: Number(e.target.value) / 100 })}
        />
      </label>

      <div className="row actions">
        <button className="icon-btn" title={t.editor.bringToFront} onClick={() => dispatch({ type: 'apply', fn: ops.restack(a.id, true), history: true })}>
          <BringToFront size={16} />
        </button>
        <button className="icon-btn" title={t.editor.sendToBack} onClick={() => dispatch({ type: 'apply', fn: ops.restack(a.id, false), history: true })}>
          <SendToBack size={16} />
        </button>
        <button
          className="icon-btn"
          title={t.editor.duplicate}
          onClick={() => {
            const copy = { ...a, id: uid(), x: a.x + 10, y: a.y + 10 };
            dispatch({ type: 'apply', fn: ops.addAnnot(copy), history: true });
            onSelect(copy.id);
          }}
        >
          <Copy size={16} />
        </button>
        {a.kind === 'text' && (
          <button className="icon-btn" title={t.editor.saveSnippet} onClick={() => onSaveSnippet(a)}>
            <Stamp size={16} />
          </button>
        )}
        <span className="spacer" />
        <button
          className="icon-btn danger"
          title={t.editor.delete}
          onClick={() => {
            dispatch({ type: 'apply', fn: ops.removeAnnot(a.id), history: true });
            onSelect(null);
          }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </section>
  );
}
