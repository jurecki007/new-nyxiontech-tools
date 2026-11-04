// Generates synthetic test documents (no real customer data) into tests/.fixtures.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { degrees, PDFDocument, PDFHexString, PDFName, PDFNull, PDFString, rgb, StandardFonts } from 'pdf-lib';
import {
  AlignmentType,
  Bookmark,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  InternalHyperlink,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
} from 'docx';
import { fontkitAdapter } from '../src/lib/fontkitAdapter';
import { FIXTURES, lockedPdf } from './e2e/helpers';
import { COMMENTS, PATTERN_LAYOUT, PATTERN_PAGES, POLISH, SECRET } from './fixture-data';

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

const require = createRequire(import.meta.url);
const dejavu = (file: string) => fs.readFileSync(path.join(path.dirname(require.resolve('dejavu-fonts-ttf/package.json')), 'ttf', file));

/**
 * Polish text in an embedded font (so pdf.js can extract the diacritics), with a
 * bold heading, a paragraph gap, an empty page 2, and standard-font lines on page 3.
 */
async function polish(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkitAdapter);
  const regular = await doc.embedFont(dejavu('DejaVuSans.ttf'), { subset: true });
  const bold = await doc.embedFont(dejavu('DejaVuSans-Bold.ttf'), { subset: true });
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const helvBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const p1 = doc.addPage([595, 842]);
  p1.drawText(POLISH.heading, { x: 50, y: 780, size: 20, font: bold });
  p1.drawText(POLISH.line1, { x: 50, y: 740, size: 11, font: regular });
  p1.drawText(POLISH.line2, { x: 50, y: 725, size: 11, font: regular });
  // A 45 pt jump: a new paragraph, not a wrapped line.
  p1.drawText(POLISH.para2, { x: 50, y: 680, size: 11, font: regular });
  doc.addPage([595, 842]);
  const p3 = doc.addPage([595, 842]);
  p3.drawText(POLISH.page3, { x: 50, y: 780, size: 11, font: regular });
  p3.drawText(POLISH.stdBold, { x: 50, y: 740, size: 14, font: helvBold });
  p3.drawText(POLISH.stdSmall, { x: 50, y: 715, size: 9, font: helv });
  return doc.save();
}

/** Pages of different sizes; page 1 is A4 shown rotated 90° with a black square in its own top-left corner. */
async function sizes(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  p1.drawRectangle({ x: 0, y: 742, width: 100, height: 100, color: rgb(0, 0, 0) });
  p1.drawText('Rotated page', { x: 150, y: 780, size: 14, font });
  p1.setRotation(degrees(90));
  doc.addPage([612, 792]).drawText('Letter page', { x: 50, y: 740, size: 14, font });
  doc.addPage([200, 100]).drawText('Small', { x: 20, y: 40, size: 14, font });
  return doc.save();
}

/** A page with graphics but no text, like a scan. */
async function blank(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([595, 842]).drawRectangle({ x: 50, y: 600, width: 300, height: 200, color: rgb(0.8, 0.8, 0.8) });
  return doc.save();
}

/** One page per redaction preset, each with matching and look-alike lines. */
async function patterns(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const { x, top, step, size, pageW, pageH } = PATTERN_LAYOUT;
  for (const { lines } of PATTERN_PAGES) {
    const page = doc.addPage([pageW, pageH]);
    lines.forEach((l, i) => page.drawText(l.text, { x, y: top - i * step, size, font }));
  }
  return doc.save();
}

/**
 * The secret on page 1's text, and also in places outside the page text: document
 * info, XMP metadata, an outline entry, a comment and a form field on page 1, and
 * an attached file. Page 2 does not contain it.
 */
