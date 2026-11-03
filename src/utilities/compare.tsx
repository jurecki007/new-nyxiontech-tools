import { useState } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { diffLines, pageChanged, pageLines, visualDiff, type DiffLine, type PageVisualDiff } from '../lib/compare';
import { openPdf } from '../lib/pdfjs';
import { formatBytes } from '../lib/zip';
import { FileDrop, Option, RunBar, Segmented, ToolPage, useTask } from './ui';
import type { Utility } from './types';

function PickOne({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File | null) => void }) {
  return file ? (
    <div className="single-file">
      <span className="badge">{label}</span>
      <span className="file-name">{file.name}</span>
      <span className="muted">{formatBytes(file.size)}</span>
      <button className="btn ghost" onClick={() => onFile(null)}>
        Change
      </button>
    </div>
  ) : (
    <FileDrop accept="application/pdf,.pdf" multiple={false} compact onFiles={([f]) => onFile(f)} title={`${label}: choose a PDF`} />
  );
}

export const compareUtility: Utility = {
  id: 'compare',
  label: 'Compare PDFs',
  description: 'Spot the differences between two versions of a document: changed text and changed areas on each page.',
  icon: GitCompareArrows,
  group: 'review',
  Component: function Compare() {
    const [a, setA] = useState<File | null>(null);
    const [b, setB] = useState<File | null>(null);
    const [view, setView] = useState<'text' | 'visual'>('text');
    const [text, setText] = useState<DiffLine[][] | null>(null);
    const [pages, setPages] = useState<PageVisualDiff[] | null>(null);
    const task = useTask();

    const changedText = text?.reduce((n, p) => n + p.filter((l) => l.kind !== 'same').length, 0) ?? 0;
    const changedPages = pages?.filter(pageChanged) ?? [];

    return (
      <ToolPage utility={compareUtility}>
        <PickOne label="Original" file={a} onFile={setA} />
        <PickOne label="Changed" file={b} onFile={setB} />
        <RunBar
          label="Compare"
          disabled={!a || !b}
          {...task}
          onRun={() =>
            task.run(async (progress) => {
              const [da, db] = await Promise.all([openPdf(new Uint8Array(await a!.arrayBuffer())), openPdf(new Uint8Array(await b!.arrayBuffer()))]);
              try {
                const [la, lb] = await Promise.all([pageLines(da), pageLines(db)]);
                const n = Math.max(la.length, lb.length);
                setText(Array.from({ length: n }, (_, i) => diffLines(la[i] ?? [], lb[i] ?? [])));
                const visuals: PageVisualDiff[] = [];
                for (let i = 1; i <= n; i++) {
                  visuals.push(await visualDiff(da, db, i));
                  progress(i, n);
                }
                setPages(visuals);
              } finally {
                void da.destroy();
                void db.destroy();
              }
            })
          }
        />
        {text && pages && (
          <section className="compare">
            <div className="results-head">
              <b>
                {changedText === 0 && changedPages.length === 0
                  ? 'No differences found.'
                  : `${changedText} changed ${changedText === 1 ? 'line' : 'lines'}; ${changedPages.length} of ${pages.length} pages look different.`}
              </b>
              <span className="spacer" />
              <Segmented<'text' | 'visual'>
                value={view}
                onChange={setView}
                options={[
                  { value: 'text', label: 'Text changes' },
                  { value: 'visual', label: 'Visual changes' },
                ]}
              />
            </div>
            {view === 'text' &&
              text.map((lines, i) =>
                lines.some((l) => l.kind !== 'same') ? (
                  <Option key={i} label={`Page ${i + 1}`}>
                    <div className="diff">
                      {lines.map((l, j) =>
                        l.kind === 'same' ? null : (
                          <div key={j} className={`diff-line ${l.kind}`}>
                            <span>{l.kind === 'added' ? '+' : '−'}</span>
                            {l.text}
                          </div>
                        ),
                      )}
                    </div>
                  </Option>
                ) : null,
              )}
            {view === 'visual' && (
              <>
                <p className="hint">
                  <span className="legend red" /> only in the original <span className="legend green" /> only in the changed version
                </p>
                <div className="redact-pages">
                  {pages.map((p) => (
                    <div key={p.page} className="redact-page">
                      <div className="muted">
                        Page {p.page}
                        {p.missingIn ? ` · only in the ${p.missingIn === 'a' ? 'changed' : 'original'} file` : pageChanged(p) ? ' · changed' : ' · no visible change'}
                      </div>
                      <img className="diff-image" src={p.image} alt={`Differences on page ${p.page}`} />
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </ToolPage>
    );
  },
};
