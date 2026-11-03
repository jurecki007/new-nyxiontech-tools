import { useState } from 'react';
import { Copy, ScanText } from 'lucide-react';
import { imagesToPdf } from '../lib/images';
import { ocrPdf, type OcrLanguage } from '../lib/ocr';
import { baseName, pdfBlob } from '../lib/pdfTools';
import { FileDrop, FileList, Option, Results, RunBar, Segmented, ToolPage, useTask, type OutputFile } from './ui';
import type { Utility } from './types';

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

export const ocrUtility: Utility = {
  id: 'ocr',
  label: 'OCR: searchable PDF',
  description: 'Recognise text in scans and photos so it can be searched, selected and copied. Polish and English.',
  icon: ScanText,
  group: 'convert',
  Component: function Ocr({ ctx }) {
    const [files, setFiles] = useState<File[]>([]);
    const [langs, setLangs] = useState<OcrLanguage[]>(['pol', 'eng']);
    const [dpi, setDpi] = useState(300);
    const [skip, setSkip] = useState(true);
    const [status, setStatus] = useState('');
    const [out, setOut] = useState<OutputFile[]>([]);
    const [text, setText] = useState('');
    const task = useTask();
    const pdfs = files.filter(isPdf);
    const images = files.filter((f) => !isPdf(f));

    return (
      <ToolPage utility={ocrUtility}>
        <FileDrop
          accept="application/pdf,.pdf,image/*,.heic"
          multiple
          compact={files.length > 0}
          onFiles={(f) => setFiles([...files, ...f])}
          title="Add a scanned PDF or photos of documents"
          hint="Several images become one PDF, in this order"
        />
        {files.length > 0 && <FileList files={files} onChange={setFiles} reorderable={images.length > 1} />}
        {pdfs.length > 1 && <p className="error-text">Add one PDF at a time (or only images).</p>}
        <Option label="Language">
          <Segmented<string>
            value={langs.join('+')}
            onChange={(v) => setLangs(v.split('+') as OcrLanguage[])}
            options={[
              { value: 'pol+eng', label: 'Polish + English' },
              { value: 'pol', label: 'Polish' },
              { value: 'eng', label: 'English' },
            ]}
          />
        </Option>
        <Option label="Quality" hint="Higher resolution reads small print better but takes longer.">
          <Segmented<number>
            value={dpi}
            onChange={setDpi}
            options={[
              { value: 200, label: 'Fast' },
              { value: 300, label: 'Accurate' },
              { value: 400, label: 'Small print' },
            ]}
          />
        </Option>
        <Option label="">
          <label className="check">
            <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
            Skip pages that already contain text
          </label>
        </Option>
        <RunBar
          label="Recognise text"
          disabled={!files.length || pdfs.length > 1 || (pdfs.length === 1 && images.length > 0)}
          {...task}
          onRun={() =>
            task.run(async (progress) => {
              setOut([]);
              setText('');
              const source = pdfs[0] ? new Uint8Array(await pdfs[0].arrayBuffer()) : await imagesToPdf(images, { pageSize: 'fit', orientation: 'auto', margin: 0, quality: 0.92 });
              const result = await ocrPdf(source, { langs, dpi, skipPagesWithText: skip && !!pdfs[0] }, (p) => {
                progress(Math.max(0, p.page - 1), p.pages);
                setStatus(`Page ${p.page} of ${p.pages}: ${p.status}`);
              });
              setStatus(result.skipped.length ? `Skipped ${result.skipped.length} page(s) that already had text: ${result.skipped.join(', ')}.` : '');
              setText(result.text);
              setOut([{ name: `${baseName(files[0].name)}_ocr.pdf`, blob: pdfBlob(result.pdf) }]);
            })
          }
        />
        {task.busy && status && <p className="hint">{status}</p>}
        <Results
          files={out}
          zipName="ocr.zip"
          ctx={ctx}
          note={
            out.length > 0 && (
              <>
                The PDF looks the same, but its text can now be searched (Ctrl+F) and copied. {status}
                {text && (
                  <button className="btn ghost inline" onClick={() => void navigator.clipboard.writeText(text)}>
                    <Copy size={14} /> Copy recognised text
                  </button>
                )}
              </>
            )
          }
        />
        {text && <textarea className="text-output" readOnly value={text} />}
      </ToolPage>
    );
  },
};
