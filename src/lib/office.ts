// Basic Word conversions. Exact layout cannot be reproduced in a browser; these
// keep the text and its structure, which covers editing and re-using content.
import { closePdf, openPdf } from './pdfjs';

/**
 * PDF → .docx: one paragraph per text line, page breaks between pages, and
 * bold/size kept where pdf.js reports them. Tables and images are not carried over.
 */
export async function pdfToDocx(bytes: Uint8Array): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, PageBreak } = await import('docx');
  // fontExtraProperties gives each loaded font its real name (e.g. "Helvetica-Bold");
  // text content alone only has ids like "g_d0_f1" and generic families.
  const src = await openPdf(bytes, undefined, { fontExtraProperties: true });
  try {
    const paragraphs: InstanceType<typeof Paragraph>[] = [];
    for (let n = 1; n <= src.numPages; n++) {
      const page = await src.getPage(n);
      // Loads the page's fonts into commonObjs, where their names can be looked up.
      await page.getOperatorList();
      const content = await page.getTextContent();
      const fontName = (id: string): string => {
        try {
          return (page.commonObjs.get(id) as { name?: string } | null)?.name ?? '';
        } catch {
          return '';
        }
      };
      let runs: InstanceType<typeof TextRun>[] = [];
      let lastY: number | null = null;
      let lineEnded = false;
      const flush = (gap: boolean) => {
        if (runs.length) paragraphs.push(new Paragraph({ children: runs, spacing: { after: gap ? 160 : 0 } }));
        runs = [];
      };
      for (const item of content.items) {
        if (!('str' in item)) continue;
        if (item.str) {
          const y = item.transform[5];
          const size = Math.hypot(item.transform[2], item.transform[3]);
          // One paragraph per line; a big vertical jump means a new paragraph rather
          // than a wrapped line, so the previous one gets space after it. The jump is
          // only known at the next line, hence the line is flushed here, not at its end.
          const gap = lastY !== null && Math.abs(lastY - y) > size * 1.8;
          if (lineEnded || gap) flush(gap);
          lineEnded = false;
          const font = content.styles[item.fontName]?.fontFamily ?? '';
          runs.push(
            new TextRun({ text: item.str, size: Math.round(Math.min(72, Math.max(6, size)) * 2), bold: /bold/i.test(fontName(item.fontName) + item.fontName + font) }),
          );
          lastY = y;
        }
        if (item.hasEOL) lineEnded = true;
      }
      flush(true);
      if (n < src.numPages) paragraphs.push(new Paragraph({ children: [new PageBreak()] }));
      page.cleanup();
    }
    const doc = new Document({ sections: [{ children: paragraphs }] });
    return await Packer.toBlob(doc);
  } finally {
    void closePdf(src);
  }
}

/** .docx → HTML (headings, lists, tables, bold/italic, images). */
export async function docxToHtml(file: File): Promise<{ html: string; warnings: string[] }> {
  const mammoth = await import('mammoth');
  const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
  return { html: sanitizeDocHtml(result.value), warnings: result.messages.map((m) => m.message) };
}

// mammoth escapes text but copies link targets from the file as they are, so a
// .docx can carry a javascript: link. Keep only the markup mammoth produces for
// ordinary documents, and only plain web, e-mail and in-document links.
const ALLOWED_TAGS = new Set([
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'SUP', 'SUB', 'BR',
  'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TD', 'TH', 'A', 'IMG', 'BLOCKQUOTE', 'PRE', 'CODE', 'SPAN', 'DIV',
]);
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'NOSCRIPT']);
const ID_PREFIX = 'doc-';

export function sanitizeDocHtml(html: string): string {
  const root = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html').body;
  const clean = (el: Element) => {
    for (const child of [...el.children]) {
      if (DROP_WITH_CONTENT.has(child.tagName)) {
        child.remove();
        continue;
      }
      clean(child);
      if (!ALLOWED_TAGS.has(child.tagName)) {
        child.replaceWith(...child.childNodes);
        continue;
      }
      const keep: Record<string, string> = {};
      const href = child.getAttribute('href')?.trim();
      const id = child.getAttribute('id');
      if (child.tagName === 'A') {
        if (href && /^(https?:|mailto:)/i.test(href)) keep.href = href;
        else if (href?.startsWith('#')) keep.href = '#' + ID_PREFIX + href.slice(1);
        if (id) keep.id = ID_PREFIX + id;
      }
      if (child.tagName === 'IMG') {
        const src = child.getAttribute('src') ?? '';
        if (/^data:image\/[\w.+-]+;base64,/i.test(src)) keep.src = src;
        keep.alt = child.getAttribute('alt') ?? '';
      }
      if (child.tagName === 'TD' || child.tagName === 'TH') {
        for (const name of ['colspan', 'rowspan']) {
          const v = child.getAttribute(name);
          if (v && /^\d{1,3}$/.test(v)) keep[name] = v;
        }
      }
      for (const name of child.getAttributeNames()) child.removeAttribute(name);
      for (const [name, value] of Object.entries(keep)) child.setAttribute(name, value);
      if (keep.href && !keep.href.startsWith('#')) child.setAttribute('rel', 'noopener noreferrer');
    }
  };
  clean(root);
  return root.innerHTML;
}

/** Opens the browser's print dialog for the HTML, where "Save as PDF" writes a real, text-based PDF. */
export function printHtml(html: string, title: string) {
  const frame = document.createElement('iframe');
  // No allow-scripts: nothing from the document can run inside the frame.
  frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title><style>
    @page { size: A4; margin: 20mm; }
    body { font-family: Arial, 'Liberation Sans', sans-serif; font-size: 11pt; line-height: 1.4; color: #000; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
    td, th { border: 1px solid #999; padding: 4px 6px; vertical-align: top; }
    h1, h2, h3 { page-break-after: avoid; }
  </style></head><body>${html}</body></html>`);
  doc.close();
  const win = frame.contentWindow!;
  const done = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener('afterprint', done);
  // Fallback in case afterprint never reaches the sandboxed frame.
  setTimeout(() => frame.remove(), 300_000);
  // Give images a moment to load before printing.
  setTimeout(() => win.print(), 300);
}
