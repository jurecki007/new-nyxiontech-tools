import { useState } from 'react';
import { Combine, RotateCw, Scissors } from 'lucide-react';
import { baseName, mergePdfs, parsePageRanges, pdfBlob, rotatePdf, splitPdf } from '../lib/pdfTools';
import { FileDrop, FileList, Option, Results, RunBar, Segmented, SinglePdfInput, ToolPage, useSinglePdf, useTask, type OutputFile } from './ui';
import type { Utility } from './types';
import { useT } from '../i18n';

export const mergeUtility: Utility = {
  id: 'merge',
  icon: Combine,
  group: 'organize',
  Component: function Merge({ ctx }) {
    const [files, setFiles] = useState<File[]>([]);
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const t = useT().merge;
    return (
      <ToolPage utility={mergeUtility}>
        <FileDrop accept="application/pdf,.pdf" multiple compact={files.length > 0} onFiles={(f) => setFiles([...files, ...f])} title={t.addFiles} hint={t.addFilesHint} />
        {files.length > 0 && <FileList files={files} onChange={setFiles} reorderable />}
        <RunBar
          label={t.run(files.length)}
          disabled={files.length < 2}
          {...task}
          onRun={() =>
            task.run(async () => {
              const bytes = await mergePdfs(await Promise.all(files.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))));
              setOut([{ name: `${baseName(files[0].name)}_merged.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results files={out} zipName="merged.zip" ctx={ctx} />
      </ToolPage>
    );
  },
};

type SplitMode = 'each' | 'ranges' | 'extract';

export const splitUtility: Utility = {
  id: 'split',
  icon: Scissors,
  group: 'organize',
  Component: function Split({ ctx }) {
    const pdf = useSinglePdf();
    const [mode, setMode] = useState<SplitMode>('ranges');
    const [ranges, setRanges] = useState('1-2, 3-');
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const t = useT().split;
    return (
      <ToolPage utility={splitUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option label={t.mode}>
          <Segmented<SplitMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'each', label: t.every },
              { value: 'ranges', label: t.ranges },
              { value: 'extract', label: t.extract },
            ]}
          />
        </Option>
        {mode !== 'each' && (
          <Option
            label={mode === 'ranges' ? t.rangesLabel : t.pagesLabel}
            hint={mode === 'ranges' ? t.rangesHint : t.extractHint}
          >
            <input className="text-field" value={ranges} onChange={(e) => setRanges(e.target.value)} />
          </Option>
        )}
        <RunBar
          label={t.run}
          disabled={!pdf.bytes || !pdf.pages}
          {...task}
          onRun={() =>
            task.run(async () => {
              const n = pdf.pages!;
              const name = baseName(pdf.file!.name);
              let groups: number[][];
              if (mode === 'each') groups = Array.from({ length: n }, (_, i) => [i]);
              else if (mode === 'ranges') groups = parsePageRanges(ranges, n);
              else groups = [parsePageRanges(ranges, n).flat()];
              const docs = await splitPdf(pdf.bytes!, groups);
              setOut(
                docs.map((bytes, i) => {
                  const g = groups[i];
                  const label = mode === 'extract' ? 'extract' : g.length === 1 ? `p${g[0] + 1}` : `p${g[0] + 1}-${g[g.length - 1] + 1}`;
                  return { name: `${name}_${label}.pdf`, blob: pdfBlob(bytes) };
                }),
              );
            })
          }
        />
        <Results files={out} zipName={`${pdf.file ? baseName(pdf.file.name) : 'split'}_split.zip`} ctx={ctx} />
      </ToolPage>
    );
  },
};

export const rotateUtility: Utility = {
  id: 'rotate',
  icon: RotateCw,
  group: 'organize',
  Component: function Rotate({ ctx }) {
    const pdf = useSinglePdf();
    const [angle, setAngle] = useState<90 | 180 | 270>(90);
    const [which, setWhich] = useState<'all' | 'some'>('all');
    const [pages, setPages] = useState('1');
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const all = useT();
    const t = all.rotate;
    return (
      <ToolPage utility={rotateUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option label={t.rotation}>
          <Segmented<90 | 180 | 270>
            value={angle}
            onChange={setAngle}
            options={[
              { value: 90, label: t.right },
              { value: 180, label: t.half },
              { value: 270, label: t.left },
            ]}
          />
        </Option>
        <Option label={t.pages}>
          <Segmented<'all' | 'some'> value={which} onChange={setWhich} options={[{ value: 'all', label: t.all }, { value: 'some', label: t.selected }]} />
          {which === 'some' && <input className="text-field" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={all.common.pagesExample} />}
        </Option>
        <RunBar
          label={t.run}
          disabled={!pdf.bytes || !pdf.pages}
          {...task}
          onRun={() =>
            task.run(async () => {
              const only = which === 'some' ? new Set(parsePageRanges(pages, pdf.pages!).flat()) : undefined;
              const bytes = await rotatePdf(pdf.bytes!, angle, only);
              setOut([{ name: `${baseName(pdf.file!.name)}_rotated.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results files={out} zipName="rotated.zip" ctx={ctx} />
      </ToolPage>
    );
  },
};
