import { useState } from 'react';
import { GitCompareArrows } from 'lucide-react';
import { diffLines, pageChanged, pageLines, visualDiff, type DiffLine, type PageVisualDiff } from '../lib/compare';
import { closePdf, openPdf } from '../lib/pdfjs';
import { formatBytes } from '../lib/zip';
import { FileDrop, Option, RunBar, Segmented, ToolPage, useTask } from './ui';
import type { Utility } from './types';
import { useT } from '../i18n';

function PickOne({ label, file, onFile }: { label: string; file: File | null; onFile: (f: File | null) => void }) {
  const t = useT();
  return file ? (
    <div className="single-file">
      <span className="badge">{label}</span>
      <span className="file-name">{file.name}</span>
      <span className="muted">{formatBytes(file.size)}</span>
      <button className="btn ghost" onClick={() => onFile(null)}>
        {t.common.change}
      </button>
    </div>
  ) : (
    <FileDrop accept="application/pdf,.pdf" multiple={false} compact onFiles={([f]) => onFile(f)} title={t.compare.choose(label)} />
  );
}

export const compareUtility: Utility = {
  id: 'compare',
  icon: GitCompareArrows,
  group: 'review',
  Component: function Compare() {
    const [a, setA] = useState<File | null>(null);
    const [b, setB] = useState<File | null>(null);
    const [view, setView] = useState<'text' | 'visual'>('text');
    const [text, setText] = useState<DiffLine[][] | null>(null);
    const [pages, setPages] = useState<PageVisualDiff[] | null>(null);
    const task = useTask();
    const t = useT().compare;

    const changedText = text?.reduce((n, p) => n + p.filter((l) => l.kind !== 'same').length, 0) ?? 0;
    const changedPages = pages?.filter(pageChanged) ?? [];

    return (
      <ToolPage utility={compareUtility}>
        <PickOne label={t.original} file={a} onFile={setA} />
        <PickOne label={t.changed} file={b} onFile={setB} />
        <RunBar
          label={t.run}
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
                void closePdf(da);
                void closePdf(db);
              }
            })
          }
        />
        {text && pages && (
          <section className="compare">
            <div className="results-head">
              <b>
                {changedText === 0 && changedPages.length === 0
                  ? t.noDifferences
                  : t.summary(changedText, changedPages.length, pages.length)}
              </b>
              <span className="spacer" />
              <Segmented<'text' | 'visual'>
                value={view}
                onChange={setView}
                options={[
                  { value: 'text', label: t.textChanges },
                  { value: 'visual', label: t.visualChanges },
                ]}
              />
            </div>
            {view === 'text' &&
              text.map((lines, i) =>
                lines.some((l) => l.kind !== 'same') ? (
                  <Option key={i} label={t.page(i + 1)}>
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
                  <span className="legend red" /> {t.onlyInOriginal} <span className="legend green" /> {t.onlyInChanged}
                </p>
                <div className="redact-pages">
                  {pages.map((p) => (
                    <div key={p.page} className="redact-page">
                      <div className="muted">
                        {t.page(p.page)}
                        {p.missingIn ? t.onlyInFile(p.missingIn === 'a' ? 'changed' : 'original') : pageChanged(p) ? t.pageChanged : t.noChange}
                      </div>
                      <img className="diff-image" src={p.image} alt={t.imageAlt(p.page)} />
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