async function secrets(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Report ${SECRET}`);
  doc.setAuthor(SECRET);
  doc.setSubject(SECRET);
  doc.setKeywords([SECRET]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  const p2 = doc.addPage([595, 842]);
  p1.drawText(`Client: ${SECRET}`, { x: 50, y: 780, size: 12, font });
  p1.drawText('Public footer text', { x: 50, y: 100, size: 12, font });
  p2.drawText('Untouched page text', { x: 50, y: 780, size: 12, font });

  const field = doc.getForm().createTextField('client');
  field.setText(SECRET);
  field.addToPage(p1, { x: 50, y: 600, width: 200, height: 24 });
  p1.node.addAnnot(doc.context.register(doc.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [300, 700, 320, 720], Contents: PDFString.of(SECRET) })));

  const outlines = doc.context.nextRef();
  const item = doc.context.register(
    doc.context.obj({ Title: PDFHexString.fromText(`Chapter ${SECRET}`), Parent: outlines, Dest: [p1.ref, 'XYZ', PDFNull, PDFNull, PDFNull] }),
  );
  doc.context.assign(outlines, doc.context.obj({ Type: 'Outlines', First: item, Last: item, Count: 1 }));
  doc.catalog.set(PDFName.of('Outlines'), outlines);

  const xmp = `<?xpacket begin="" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:description>${SECRET}</dc:description></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  doc.catalog.set(PDFName.of('Metadata'), doc.context.register(doc.context.stream(xmp, { Type: 'Metadata', Subtype: 'XML' })));

  await doc.attach(new TextEncoder().encode(`attachment body ${SECRET}`), `${SECRET}.txt`, { mimeType: 'text/plain', description: SECRET });
  return doc.save({ useObjectStreams: false });
}

/** The secret in page 1's text and in a reviewer comment on page 2 (which gets no redactions). */
async function secretComment(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  const p2 = doc.addPage([595, 842]);
  p1.drawText(`Client: ${SECRET}`, { x: 50, y: 780, size: 12, font });
  p2.drawText('Reviewer notes', { x: 50, y: 780, size: 12, font });
  p2.node.addAnnot(doc.context.register(doc.context.obj({ Type: 'Annot', Subtype: 'Text', Rect: [300, 700, 320, 720], Contents: PDFString.of(`${SECRET} approved`) })));
  return doc.save({ useObjectStreams: false });
}

/** Opens without a password, but printing and copying need the owner password. */
/**
 * The secret in page 1's text only. Page 2 (no secret in its text) has eight annotations,
 * in this order: a comment with the secret in lower case and its popup, a reply to that
 * comment, a comment to keep, a FreeText box whose rich text splits the secret with a tag,
 * a square whose subject is the secret, a comment whose author is the secret, and a
 * comment with an e-mail address. Page 3 has two form fields: "account" holds the secret
 * (with a tooltip repeating it), "note" holds a value to keep.
 */
async function comments(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([595, 842]);
  const p2 = doc.addPage([595, 842]);
  const p3 = doc.addPage([595, 842]);
  p1.drawText(`Client: ${SECRET}`, { x: 50, y: 780, size: 12, font });
  p2.drawText('Reviewer notes', { x: 50, y: 780, size: 12, font });
  p3.drawText('Form page', { x: 50, y: 780, size: 12, font });

  const ctx = doc.context;
  // A modification date full of digits: presets must not take it for a phone number.
  const M = PDFString.of("D:20261104120000+01'00'");
  const rect = (y: number) => [300, y, 320, y + 20];
  const note = ctx.nextRef();
  const popup = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Popup', Rect: [320, 600, 480, 700], Parent: note, Open: false }));
  ctx.assign(note, ctx.obj({ Type: 'Annot', Subtype: 'Text', Rect: rect(700), T: PDFHexString.fromText('Alice'), M, Contents: PDFHexString.fromText(`please check ${SECRET.toLowerCase()}`), Popup: popup }));
  const reply = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Text', Rect: rect(700), T: PDFString.of('Bob'), M, Contents: PDFString.of('Agreed'), IRT: note, RT: 'R' }));
  const keep = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Text', Rect: rect(650), T: PDFString.of('Carol'), M, Contents: PDFString.of(COMMENTS.keepNote) }));
  const rich = `<?xml version="1.0"?><body xmlns="http://www.w3.org/1999/xhtml"><p>Call <b>${SECRET.slice(0, 9)}</b>${SECRET.slice(9)}</p></body>`;
  const freeText = ctx.register(
    ctx.obj({ Type: 'Annot', Subtype: 'FreeText', Rect: [50, 500, 250, 530], DA: PDFString.of('/Helv 12 Tf 0 g'), M, Contents: PDFString.of('See box'), RC: PDFString.of(rich) }),
  );
  const square = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Square', Rect: [50, 400, 150, 450], M, Subj: PDFString.of(SECRET), Contents: PDFString.of('square') }));
  const author = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Text', Rect: rect(600), T: PDFString.of(SECRET), M, Contents: PDFString.of('by name') }));
  const mail = ctx.register(ctx.obj({ Type: 'Annot', Subtype: 'Text', Rect: rect(550), T: PDFString.of('Dave'), M, Contents: PDFString.of(`Mail ${COMMENTS.email}`) }));
  p2.node.set(PDFName.of('Annots'), ctx.obj([note, popup, reply, keep, freeText, square, author, mail]));

  const form = doc.getForm();
  const account = form.createTextField('account');
  account.setText(SECRET);
  account.acroField.dict.set(PDFName.of('TU'), PDFHexString.fromText(`Account ${SECRET}`));
  account.addToPage(p3, { x: 50, y: 600, width: 200, height: 24 });
  const kept = form.createTextField('note');
  kept.setText(COMMENTS.keepField);
  kept.addToPage(p3, { x: 50, y: 500, width: 200, height: 24 });
  return doc.save({ useObjectStreams: false });
}

