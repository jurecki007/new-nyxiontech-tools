import { useState } from 'react';
import { Combine, RotateCw, Scissors } from 'lucide-react';
import { baseName, mergePdfs, parsePageRanges, pdfBlob, rotatePdf, splitPdf } from '../lib/pdfTools';
import { FileDrop, FileList, Option, Results, RunBar, Segmented, SinglePdfInput, ToolPage, useSinglePdf, useTask, type OutputFile } from './ui';
import type { Utility } from './types';

export const mergeUtility: Utility = {
  id: 'merge',
  label: 'Merge PDF',
  description: 'Combine several PDFs into one file, in the order you choose.',
  icon: Combine,
  group: 'organize',
  Component: function Merge({ ctx }) {
    const [files, setFiles] = useState<File[]>([]);
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    return (
      <ToolPage utility={mergeUtility}>
        <FileDrop accept="application/pdf,.pdf" multiple compact={files.length > 0} onFiles={(f) => setFiles([...files, ...f])} title="Add PDF files" hint="Drop several files, then put them in order" />
        {files.length > 0 && <FileList files={files} onChange={setFiles} reorderable />}
        <RunBar
          label={`Merge ${files.length || ''} files`}
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
  label: 'Split PDF',
  description: 'Split a PDF into single pages or ranges, or extract selected pages into a new file.',
  icon: Scissors,
  group: 'organize',
  Component: function Split({ ctx }) {
    const pdf = useSinglePdf();
    const [mode, setMode] = useState<SplitMode>('ranges');
    const [ranges, setRanges] = useState('1-2, 3-');
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    return (
      <ToolPage utility={splitUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option label="Mode">
          <Segmented<SplitMode>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'each', label: 'Every page' },
              { value: 'ranges', label: 'By ranges' },
              { value: 'extract', label: 'Extract pages' },
            ]}
          />
        </Option>
        {mode !== 'each' && (
          <Option
            label={mode === 'ranges' ? 'Ranges' : 'Pages'}
            hint={mode === 'ranges' ? 'Each range becomes a file, e.g. "1-3, 4-6, 7-".' : 'These pages go into one new file, e.g. "1, 3-5, 9".'}
          >
            <input className="text-field" value={ranges} onChange={(e) => setRanges(e.target.value)} />
          </Option>
        )}
        <RunBar
          label="Split PDF"
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
  label: 'Rotate PDF',
  description: 'Rotate all pages, or only some, by 90°, 180° or 270°.',
  icon: RotateCw,
  group: 'organize',
  Component: function Rotate({ ctx }) {
    const pdf = useSinglePdf();
    const [angle, setAngle] = useState<90 | 180 | 270>(90);
    const [which, setWhich] = useState<'all' | 'some'>('all');
    const [pages, setPages] = useState('1');
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    return (
      <ToolPage utility={rotateUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option label="Rotation">
          <Segmented<90 | 180 | 270>
            value={angle}
            onChange={setAngle}
            options={[
              { value: 90, label: '90° right' },
              { value: 180, label: '180°' },
              { value: 270, label: '90° left' },
            ]}
          />
        </Option>
        <Option label="Pages">
          <Segmented<'all' | 'some'> value={which} onChange={setWhich} options={[{ value: 'all', label: 'All pages' }, { value: 'some', label: 'Selected' }]} />
          {which === 'some' && <input className="text-field" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="e.g. 1, 3-4" />}
        </Option>
        <RunBar
          label="Rotate"
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
