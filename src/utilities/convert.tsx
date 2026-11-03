import { useState } from 'react';
import { Copy, FileImage, FileText, Images, Minimize2 } from 'lucide-react';
import { imagesToPdf, type OrientationOption, type PageSizeOption } from '../lib/images';
import { baseName, extractText, parsePageRanges, pdfBlob, pdfToImages, rasterizePdf, resavePdf } from '../lib/pdfTools';
import { downloadBlob, formatBytes } from '../lib/zip';
import { FileDrop, FileList, Option, Results, RunBar, Segmented, SinglePdfInput, ToolPage, useSinglePdf, useTask, type OutputFile } from './ui';
import type { Utility } from './types';

type CompressLevel = 'lossless' | 'light' | 'recommended' | 'strong';

const LEVELS: Record<Exclude<CompressLevel, 'lossless'>, { dpi: number; quality: number }> = {
  light: { dpi: 150, quality: 0.8 },
  recommended: { dpi: 120, quality: 0.65 },
  strong: { dpi: 85, quality: 0.5 },
};

export const compressUtility: Utility = {
  id: 'compress',
  label: 'Compress PDF',
  description: 'Make a PDF smaller for e-mail or upload limits.',
  icon: Minimize2,
  group: 'optimize',
  Component: function Compress({ ctx }) {
    const pdf = useSinglePdf();
    const [level, setLevel] = useState<CompressLevel>('recommended');
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const before = pdf.file?.size ?? 0;
    const after = out[0]?.blob.size ?? 0;
    return (
      <ToolPage utility={compressUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option
          label="Level"
          hint={
            level === 'lossless'
              ? 'Keeps text and quality; repacks the file. Savings are usually small.'
              : 'Pages are turned into images: big savings, but text can no longer be selected or searched. Best for scans.'
          }
        >
          <Segmented<CompressLevel>
            value={level}
            onChange={setLevel}
            options={[
              { value: 'lossless', label: 'Lossless' },
              { value: 'light', label: 'Light' },
              { value: 'recommended', label: 'Recommended' },
              { value: 'strong', label: 'Strong' },
            ]}
          />
        </Option>
        <RunBar
          label="Compress"
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
                {formatBytes(before)} → <b>{formatBytes(after)}</b> ({Math.round((1 - after / before) * 100)}% smaller)
              </>
            ) : (
              <>
                {formatBytes(before)} → {formatBytes(after)}. This file is already compact; try a stronger level, or keep the original.
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
  label: 'Images to PDF',
  description: 'Turn JPG, PNG, WebP or iPhone HEIC photos into one PDF, one image per page.',
  icon: Images,
  group: 'convert',
  Component: function ImagesToPdf({ ctx }) {
    const [files, setFiles] = useState<File[]>([]);
    const [pageSize, setPageSize] = useState<PageSizeOption>('a4');
    const [orientation, setOrientation] = useState<OrientationOption>('auto');
    const [margin, setMargin] = useState(20);
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    return (
      <ToolPage utility={imagesToPdfUtility}>
        <FileDrop
          accept="image/*,.heic,.heif"
          multiple
          compact={files.length > 0}
          onFiles={(f) => setFiles([...files, ...f])}
          title="Add images"
          hint="JPG, PNG, WebP, GIF, HEIC"
        />
        {files.length > 0 && <FileList files={files} onChange={setFiles} reorderable />}
        <Option label="Page size">
          <Segmented<PageSizeOption>
            value={pageSize}
            onChange={setPageSize}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'letter', label: 'Letter' },
              { value: 'fit', label: 'Same as image' },
            ]}
          />
        </Option>
        {pageSize !== 'fit' && (
          <Option label="Orientation">
            <Segmented<OrientationOption>
              value={orientation}
              onChange={setOrientation}
              options={[
                { value: 'auto', label: 'Auto' },
                { value: 'portrait', label: 'Portrait' },
                { value: 'landscape', label: 'Landscape' },
              ]}
            />
          </Option>
        )}
        <Option label="Margin">
          <Segmented<number>
            value={margin}
            onChange={setMargin}
            options={[
              { value: 0, label: 'None' },
              { value: 20, label: 'Small' },
              { value: 50, label: 'Large' },
            ]}
          />
        </Option>
        <RunBar
          label="Create PDF"
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
  label: 'PDF to images',
  description: 'Save every page, or selected pages, as JPG or PNG images.',
  icon: FileImage,
  group: 'convert',
  Component: function PdfToImages() {
    const pdf = useSinglePdf();
    const [format, setFormat] = useState<'jpeg' | 'png'>('jpeg');
    const [dpi, setDpi] = useState(150);
    const [pages, setPages] = useState('');
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    return (
      <ToolPage utility={pdfToImagesUtility}>
        <SinglePdfInput pdf={pdf} />
        <Option label="Format">
          <Segmented<'jpeg' | 'png'> value={format} onChange={setFormat} options={[{ value: 'jpeg', label: 'JPG' }, { value: 'png', label: 'PNG' }]} />
        </Option>
        <Option label="Resolution">
          <Segmented<number>
            value={dpi}
            onChange={setDpi}
            options={[
              { value: 72, label: 'Screen (72 dpi)' },
              { value: 150, label: 'Standard (150 dpi)' },
              { value: 300, label: 'Print (300 dpi)' },
            ]}
          />
        </Option>
        <Option label="Pages" hint="Leave empty for all pages.">
          <input className="text-field" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="e.g. 1, 3-5" />
        </Option>
        <RunBar
          label="Convert"
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
  label: 'PDF to text',
  description: 'Pull the text out of a PDF to copy it or save it as a .txt file.',
  icon: FileText,
  group: 'convert',
  Component: function PdfToText() {
    const pdf = useSinglePdf();
    const [text, setText] = useState<string | null>(null);
    const task = useTask();
    return (
      <ToolPage utility={pdfToTextUtility}>
        <SinglePdfInput pdf={pdf} />
        <RunBar label="Extract text" disabled={!pdf.bytes || !pdf.pages} {...task} onRun={() => task.run(async () => setText(await extractText(pdf.bytes!)))} />
        {text !== null && (
          <section className="results">
            <div className="results-head">
              <b>{text.trim() ? `${text.length.toLocaleString()} characters` : 'No text found'}</b>
              <span className="spacer" />
              <button className="btn ghost" disabled={!text} onClick={() => void navigator.clipboard.writeText(text)}>
                <Copy size={16} /> Copy
              </button>
              <button
                className="btn primary"
                disabled={!text}
                onClick={() => downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${baseName(pdf.file!.name)}.txt`)}
              >
                Download .txt
              </button>
            </div>
            {text.trim() ? (
              <textarea className="text-output" readOnly value={text} />
            ) : (
              <p className="hint">This PDF has no text layer; it is probably a scan. Text recognition (OCR) is on the roadmap.</p>
            )}
          </section>
        )}
      </ToolPage>
    );
  },
};
