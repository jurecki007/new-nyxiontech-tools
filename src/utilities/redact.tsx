import { useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff, Search, Trash2 } from 'lucide-react';
import type { PDFDocument } from 'pdf-lib';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { closePdf, openPdf } from '../lib/pdfjs';
import { baseName, loadPdf, pdfBlob } from '../lib/pdfTools';
import { cleanAnnotations, findTextBoxes, redactPdf, REDACT_PATTERNS, type AnnotationCleanup, type Box, type RedactQuery } from '../lib/redact';
import { Option, Results, RunBar, SinglePdfInput, ToolPage, useSinglePdf, useTask, type OutputFile } from './ui';
import type { Utility } from './types';

const PREVIEW_WIDTH = 640;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "1 comment will be removed · 2 form fields will be cleared", or '' when there is nothing. */
function cleanupText({ comments, fields }: AnnotationCleanup): string {
  const parts: string[] = [];
  if (comments) parts.push(`${plural(comments, 'comment', 'comments')} will be removed`);
  if (fields) parts.push(`${plural(fields, 'form field', 'form fields')} will be cleared`);
  return parts.join(' · ');
}

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
      const t = page.render({ canvas: canvas.current, viewport });
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
    // pdf-lib's view of the file, to find comments and form fields that match a search.
    const [lib, setLib] = useState<PDFDocument | null>(null);
    // Every text or preset marked so far: comments and form fields that match them are removed too.
    const [queries, setQueries] = useState<RedactQuery[]>([]);
    const [query, setQuery] = useState('');
    const [found, setFound] = useState<string | null>(null);
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();

    useEffect(() => {
      setDoc(null);
      setBoxes([]);
      setQueries([]);
      setLib(null);
      setOut([]);
      if (!pdf.bytes || !pdf.pages) return;
      let d: PDFDocumentProxy | null = null;
      let cancelled = false;
      void loadPdf(pdf.bytes).then(
        (x) => !cancelled && setLib(x),
        () => undefined,
      );
      void openPdf(pdf.bytes).then((x) => {
        d = x;
        setDoc(x);
        setBoxes(Array.from({ length: x.numPages }, () => []));
      });
      return () => {
        cancelled = true;
        if (d) void closePdf(d);
      };
    }, [pdf.bytes, pdf.pages]);

    const allPages = (d: PDFDocument) => d.getPages().map((_, i) => i);

    const addMatches = async (q: RedactQuery, label: string) => {
      if (!doc) return;
      const matches = await findTextBoxes(doc, q);
      const count = matches.reduce((n, m) => n + m.length, 0);
      setBoxes((prev) => prev.map((b, i) => [...b, ...(matches[i] ?? [])]));
      setQueries((prev) => [...prev, q]);
      const extra = lib ? cleanupText(cleanAnnotations(lib, allPages(lib), [q], false)) : '';
      setFound(`${label}: ${count} ${count === 1 ? 'match' : 'matches'} marked.${extra ? ` Also ${extra.replace(/ · /g, ', ')}.` : ''}`);
    };

    const total = boxes.reduce((n, b) => n + b.length, 0);
    const cleanup = useMemo(() => (lib ? cleanAnnotations(lib, allPages(lib), queries, false) : { comments: 0, fields: 0 }), [lib, queries]);
    const extra = cleanupText(cleanup);
    const anything = total > 0 || extra !== '';

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
              {extra && <span className="muted redact-extra">· {extra}</span>}
              <span className="spacer" />
              <button
                className="btn ghost"
                disabled={!anything}
                onClick={() => {
                  setBoxes(boxes.map(() => []));
                  setQueries([]);
                }}
              >
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
          disabled={!doc || !anything}
          {...task}
          onRun={() =>
            task.run(async (progress) => {
              const bytes = await redactPdf(pdf.bytes!, boxes, 200, progress, queries);
              setOut([{ name: `${baseName(pdf.file!.name)}_redacted.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results
          files={out}
          zipName="redacted.zip"
          ctx={ctx}
          note="Pages with redactions are saved as images (their text is gone); other pages are unchanged, except that comments and form field values containing the searched text are removed. Document properties are cleared."
        />
      </ToolPage>
    );
  },
};
