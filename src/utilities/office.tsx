import { useState } from 'react';
import { FileType2, Printer } from 'lucide-react';
import { docxToHtml, pdfToDocx, printHtml } from '../lib/office';
import { baseName } from '../lib/pdfTools';
import { formatBytes } from '../lib/zip';
import { FileDrop, Results, RunBar, SinglePdfInput, ToolPage, useSinglePdf, useTask, type OutputFile } from './ui';
import type { Utility } from './types';
import { useT } from '../i18n';

export const pdfToWordUtility: Utility = {
  id: 'pdf-to-word',
  icon: FileType2,
  group: 'convert',
  Component: function PdfToWord() {
    const pdf = useSinglePdf();
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    const t = useT().pdfToWord;
    return (
      <ToolPage utility={pdfToWordUtility}>
        <SinglePdfInput pdf={pdf} />
        <ul className="tips">
          <li>{t.tipKept}</li>
          <li>{t.tipScans}</li>
        </ul>
        <RunBar
          label={t.run}
          disabled={!pdf.bytes || !pdf.pages}
          {...task}
          onRun={() =>
            task.run(async () => {
              const blob = await pdfToDocx(pdf.bytes!);
              setOut([{ name: `${baseName(pdf.file!.name)}.docx`, blob }]);
            })
          }
        />
        <Results files={out} zipName="word.zip" />
      </ToolPage>
    );
  },
};

export const wordToPdfUtility: Utility = {
  id: 'word-to-pdf',
  icon: Printer,
  group: 'convert',
  Component: function WordToPdf() {
    const [file, setFile] = useState<File | null>(null);
    const [html, setHtml] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const task = useTask();
    const all = useT();
    const t = all.wordToPdf;

    const load = (f: File) => {
      setFile(f);
      setHtml(null);
      void task.run(async () => {
        const r = await docxToHtml(f);
        setHtml(r.html);
        setWarnings(r.warnings);
      });
    };

    return (
      <ToolPage utility={wordToPdfUtility}>
        {file ? (
          <div className="single-file">
            <span className="file-name">{file.name}</span>
            <span className="muted">{formatBytes(file.size)}</span>
            <span className="spacer" />
            <button
              className="btn ghost"
              onClick={() => {
                // Also drop the old preview: it would stay on screen, and "Save as PDF" needs the file name.
                setFile(null);
                setHtml(null);
                setWarnings([]);
                task.setError(null);
              }}
            >
              {all.common.changeFile}
            </button>
          </div>
        ) : (
          <FileDrop accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple={false} onFiles={([f]) => load(f)} title={t.choose} hint={t.chooseHint} />
        )}
        {task.error && <p className="error-text">{task.error}</p>}
        {html !== null && (
          <>
            <div className="run-bar">
              <button className="btn primary big" onClick={() => printHtml(html, baseName(file!.name))}>
                <Printer size={18} /> {t.save}
              </button>
              <span className="hint">{t.printHint}</span>
            </div>
            {warnings.length > 0 && <p className="hint">{t.warnings(warnings.length)}</p>}
            <div className="doc-preview" dangerouslySetInnerHTML={{ __html: html }} />
          </>
        )}
      </ToolPage>
    );
  },
};
