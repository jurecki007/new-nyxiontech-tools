import { useState } from 'react';
import { FileType2, Printer } from 'lucide-react';
import { docxToHtml, pdfToDocx, printHtml } from '../lib/office';
import { baseName } from '../lib/pdfTools';
import { formatBytes } from '../lib/zip';
import { FileDrop, Results, RunBar, SinglePdfInput, ToolPage, useSinglePdf, useTask, type OutputFile } from './ui';
import type { Utility } from './types';

export const pdfToWordUtility: Utility = {
  id: 'pdf-to-word',
  label: 'PDF to Word',
  description: 'Turn a PDF into an editable .docx with its text and paragraphs (basic layout).',
  icon: FileType2,
  group: 'convert',
  Component: function PdfToWord() {
    const pdf = useSinglePdf();
    const [out, setOut] = useState<OutputFile[]>([]);
    const task = useTask();
    return (
      <ToolPage utility={pdfToWordUtility}>
        <SinglePdfInput pdf={pdf} />
        <ul className="tips">
          <li>Text, paragraphs, bold and font sizes are kept; tables, columns and images are not.</li>
          <li>Scanned PDFs have no text: run them through OCR first.</li>
        </ul>
        <RunBar
          label="Convert to Word"
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
  label: 'Word to PDF',
  description: 'Open a .docx and save it as a PDF through the print dialog (basic layout).',
  icon: Printer,
  group: 'convert',
  Component: function WordToPdf() {
    const [file, setFile] = useState<File | null>(null);
    const [html, setHtml] = useState<string | null>(null);
    const [warnings, setWarnings] = useState<string[]>([]);
    const task = useTask();

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
            <button className="btn ghost" onClick={() => setFile(null)}>
              Change file
            </button>
          </div>
        ) : (
          <FileDrop accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple={false} onFiles={([f]) => load(f)} title="Choose a Word document (.docx)" hint="Older .doc files: save them as .docx in Word first" />
        )}
        {task.error && <p className="error-text">{task.error}</p>}
        {html !== null && (
          <>
            <div className="run-bar">
              <button className="btn primary big" onClick={() => printHtml(html, baseName(file!.name))}>
                <Printer size={18} /> Save as PDF…
              </button>
              <span className="hint">In the print dialog, choose “Save as PDF” (or “Microsoft Print to PDF”) as the printer.</span>
            </div>
            {warnings.length > 0 && <p className="hint">Some formatting could not be converted ({warnings.length} notes), for example custom styles.</p>}
            <div className="doc-preview" dangerouslySetInnerHTML={{ __html: html }} />
          </>
        )}
      </ToolPage>
    );
  },
};
