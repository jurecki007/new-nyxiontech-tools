import { useState } from 'react';
import { Copy, ScanText } from 'lucide-react';
import { imagesToPdf } from '../lib/images';
import { ocrPdf, type OcrLanguage } from '../lib/ocr';
import { baseName, pdfBlob } from '../lib/pdfTools';
import { FileDrop, FileList, Option, Results, RunBar, Segmented, ToolPage, useTask, type OutputFile } from './ui';
import type { Utility } from './types';
import { tr, useT } from '../i18n';

const isPdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

export const ocrUtility: Utility = {
  id: 'ocr',
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
    const t = useT().ocr;

    return (
      <ToolPage utility={ocrUtility}>
        <FileDrop
          accept="application/pdf,.pdf,image/*,.heic"
          multiple
          compact={files.length > 0}
          onFiles={(f) => setFiles([...files, ...f])}
          title={t.add}
          hint={t.addHint}
        />
        {files.length > 0 && <FileList files={files} onChange={setFiles} reorderable={images.length > 1} />}
        {pdfs.length > 1 && <p className="error-text">{t.onePdf}</p>}
        <Option label={t.language}>
          <Segmented<string>
            value={langs.join('+')}
            onChange={(v) => setLangs(v.split('+') as OcrLanguage[])}
            options={[
              { value: 'pol+eng', label: t.polishEnglish },
              { value: 'pol', label: t.polish },
              { value: 'eng', label: t.english },
            ]}
          />
        </Option>
        <Option label={t.quality} hint={t.qualityHint}>
          <Segmented<number>
            value={dpi}
            onChange={setDpi}
            options={[
              { value: 200, label: t.fast },
              { value: 300, label: t.accurate },
              { value: 400, label: t.smallPrint },
            ]}
          />
        </Option>
        <Option label="">
          <label className="check">
            <input type="checkbox" checked={skip} onChange={(e) => setSkip(e.target.checked)} />
            {t.skip}
          </label>
        </Option>
        <RunBar
          label={t.run}
          disabled={!files.length || pdfs.length > 1 || (pdfs.length === 1 && images.length > 0)}
          {...task}
          onRun={() =>
            task.run(async (progress) => {
              setOut([]);
              setText('');
              const source = pdfs[0] ? new Uint8Array(await pdfs[0].arrayBuffer()) : await imagesToPdf(images, { pageSize: 'fit', orientation: 'auto', margin: 0, quality: 0.92 });
              const result = await ocrPdf(source, { langs, dpi, skipPagesWithText: skip && !!pdfs[0] }, (p) => {
                progress(Math.max(0, p.page - 1), p.pages);
                const o = tr().ocr;
                setStatus(o.progress(p.page, p.pages, o.statuses[p.status] ?? p.status));
              });
              setStatus(result.skipped.length ? tr().ocr.skipped(result.skipped.length, result.skipped.join(', ')) : '');
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
                {t.done} {status}
                {text && (
                  <button className="btn ghost inline" onClick={() => void navigator.clipboard.writeText(text)}>
                    <Copy size={14} /> {t.copyText}
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
