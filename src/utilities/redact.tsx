import { useEffect, useRef, useState } from 'react';
import { EyeOff, Search, Trash2 } from 'lucide-react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { openPdf } from '../lib/pdfjs';
import { baseName, pdfBlob } from '../lib/pdfTools';
import { findTextBoxes, redactPdf, REDACT_PATTERNS, type Box } from '../lib/redact';
import { Option, Results, RunBar, SinglePdfInput, ToolPage, useSinglePdf, useTask, type OutputFile } from './ui';
import type { Utility } from './types';

const PREVIEW_WIDTH = 640;

/** One page with its redaction boxes; drag to add a box, click a box to remove it. */
function RedactPage({ doc, index, boxes, onChange }: { doc: PDFDocumentProxy; index: number; boxes: Box[]; onChange: (b: Box[]) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ w: number; h: number; scale: number } | null>(null);
  const [draft, setDraft] = useState<Box | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    void (async () => {
      const page = await doc.getPage(index + 1);
      const base = page.getViewport({ scale: 1 });
      const scale = PREVIEW_WIDTH / base.width;
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: scale * dpr });
      if (cancelled || !canvas.current) return;
      canvas.current.width = viewport.width;
      canvas.current.height = viewport.height;
      setSize({ w: base.width, h: base.height, scale });
      const t = page.render({ canvasContext: canvas.current.getContext('2d')!, viewport });
      task = t;
      await t.promise.catch(() => undefined);
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, index]);

  const point = (e: React.PointerEvent) => {
    const r = (e.currentTarget as Element).getBoundingClientRect();
    return { x: (e.clientX - r.left) / size!.scale, y: (e.clientY - r.top) / size!.scale };
  };

  return (
    <div className="redact-page">
      <div className="muted">
        Page {index + 1}
        {boxes.length > 0 && ` · ${boxes.length} ${boxes.length === 1 ? 'area' : 'areas'}`}
      </div>
      <div className="redact-sheet" style={size ? { width: size.w * size.scale, height: size.h * size.scale } : undefined}>
        <canvas ref={canvas} style={size ? { width: size.w * size.scale, height: size.h * size.scale } : undefined} />
        {size && (
          <svg
            viewBox={`0 0 ${size.w} ${size.h}`}
            onPointerDown={(e) => {
              if ((e.target as Element).tagName === 'rect') return;
              e.currentTarget.setPointerCapture(e.pointerId);
              start.current = point(e);
            }}
            onPointerMove={(e) => {
              if (!start.current) return;
              const p = point(e);
              const s = start.current;
              setDraft({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
            }}
            onPointerUp={() => {
              if (draft && draft.w > 2 && draft.h > 2) onChange([...boxes, draft]);
              start.current = null;
              setDraft(null);
            }}
          >
            {boxes.map((b, i) => (
              <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} className="redact-box" onClick={() => onChange(boxes.filter((_, j) => j !== i))}>
                <title>Click to remove</title>
              </rect>
            ))}
            {draft && <rect x={draft.x} y={draft.y} width={draft.w} height={draft.h} className="redact-box draft" />}
          </svg>
        )}
      </div>
    </div>
  );
}

export const redactUtility: Utility = {
  id: 'redact',
  label: 'Redact PDF',
  description: 'Black out personal or confidential data for good: the hidden text is removed, not just covered.',
  icon: EyeOff,
  group: 'security',
  Component: function Redact({ ctx }) {
    const pdf = useSinglePdf();
    const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
    const [boxes, setBoxes] = useState<Box[][]>([]);
    const [query, setQuery] = useState('');
    const [found, setFound] = useState<string | null>(null);
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();

    useEffect(() => {
      setDoc(null);
      setBoxes([]);
      setOut([]);
      if (!pdf.bytes || !pdf.pages) return;
      let d: PDFDocumentProxy | null = null;
      void openPdf(pdf.bytes).then((x) => {
        d = x;
        setDoc(x);
        setBoxes(Array.from({ length: x.numPages }, () => []));
      });
      return () => void d?.destroy();
    }, [pdf.bytes, pdf.pages]);

    const addMatches = async (q: string | RegExp, label: string) => {
      if (!doc) return;
      const matches = await findTextBoxes(doc, q);
      const count = matches.reduce((n, m) => n + m.length, 0);
      setBoxes((prev) => prev.map((b, i) => [...b, ...(matches[i] ?? [])]));
      setFound(`${label}: ${count} ${count === 1 ? 'match' : 'matches'} marked.`);
    };

    const total = boxes.reduce((n, b) => n + b.length, 0);

    return (
      <ToolPage utility={redactUtility}>
        <SinglePdfInput pdf={pdf} />
        {doc && (
          <>
            <Option label="Find text" hint="Every occurrence gets a black box. You can also drag boxes on the pages below.">
              <div className="row nowrap">
                <input className="text-field" value={query} placeholder="e.g. a name or account number" onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && query.trim() && void addMatches(query.trim(), `"${query.trim()}"`)} />
                <button className="btn ghost" disabled={!query.trim()} onClick={() => void addMatches(query.trim(), `"${query.trim()}"`)}>
                  <Search size={15} /> Mark
                </button>
              </div>
              <div className="chips">
                {REDACT_PATTERNS.map((p) => (
                  <button key={p.id} className="chip" onClick={() => void addMatches(p.regex, p.label)}>
                    + {p.label}
                  </button>
                ))}
              </div>
              {found && <span className="hint">{found}</span>}
            </Option>
            <div className="redact-toolbar">
              <b>
                {total} {total === 1 ? 'area' : 'areas'} to redact
              </b>
              <span className="spacer" />
              <button className="btn ghost" disabled={!total} onClick={() => setBoxes(boxes.map(() => []))}>
                <Trash2 size={15} /> Clear all
              </button>
            </div>
            <div className="redact-pages">
              {boxes.map((b, i) => (
                <RedactPage key={i} doc={doc} index={i} boxes={b} onChange={(nb) => setBoxes(boxes.map((x, j) => (j === i ? nb : x)))} />
              ))}
            </div>
          </>
        )}
        <RunBar
          label="Redact and save"
          disabled={!doc || !total}
          {...task}
          onRun={() =>
            task.run(async (progress) => {
              const bytes = await redactPdf(pdf.bytes!, boxes, 200, progress);
              setOut([{ name: `${baseName(pdf.file!.name)}_redacted.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results
          files={out}
          zipName="redacted.zip"
          ctx={ctx}
          note="Pages with redactions are saved as images (their text is gone); other pages are unchanged. Document properties are cleared."
        />
      </ToolPage>
    );
  },
};
