import { useEffect, useState } from 'react';
import { Droplet, FilePenLine, Hash, LayoutGrid, Signature, Tags } from 'lucide-react';
import { ColorField, FontPicker, NumberField } from '../components/fields';
import { DEFAULT_FONT } from '../lib/fonts';
import {
  addPageNumbers,
  addWatermark,
  baseName,
  pdfBlob,
  readMetadata,
  writeMetadata,
  type Metadata,
  type NumberPosition,
  type PageNumberOptions,
  type WatermarkOptions,
} from '../lib/pdfTools';
import { FileDrop, Option, Results, RunBar, Segmented, SinglePdfInput, ToolPage, useSinglePdf, useTask, type OutputFile } from './ui';
import type { Utility, UtilityContext } from './types';

/** Entries that open the full editor, optionally with one of its tools picked. */
function editorLauncher(opts: Omit<Utility, 'Component'> & { tool?: string; tips: string[] }): Utility {
  const utility: Utility = {
    ...opts,
    Component: function Launcher({ ctx }: { ctx: UtilityContext }) {
      return (
        <ToolPage utility={utility}>
          <FileDrop accept="application/pdf,.pdf" multiple onFiles={(files) => ctx.openInEditor(files, opts.tool)} title="Choose PDF files to open in the editor" hint="Several files are merged into one document" />
          <ul className="tips">
            {opts.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </ToolPage>
      );
    },
  };
  return utility;
}

export const editUtility = editorLauncher({
  id: 'edit',
  label: 'Edit PDF',
  description: 'Add text, cover content with whiteout, highlight, frame and insert images.',
  icon: FilePenLine,
  group: 'edit',
  tips: [
    'Existing text cannot be retyped in place: cover it with Whiteout and type the new text on top.',
    'Arimo, Tinos and Cousine match Arial, Times and Courier, so additions blend in with most invoices.',
    'Your work is saved in this browser automatically; find it under Recent documents.',
  ],
});

export const signUtility = editorLauncher({
  id: 'sign',
  label: 'Sign PDF',
  description: 'Draw, type or upload your signature and place it on the document.',
  icon: Signature,
  group: 'edit',
  tool: 'signature',
  tips: [
    'The signature dialog opens with the document. Draw with a mouse or touchpad, type your name in a handwriting font, or upload a scan.',
    'Your last signature is remembered in this browser for next time.',
    'This is a visual signature, not a qualified electronic signature (e.g. Profil Zaufany or a certificate).',
  ],
});

export const organizeUtility = editorLauncher({
  id: 'organize',
  label: 'Organize pages',
  description: 'Reorder, rotate, duplicate or delete pages, and combine files visually.',
  icon: LayoutGrid,
  group: 'organize',
  tips: ['Drag thumbnails in the Pages panel to reorder them.', 'Use "Add PDF pages" to insert pages from other files after the selected page.'],
});

const POSITIONS: { value: NumberPosition; label: string }[] = [
  { value: 'top-left', label: '↖' },
  { value: 'top-center', label: '↑' },
  { value: 'top-right', label: '↗' },
  { value: 'bottom-left', label: '↙' },
  { value: 'bottom-center', label: '↓' },
  { value: 'bottom-right', label: '↘' },
];

const FORMATS = ['{n}', '{n} / {total}', 'Page {n} of {total}', 'Strona {n} z {total}', '- {n} -'];

export const pageNumbersUtility: Utility = {
  id: 'page-numbers',
  label: 'Page numbers',
  description: 'Number the pages, with your own position, format and font.',
  icon: Hash,
  group: 'edit',
  Component: function PageNumbers({ ctx }) {
    const pdf = useSinglePdf();
    const [o, setO] = useState<PageNumberOptions>({
      position: 'bottom-center',
      format: '{n} / {total}',
      startAt: 1,
      skipFirst: false,
      size: 10,
      margin: 24,
      color: '#333333',
      font: DEFAULT_FONT,
    });
    const set = (patch: Partial<PageNumberOptions>) => setO({ ...o, ...patch });
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    return (
      <ToolPage utility={pageNumbersUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option label="Position">
          <div className="position-grid">
            {POSITIONS.map((p) => (
              <button key={p.value} className={p.value === o.position ? 'on' : ''} title={p.value.replace('-', ' ')} onClick={() => set({ position: p.value })}>
                {p.label}
              </button>
            ))}
          </div>
        </Option>
        <Option label="Format" hint="{n} is the page number, {total} the number of pages.">
          <div className="row">
            <input className="text-field" value={o.format} onChange={(e) => set({ format: e.target.value })} />
          </div>
          <div className="chips">
            {FORMATS.map((f) => (
              <button key={f} className={`chip${f === o.format ? ' on' : ''}`} onClick={() => set({ format: f })}>
                {f.replace('{n}', '3').replace('{total}', '12')}
              </button>
            ))}
          </div>
        </Option>
        <Option label="Font">
          <div className="option-row">
            <div className="grow-2">
              <FontPicker value={o.font} onChange={(font) => set({ font })} />
            </div>
            <NumberField label="Size" value={o.size} min={4} onChange={(size) => set({ size })} />
            <NumberField label="Margin" value={o.margin} min={0} onChange={(margin) => set({ margin })} />
            <ColorField label="Colour" value={o.color} onChange={(color) => set({ color })} />
          </div>
        </Option>
        <Option label="Numbering">
          <div className="option-row">
            <NumberField label="Start at" value={o.startAt} min={0} onChange={(startAt) => set({ startAt: Math.round(startAt) })} />
            <label className="check">
              <input type="checkbox" checked={o.skipFirst} onChange={(e) => set({ skipFirst: e.target.checked })} />
              Skip the first page (cover)
            </label>
          </div>
        </Option>
        <RunBar
          label="Add page numbers"
          disabled={!pdf.bytes || !pdf.pages}
          {...task}
          onRun={() =>
            task.run(async () => {
              const bytes = await addPageNumbers(pdf.bytes!, o);
              setOut([{ name: `${baseName(pdf.file!.name)}_numbered.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results files={out} zipName="numbered.zip" ctx={ctx} />
      </ToolPage>
    );
  },
};

export const watermarkUtility: Utility = {
  id: 'watermark',
  label: 'Watermark',
  description: 'Stamp text such as COPY, DRAFT or KOPIA across every page.',
  icon: Droplet,
  group: 'edit',
  Component: function Watermark({ ctx }) {
    const pdf = useSinglePdf();
    const [o, setO] = useState<WatermarkOptions>({
      text: 'KOPIA',
      size: 72,
      color: '#d32f2f',
      opacity: 0.18,
      angle: 45,
      tiled: false,
      font: DEFAULT_FONT,
      bold: true,
    });
    const set = (patch: Partial<WatermarkOptions>) => setO({ ...o, ...patch });
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    return (
      <ToolPage utility={watermarkUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option label="Text">
          <input className="text-field" value={o.text} onChange={(e) => set({ text: e.target.value })} />
          <div className="chips">
            {['KOPIA', 'COPY', 'DRAFT', 'CONFIDENTIAL', 'ORYGINAŁ', 'PAID'].map((t) => (
              <button key={t} className={`chip${t === o.text ? ' on' : ''}`} onClick={() => set({ text: t })}>
                {t}
              </button>
            ))}
          </div>
        </Option>
        <Option label="Look">
          <div className="option-row">
            <div className="grow-2">
              <FontPicker value={o.font} onChange={(font) => set({ font })} />
            </div>
            <NumberField label="Size" value={o.size} min={6} onChange={(size) => set({ size })} />
            <ColorField label="Colour" value={o.color} onChange={(color) => set({ color })} />
            <NumberField label="Opacity %" value={o.opacity * 100} min={3} step={5} onChange={(n) => set({ opacity: Math.min(100, n) / 100 })} />
          </div>
        </Option>
        <Option label="Layout">
          <div className="option-row">
            <Segmented<number>
              value={o.angle}
              onChange={(angle) => set({ angle })}
              options={[
                { value: 45, label: 'Diagonal' },
                { value: 0, label: 'Horizontal' },
              ]}
            />
            <Segmented<'single' | 'tiled'>
              value={o.tiled ? 'tiled' : 'single'}
              onChange={(v) => set({ tiled: v === 'tiled' })}
              options={[
                { value: 'single', label: 'Once, centred' },
                { value: 'tiled', label: 'Tiled' },
              ]}
            />
          </div>
        </Option>
        <RunBar
          label="Add watermark"
          disabled={!pdf.bytes || !pdf.pages || !o.text.trim()}
          {...task}
          onRun={() =>
            task.run(async () => {
              const bytes = await addWatermark(pdf.bytes!, o);
              setOut([{ name: `${baseName(pdf.file!.name)}_watermarked.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results files={out} zipName="watermarked.zip" ctx={ctx} />
      </ToolPage>
    );
  },
};

const EMPTY_META: Metadata = { title: '', author: '', subject: '', keywords: '', creator: '', producer: '' };

export const metadataUtility: Utility = {
  id: 'metadata',
  label: 'Edit metadata',
  description: 'See and change the title, author and other hidden document properties, or wipe them.',
  icon: Tags,
  group: 'edit',
  Component: function MetadataTool() {
    const pdf = useSinglePdf();
    const [meta, setMeta] = useState<Metadata>(EMPTY_META);
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();

    useEffect(() => {
      setOut([]);
      if (pdf.bytes && pdf.pages) void readMetadata(pdf.bytes).then(setMeta, () => setMeta(EMPTY_META));
      else setMeta(EMPTY_META);
    }, [pdf.bytes, pdf.pages]);

    const fields: { key: keyof Metadata; label: string; hint?: string }[] = [
      { key: 'title', label: 'Title', hint: 'Shown in the browser tab or viewer title bar.' },
      { key: 'author', label: 'Author' },
      { key: 'subject', label: 'Subject' },
      { key: 'keywords', label: 'Keywords', hint: 'Separated by commas.' },
      { key: 'creator', label: 'Creator', hint: 'The application that made the original document.' },
      { key: 'producer', label: 'Producer', hint: 'The software that wrote the PDF file.' },
    ];

    return (
      <ToolPage utility={metadataUtility}>
        <SinglePdfInput pdf={pdf} />
        {pdf.pages !== null && (
          <>
            {fields.map((f) => (
              <Option key={f.key} label={f.label} hint={f.hint}>
                <input className="text-field" value={meta[f.key]} onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })} />
              </Option>
            ))}
            <Option label="">
              <button className="btn ghost" onClick={() => setMeta(EMPTY_META)}>
                Clear all fields
              </button>
            </Option>
          </>
        )}
        <RunBar
          label="Save metadata"
          disabled={!pdf.bytes || !pdf.pages}
          {...task}
          onRun={() =>
            task.run(async () => {
              const bytes = await writeMetadata(pdf.bytes!, meta);
              setOut([{ name: pdf.file!.name, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results files={out} zipName="metadata.zip" />
      </ToolPage>
    );
  },
};
