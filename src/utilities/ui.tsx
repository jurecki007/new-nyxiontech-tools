// Building blocks shared by the dashboard tools.
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Download, FileArchive, FilePenLine, Upload, X } from 'lucide-react';
import { downloadBlob, formatBytes, zipFiles } from '../lib/zip';
import { pageCountOf } from '../lib/pdfTools';
import type { Utility, UtilityContext } from './types';

export function ToolPage({ utility, children }: { utility: Utility; children: ReactNode }) {
  return (
    <div className="tool-page">
      <header className="tool-page-head">
        <div className="tool-page-icon">
          <utility.icon size={22} />
        </div>
        <div>
          <h1>{utility.label}</h1>
          <p className="muted">{utility.description}</p>
        </div>
      </header>
      {children}
    </div>
  );
}

export function FileDrop({
  accept,
  multiple,
  onFiles,
  title,
  hint,
  compact,
}: {
  accept: string;
  multiple: boolean;
  onFiles: (files: File[]) => void;
  title: string;
  hint?: string;
  compact?: boolean;
}) {
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`file-drop${over ? ' over' : ''}${compact ? ' compact' : ''}`}
      onClick={() => input.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length) onFiles(multiple ? files : files.slice(0, 1));
      }}
    >
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
      <Upload size={compact ? 18 : 28} />
      <div>
        <b>{title}</b>
        {hint && <span className="muted">{hint}</span>}
      </div>
    </div>
  );
}

/** Selected input files, optionally reorderable. */
export function FileList({
  files,
  onChange,
  reorderable,
  extra,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  reorderable?: boolean;
  extra?: (file: File) => ReactNode;
}) {
  const move = (i: number, d: number) => {
    const next = [...files];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  return (
    <ul className="file-list">
      {files.map((f, i) => (
        <li key={`${f.name}-${f.size}-${f.lastModified}-${i}`}>
          {reorderable && <span className="file-index">{i + 1}</span>}
          <span className="file-name" title={f.name}>
            {f.name}
          </span>
          {extra?.(f)}
          <span className="muted file-size">{formatBytes(f.size)}</span>
          {reorderable && (
            <>
              <button className="icon-btn" title="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                <ArrowUp size={15} />
              </button>
              <button className="icon-btn" title="Move down" disabled={i === files.length - 1} onClick={() => move(i, 1)}>
                <ArrowDown size={15} />
              </button>
            </>
          )}
          <button className="icon-btn danger" title="Remove" onClick={() => onChange(files.filter((_, j) => j !== i))}>
            <X size={15} />
          </button>
        </li>
      ))}
    </ul>
  );
}

export interface OutputFile {
  name: string;
  blob: Blob;
}

/** Download links for produced files, a zip of all of them, and "open in editor" for PDFs. */
export function Results({
  files,
  zipName,
  ctx,
  note,
}: {
  files: OutputFile[];
  zipName: string;
  ctx?: UtilityContext;
  note?: ReactNode;
}) {
  if (!files.length) return null;
  const pdfs = files.filter((f) => f.blob.type === 'application/pdf');
  return (
    <section className="results">
      <div className="results-head">
        <b>
          Done: {files.length} {files.length === 1 ? 'file' : 'files'}
        </b>
        <span className="spacer" />
        {ctx && pdfs.length > 0 && (
          <button
            className="btn ghost"
            onClick={() => ctx.openInEditor(pdfs.map((f) => new File([f.blob], f.name, { type: 'application/pdf' })))}
          >
            <FilePenLine size={16} /> Open in editor
          </button>
        )}
        {files.length > 1 && (
          <button className="btn ghost" onClick={() => void zipFiles(files).then((zip) => downloadBlob(zip, zipName))}>
            <FileArchive size={16} /> Download all (.zip)
          </button>
        )}
        {files.length === 1 && (
          <button className="btn primary" onClick={() => downloadBlob(files[0].blob, files[0].name)}>
            <Download size={16} /> Download
          </button>
        )}
      </div>
      {note && <div className="results-note">{note}</div>}
      {files.length > 1 && (
        <ul className="file-list">
          {files.map((f, i) => (
            <li key={i}>
              <span className="file-name" title={f.name}>
                {f.name}
              </span>
              <span className="muted file-size">{formatBytes(f.blob.size)}</span>
              <button className="icon-btn" title="Download" onClick={() => downloadBlob(f.blob, f.name)}>
                <Download size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Runs a job with busy/progress/error state; the job's errors become messages. */
export function useTask() {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (job: (progress: (done: number, total: number) => void) => Promise<void>) => {
    setBusy(true);
    setError(null);
    setProgress(null);
    try {
      await job((done, total) => setProgress({ done, total }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, []);

  return { busy, progress, error, setError, run };
}

export function RunBar({
  label,
  busy,
  disabled,
  onRun,
  progress,
  error,
}: {
  label: string;
  busy: boolean;
  disabled?: boolean;
  onRun: () => void;
  progress: { done: number; total: number } | null;
  error: string | null;
}) {
  return (
    <div className="run-bar">
      <button className="btn primary big" disabled={busy || disabled} onClick={onRun}>
        {busy ? 'Working…' : label}
      </button>
      {busy && progress && (
        <div className="progress">
          <div className="progress-fill" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          <span>
            {progress.done} / {progress.total}
          </span>
        </div>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={String(o.value)}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          title={o.hint}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Option({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="option">
      <div className="option-label">{label}</div>
      <div className="option-control">
        {children}
        {hint && <div className="hint">{hint}</div>}
      </div>
    </div>
  );
}

/** One PDF input plus its page count, for tools that work on a single file. */
export function useSinglePdf() {
  const [file, setFile] = useState<File | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setBytes(null);
    setPages(null);
    setError(null);
    if (!file) return;
    void (async () => {
      const b = new Uint8Array(await file.arrayBuffer());
      if (!alive) return;
      setBytes(b);
      try {
        const n = await pageCountOf(b);
        if (alive) setPages(n);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [file]);

  return { file, setFile, bytes, pages, error };
}

/** Standard "pick one PDF" block with the file name, page count and a change button. */
export function SinglePdfInput({ pdf, title = 'Choose a PDF' }: { pdf: ReturnType<typeof useSinglePdf>; title?: string }) {
  if (!pdf.file) return <FileDrop accept="application/pdf,.pdf" multiple={false} onFiles={([f]) => pdf.setFile(f)} title={title} hint="or drop it here" />;
  return (
    <div className="single-file">
      <span className="file-name" title={pdf.file.name}>
        {pdf.file.name}
      </span>
      <span className="muted">
        {formatBytes(pdf.file.size)}
        {pdf.pages !== null && ` · ${pdf.pages} ${pdf.pages === 1 ? 'page' : 'pages'}`}
      </span>
      <span className="spacer" />
      <button className="btn ghost" onClick={() => pdf.setFile(null)}>
        Change file
      </button>
      {pdf.error && <p className="error-text full">{pdf.error}</p>}
    </div>
  );
}
