import { useState } from 'react';
import { Copy, FileImage, FileText, Images, Minimize2 } from 'lucide-react';
import { imagesToPdf, type OrientationOption, type PageSizeOption } from '../lib/images';
import { takeLaunchedImages } from '../lib/pwa';
import { baseName, extractText, parsePageRanges, pdfBlob, pdfToImages, rasterizePdf, resavePdf } from '../lib/pdfTools';
import { downloadBlob, formatBytes } from '../lib/zip';
import { FileDrop, FileList, Option, Results, RunBar, Segmented, SinglePdfInput, ToolPage, useSinglePdf, useTask, type OutputFile } from './ui';
import type { Utility } from './types';
import { useLang, useT } from '../i18n';

type CompressLevel = 'lossless' | 'light' | 'recommended' | 'strong';

const LEVELS: Record<Exclude<CompressLevel, 'lossless'>, { dpi: number; quality: number }> = {
  light: { dpi: 150, quality: 0.8 },
  recommended: { dpi: 120, quality: 0.65 },
  strong: { dpi: 85, quality: 0.5 },
};

export const compressUtility: Utility = {
  id: 'compress',
  icon: Minimize2,
  group: 'optimize',
  Component: function Compress({ ctx }) {
    const pdf = useSinglePdf();
    const [level, setLevel] = useState<CompressLevel>('recommended');
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const before = pdf.file?.size ?? 0;
    const after = out[0]?.blob.size ?? 0;
    const all = useT();
    const t = all.compress;
    return (
      <ToolPage utility={compressUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option
          label={t.level}
          hint={level === 'lossless' ? t.losslessHint : t.rasterHint}
        >
          <Segmented<CompressLevel>
            value={level}
            onChange={setLevel}
            options={[
              { value: 'lossless', label: t.lossless },
              { value: 'light', label: t.light },
              { value: 'recommended', label: t.recommended },
              { value: 'strong', label: t.strong },
            ]}
          />
        </Option>
        <RunBar
          label={t.run}
          disabled={!pdf.bytes || !pdf.pages}
          {...task}
          onRun={() =>
            task.run(async (progress) => {
              const bytes = level === 'lossless' ? await resavePdf(pdf.bytes!) : await rasterizePdf(pdf.bytes!, LEVELS[level], progress);
              setOut([{ name: `${baseName(pdf.file!.name)}_compressed.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results
          files={out}
          zipName="compressed.zip"
          ctx={ctx}
          note={
            out.length > 0 &&
            (after < before ? (
              <>
                <b>{all.common.sizeChange(formatBytes(before), formatBytes(after))}</b> ({all.common.smaller(Math.round((1 - after / before) * 100))})
              </>
            ) : (
              <>
                {all.common.sizeChange(formatBytes(before), formatBytes(after))}. {t.notSmaller}
              </>
            ))
          }
        />
      </ToolPage>
    );
  },
};

export const imagesToPdfUtility: Utility = {
  id: 'images-to-pdf',
  icon: Images,
  group: 'convert',
  Component: function ImagesToPdf({ ctx }) {
    // Starts with the images the installed app was opened with, if any.
    const [files, setFiles] = useState<File[]>(takeLaunchedImages);
    const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
    const [orientation, setOrientation] = useState<OrientationOption>('auto');
    const [margin, setMargin] = useState(20);
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const t = useT().imagesToPdf;
    return (
      <ToolPage utility={imagesToPdfUtility}>
        <FileDrop
          accept="image/*,.heic,.heif"
          multiple
          compact={files.length > 0}
          onFiles={(f) => setFiles([...files, ...f])}
          title={t.add}
          hint="JPG, PNG, WebP, GIF, HEIC"
        />
        {files.length > 0 && <FileList files={files} onChange={setFiles} reorderable />}
        <Option label={t.pageSize}>
          <Segmented<PageSizeOption>
            value={pageSize}
            onChange={setPageSize}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: t.letter },
              { value: 'fit', label: t.fit },
            ]}
          />
        </Option>
        {pageSize !== 'fit' && (
          <Option label={t.orientation}>
            <Segmented<OrientationOption>
              value={orientation}
              onChange={setOrientation}
              options={[
                { value: 'auto', label: t.auto },
                { value: 'portrait', label: t.portrait },
                { value: 'landscape', label: t.landscape },
              ]}
            />
          </Option>
        )}
        <Option label={t.margin}>
          <Segmented<number>
            value={margin}
            onChange={setMargin}
            options={[
              { value: 0, label: t.none },
              { value: 20, label: t.small },
              { value: 50, label: t.large },
            ]}
          />
        </Option>
        <RunBar
          label={t.run}
          disabled={!files.length}
          {...task}
          onRun={() =>
            task.run(async (progress) => {
              const bytes = await imagesToPdf(files, { pageSize, orientation, margin, quality: 0.9 }, progress);
              setOut([{ name: `${baseName(files[0].name)}${files.length > 1 ? '_and_more' : ''}.pdf`, blob: pdfBlob(bytes) }]);
            })
          }
        />
        <Results files={out} zipName="images.zip" ctx={ctx} />
      </ToolPage>
    );
  },
};

export const pdfToImagesUtility: Utility = {
  id: 'pdf-to-images',
  icon: FileImage,
  group: 'convert',
  Component: function PdfToImages() {
    const pdf = useSinglePdf();
    const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
    const [dpi, setDpi] = useState(150);
    const [pages, setPages] = useState('');
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const t = useT().pdfToImages;
    return (
      <ToolPage utility={pdfToImagesUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option label={t.format}>
          <Segmented<'jpeg' | 'png'> value={format} onChange={setFormat} options={[{ value: 'jpeg', label: 'JPG' }, { value: 'png', label: 'PNG' }]} />
        </Option>
        <Option label={t.resolution}>
          <Segmented<number>
            value={dpi}
            onChange={setDpi}
            options={[
              { value: 72, label: t.screen },
              { value: 150, label: t.standard },
              { value: 300, label: t.print },
            ]}
          />
        </Option>
        <Option label={t.pages} hint={t.pagesHint}>
          <input className="text-field" value={pages} onChange={(e) => setPages(e.target.value)} placeholder={t.pagesPlaceholder} />
        </Option>
        <RunBar
          label={t.run}
          disabled={!pdf.bytes || !pdf.pages}
          {...task}
          onRun={() =>
            task.run(async (progress) => {
              const indices = pages.trim() ? parsePageRanges(pages, pdf.pages!).flat() : undefined;
              const blobs = await pdfToImages(pdf.bytes!, { format, dpi, indices }, progress);
              const name = baseName(pdf.file!.name);
              const ext = format === 'jpeg' ? 'jpg' : 'png';
              const numbers = indices ?? blobs.map((_, i) => i);
              setOut(blobs.map((blob, i) => ({ name: `${name}_page${numbers[i] + 1}.${ext}`, blob })));
            })
          }
        />
        <Results files={out} zipName={`${pdf.file ? baseName(pdf.file.name) : 'pages'}_images.zip`} />
      </ToolPage>
    );
  },
};

export const pdfToTextUtility: Utility = {
  id: 'pdf-to-text',
  icon: FileText,
  group: 'convert',
  Component: function PdfToText() {
    const pdf = useSinglePdf();
    const [text, setText] = useState<string | null>(null);
    const task = useTask();
    const all = useT();
    const t = all.pdfToText;
    const lang = useLang();
    return (
      <ToolPage utility={pdfToTextUtility}>
        <SinglePdfInput pdf={pdf} />
        <RunBar label={t.run} disabled={!pdf.bytes || !pdf.pages} {...task} onRun={() => task.run(async () => setText(await extractText(pdf.bytes!)))} />
        {text !== null && (
          <section className="results">
            <div className="results-head">
              <b>{text.trim() ? t.characters(text.length.toLocaleString(lang)) : t.noText}</b>
              <span className="spacer" />
              <button className="btn ghost" disabled={!text} onClick={() => void navigator.clipboard.writeText(text)}>
                <Copy size={16} /> {all.common.copy}
              </button>
              <button
                className="btn primary"
                disabled={!text}
                onClick={() => downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${baseName(pdf.file!.name)}.txt`)}
              >
                {t.downloadTxt}
              </button>
            </div>
            {text.trim() ? (
              <textarea className="text-output" readOnly value={text} />
            ) : (
              <p className="hint">{t.scanned}</p>
            )}
          </section>
        )}
      </ToolPage>
    );
  },
};
