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
import { storedIn, useT, type Messages } from '../i18n';

/** Entries that open the full editor, optionally with one of its tools picked. */
function editorLauncher(
  opts: Omit<Utility, 'Component'> & { tool?: string; tips: (t: Messages['launcher'], storedIn: string) => string[] },
): Utility {
  const { tool, tips, ...rest } = opts;
  const utility: Utility = {
    ...rest,
    Component: function Launcher({ ctx }: { ctx: UtilityContext }) {
      const t = useT();
      return (
        <ToolPage utility={utility}>
          <FileDrop accept="application/pdf,.pdf" multiple onFiles={(files) => ctx.openInEditor(files, tool)} title={t.launcher.choose} hint={t.launcher.chooseHint} />
          <ul className="tips">
            {tips(t.launcher, storedIn(t)).map((tip) => (
              <li key={tip}>{tip}</li>
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
  icon: FilePenLine,
  group: 'edit',
  tips: (t, storedIn) => t.editTips(storedIn),
});

export const signUtility = editorLauncher({
  id: 'sign',
  icon: Signature,
  group: 'edit',
  tool: 'signature',
  tips: (t, storedIn) => t.signTips(storedIn),
});

export const organizeUtility = editorLauncher({
  id: 'organize',
  icon: LayoutGrid,
  group: 'organize',
  tips: (t, storedIn) => t.organizeTips(storedIn),
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
    const t = useT().pageNumbers;
    return (
      <ToolPage utility={pageNumbersUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option label={t.position}>
          <div className="position-grid">
            {POSITIONS.map((p) => (
              <button key={p.value} className={p.value === o.position ? 'on' : ''} title={t.positions[p.value]} onClick={() => set({ position: p.value })}>
                {p.label}
              </button>
            ))}
          </div>
        </Option>
        <Option label={t.format} hint={t.formatHint}>
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
        <Option label={t.font}>
          <div className="option-row">
            <div className="grow-2">
              <FontPicker value={o.font} onChange={(font) => set({ font })} />
            </div>
            <NumberField label={t.size} value={o.size} min={4} onChange={(size) => set({ size })} />
            <NumberField label={t.margin} value={o.margin} min={0} onChange={(margin) => set({ margin })} />
            <ColorField label={t.colour} value={o.color} onChange={(color) => set({ color })} />
          </div>
        </Option>
        <Option label={t.numbering}>
          <div className="option-row">
            <NumberField label={t.startAt} value={o.startAt} min={0} onChange={(startAt) => set({ startAt: Math.round(startAt) })} />
            <label className="check">
              <input type="checkbox" checked={o.skipFirst} onChange={(e) => set({ skipFirst: e.target.checked })} />
              {t.skipFirst}
            </label>
          </div>
        </Option>
        <RunBar
          label={t.run}
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
    const t = useT().watermark;
    return (
      <ToolPage utility={watermarkUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option label={t.text}>
          <input className="text-field" value={o.text} onChange={(e) => set({ text: e.target.value })} />
          <div className="chips">
            {['KOPIA', 'COPY', 'DRAFT', 'CONFIDENTIAL', 'ORYGINAŁ', 'PAID'].map((t) => (
              <button key={t} className={`chip${t === o.text ? ' on' : ''}`} onClick={() => set({ text: t })}>
                {t}
              </button>
            ))}
          </div>
        </Option>
        <Option label={t.look}>
          <div className="option-row">
            <div className="grow-2">
              <FontPicker value={o.font} onChange={(font) => set({ font })} />
            </div>
            <NumberField label={t.size} value={o.size} min={6} onChange={(size) => set({ size })} />
            <ColorField label={t.colour} value={o.color} onChange={(color) => set({ color })} />
            <NumberField label={t.opacity} value={o.opacity * 100} min={3} step={5} onChange={(n) => set({ opacity: Math.min(100, n) / 100 })} />
          </div>
        </Option>
        <Option label={t.layout}>
          <div className="option-row">
            <Segmented<number>
              value={o.angle}
              onChange={(angle) => set({ angle })}
              options={[
                { value: 45, label: t.diagonal },
                { value: 0, label: t.horizontal },
              ]}
            />
            <Segmented<'single' | 'tiled'>
              value={o.tiled ? 'tiled' : 'single'}
              onChange={(v) => set({ tiled: v === 'tiled' })}
              options={[
                { value: 'single', label: t.once },
                { value: 'tiled', label: t.tiled },
              ]}
            />
          </div>
        </Option>
        <RunBar
          label={t.run}
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
  icon: Tags,
  group: 'edit',
  Component: function MetadataTool() {
    const pdf = useSinglePdf();
    const [meta, setMeta] = useState<Metadata>(EMPTY_META);
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const t = useT().metadata;

    useEffect(() => {
      setOut([]);
      if (pdf.bytes && pdf.pages) void readMetadata(pdf.bytes).then(setMeta, () => setMeta(EMPTY_META));
      else setMeta(EMPTY_META);
    }, [pdf.bytes, pdf.pages]);

    const fields: { key: keyof Metadata; hint?: string }[] = [
      { key: 'title', hint: t.titleHint },
      { key: 'author' },
      { key: 'subject' },
      { key: 'keywords', hint: t.keywordsHint },
      { key: 'creator', hint: t.creatorHint },
      { key: 'producer', hint: t.producerHint },
    ];

    return (
      <ToolPage utility={metadataUtility}>
        <SinglePdfInput pdf={pdf} />
        {pdf.pages !== null && (
          <>
            {fields.map((f) => (
              <Option key={f.key} label={t.fields[f.key]} hint={f.hint}>
                <input className="text-field" value={meta[f.key]} onChange={(e) => setMeta({ ...meta, [f.key]: e.target.value })} />
              </Option>
            ))}
            <Option label="">
              <button className="btn ghost" onClick={() => setMeta(EMPTY_META)}>
                {t.clear}
              </button>
            </Option>
          </>
        )}
        <RunBar
          label={t.run}
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
