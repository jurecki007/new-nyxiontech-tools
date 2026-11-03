// Generates synthetic test documents (no real customer data) into tests/.fixtures.
import fs from 'node:fs';
import path from 'node:path';
import { PDFDocument, PDFName, PDFNull, PDFString, StandardFonts } from 'pdf-lib';
import { Document, ExternalHyperlink, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun } from 'docx';
import { FIXTURES } from './e2e/helpers';

async function invoice(total: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Test invoice');
  doc.setProducer('nyxiontech-pdf-tools tests');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  const lines = [
    'Invoice 3/10/2026',
    'Seller: Example Sp. z o.o.',
    'Buyer: Example Corporation',
    'Contact: billing@example.com',
    'IBAN: PL88 1050 1823 1000 0090 8181 8081',
    'NIP: 5423338795',
    `Total due: ${total} EUR`,
  ];
  lines.forEach((t, i) => p1.drawText(t, { x: 50, y: 780 - i * 24, size: 12, font }));
  doc.addPage([595, 842]).drawText('Second page content', { x: 50, y: 780, size: 12, font });
  return doc.save();
}

async function form(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const f = doc.getForm();
  const label = (t: string, y: number) => page.drawText(t, { x: 50, y: y + 6, size: 11, font });
  label('Name', 760);
  f.createTextField('name').addToPage(page, { x: 180, y: 755, width: 300, height: 22 });
  label('Address', 720);
  const address = f.createTextField('address');
  address.enableMultiline();
  address.addToPage(page, { x: 180, y: 680, width: 300, height: 50 });
  label('Consent', 640);
  f.createCheckBox('consent').addToPage(page, { x: 180, y: 640, width: 16, height: 16 });
  label('Country', 600);
  const country = f.createDropdown('country');
  country.addOptions(['Polska', 'Germany', 'USA']);
  country.addToPage(page, { x: 180, y: 595, width: 150, height: 22 });
  return doc.save();
}

async function docx(): Promise<Buffer> {
  const d = new Document({
    sections: [
      {
        children: [
          new Paragraph({ text: 'Oferta handlowa', heading: HeadingLevel.HEADING_1 }),
          new Paragraph({ children: [new TextRun({ text: 'Zażółć gęślą jaźń. ', bold: true }), new TextRun('Czujniki YO Pulse.')] }),
          new Table({
            rows: [
              new TableRow({ children: [new TableCell({ children: [new Paragraph('Produkt')] }), new TableCell({ children: [new Paragraph('Cena')] })] }),
              new TableRow({ children: [new TableCell({ children: [new Paragraph('YO Pulse')] }), new TableCell({ children: [new Paragraph('145,00 EUR')] })] }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBuffer(d);
}

/** Page 1 links to page 2, which holds the text to redact. */
async function linked(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  const p2 = doc.addPage([595, 842]);
  p1.drawText('Table of contents: details on page 2', { x: 50, y: 780, size: 12, font });
  p2.drawText('SECRET-PAGE-TWO', { x: 50, y: 780, size: 12, font });
  const link = doc.context.register(
    doc.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [50, 775, 300, 795], Border: [0, 0, 0], Dest: [p2.ref, 'XYZ', PDFNull, PDFNull, PDFNull] }),
  );
  p1.node.set(PDFName.of('Annots'), doc.context.obj([link]));
  return doc.save();
}

/** A PDF 1.4 file with strings in the document info and in an inline annotation on the page. */
async function plainStrings(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('LEAK-INFO');
  const page = doc.addPage([595, 842]);
  page.drawText('Protected body text', { x: 50, y: 780, size: 12, font: await doc.embedFont(StandardFonts.Helvetica) });
  page.node.set(
    PDFName.of('Annots'),
    doc.context.obj([doc.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [50, 700, 70, 720], Contents: PDFString.of('LEAK-ANNOT') })]),
  );
  const bytes = await doc.save({ useObjectStreams: false });
  // Same length, so the cross-reference offsets stay valid.
  bytes.set(new TextEncoder().encode('%PDF-1.4'), 0);
  return bytes;
}

async function linkDocx(): Promise<Buffer> {
  const link = (text: string, href: string) => new ExternalHyperlink({ link: href, children: [new TextRun({ text, style: 'Hyperlink' })] });
  const d = new Document({
    sections: [{ children: [new Paragraph({ children: [link('Run script', 'javascript:document.title="pwned"'), new TextRun(' and '), link('Website', 'https://example.com/')] })] }],
  });
  return Packer.toBuffer(d);
}

export default async function globalSetup() {
  fs.mkdirSync(FIXTURES, { recursive: true });
  fs.writeFileSync(path.join(FIXTURES, 'invoice.pdf'), await invoice('1546.00'));
  fs.writeFileSync(path.join(FIXTURES, 'invoice-changed.pdf'), await invoice('1600.00'));
  fs.writeFileSync(path.join(FIXTURES, 'form.pdf'), await form());
  fs.writeFileSync(path.join(FIXTURES, 'offer.docx'), await docx());
  fs.writeFileSync(path.join(FIXTURES, 'linked.pdf'), await linked());
  fs.writeFileSync(path.join(FIXTURES, 'plain-strings.pdf'), await plainStrings());
  fs.writeFileSync(path.join(FIXTURES, 'links.docx'), await linkDocx());
}