function ownerOnly(): Promise<Uint8Array> {
  return lockedPdf({ user: '', owner: 'Owner#1', text: 'Restricted but readable', info: { title: 'Owner-only title' } });
}

// ---- A tiny PNG encoder (Node has no canvas), for the image inside rich.docx ----

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf: Buffer) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
/** A solid-colour RGB PNG. */
function solidPng(w: number, h: number, [r, g, b]: [number, number, number]): Buffer {
  const row = Buffer.alloc(1 + w * 3);
  for (let x = 0; x < w; x++) row.set([r, g, b], 1 + x * 3);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Headings, lists, a table, an image, Polish text, and links both safe and unsafe. */
async function richDocx(): Promise<Buffer> {
  const link = (text: string, href: string) => new ExternalHyperlink({ link: href, children: [new TextRun({ text, style: 'Hyperlink' })] });
  const cell = (t: string) => new TableCell({ children: [new Paragraph(t)] });
  const d = new Document({
    numbering: {
      config: [{ reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START }] }],
    },
    sections: [
      {
        children: [
          new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new Bookmark({ id: 'top', children: [new TextRun('Raport kwartalny')] })] }),
          new Paragraph({ text: 'Podsumowanie', heading: HeadingLevel.HEADING_2 }),
          new Paragraph({ children: [new TextRun({ text: 'Pogrubione: ', bold: true }), new TextRun({ text: 'kursywa', italics: true }), new TextRun(' i zwykły tekst: Żółć.')] }),
          new Paragraph({ text: 'Punkt pierwszy', bullet: { level: 0 } }),
          new Paragraph({ text: 'Punkt drugi', bullet: { level: 0 } }),
          new Paragraph({ text: 'Punkt trzeci', bullet: { level: 0 } }),
          new Paragraph({ text: 'Krok jeden', numbering: { reference: 'steps', level: 0 } }),
          new Paragraph({ text: 'Krok dwa', numbering: { reference: 'steps', level: 0 } }),
          new Table({ rows: [new TableRow({ children: [cell('Miasto'), cell('Kwota')] }), new TableRow({ children: [cell('Gdańsk'), cell('1 234,56 zł')] })] }),
          new Paragraph({ children: [new ImageRun({ type: 'png', data: solidPng(40, 20, [200, 30, 30]), transformation: { width: 40, height: 20 } })] }),
          new Paragraph('<script>alert(1)</script> <img src=x onerror=alert(2)>'),
          new Paragraph({
            children: [
              link('JS upper', ' JAVASCRIPT:alert(3)'),
              new TextRun(' | '),
              link('Data link', 'data:text/html,<script>alert(4)</script>'),
              new TextRun(' | '),
              link('VB link', 'vbscript:msgbox(5)'),
              new TextRun(' | '),
              link('Mail us', 'mailto:biuro@example.com'),
              new TextRun(' | '),
              link('Web', 'https://example.com/oferta'),
              new TextRun(' | '),
              new InternalHyperlink({ anchor: 'top', children: [new TextRun('Back to top')] }),
            ],
          }),
        ],
      },
    ],
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
  fs.writeFileSync(path.join(FIXTURES, 'polish.pdf'), await polish());
  fs.writeFileSync(path.join(FIXTURES, 'sizes.pdf'), await sizes());
  fs.writeFileSync(path.join(FIXTURES, 'blank.pdf'), await blank());
  fs.writeFileSync(path.join(FIXTURES, 'patterns.pdf'), await patterns());
  fs.writeFileSync(path.join(FIXTURES, 'secrets.pdf'), await secrets());
  fs.writeFileSync(path.join(FIXTURES, 'secret-comment.pdf'), await secretComment());
  fs.writeFileSync(path.join(FIXTURES, 'comments.pdf'), await comments());
  fs.writeFileSync(path.join(FIXTURES, 'owner-only.pdf'), await ownerOnly());
  fs.writeFileSync(path.join(FIXTURES, 'rich.docx'), await richDocx());
}
