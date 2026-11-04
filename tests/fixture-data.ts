// Text shared by tests/global-setup.ts (which draws it into PDFs) and the specs
// (which check what happened to it). Synthetic data only.

/** One line of the redaction pattern fixture; `hit` marks text the preset must find (`match`, or the whole line). */
export interface PatternLine {
  text: string;
  hit: boolean;
  match?: string;
}

/** Page layout of patterns.pdf: Helvetica 12 pt, first baseline at y=780, 30 pt apart. */
export const PATTERN_LAYOUT = { x: 50, top: 780, step: 30, size: 12, pageW: 595, pageH: 842 };

/** One page per preset in REDACT_PATTERNS (same order): positives and look-alikes. */
export const PATTERN_PAGES: { preset: string; lines: PatternLine[] }[] = [
  {
    preset: 'E-mail addresses',
    lines: [
      { text: 'jan.kowalski@firma.pl', hit: true },
      { text: 'a.b+tag@sub.example.co.uk', hit: true },
      // Narrow letters before wide ones: a box placed by average character width would miss the start.
      { text: 'illicit lilt fill: WOMBAT.MAXIMUM@MEGAWOW.COM', hit: true, match: 'WOMBAT.MAXIMUM@MEGAWOW.COM' },
      { text: 'user at example dot com', hit: false },
      { text: 'Follow @nyxiontech', hit: false },
      { text: 'Invoice 3/10/2026', hit: false },
    ],
  },
  {
    preset: 'Phone numbers',
    lines: [
      { text: '+48 600 123 456', hit: true },
      { text: '+48600123456', hit: true },
      { text: '600-123-456', hit: true },
      { text: '600 123 456', hit: true },
      { text: 'Order 12345678', hit: false },
      { text: 'Date 2026-11-04', hit: false },
      { text: 'Postcode 15-540', hit: false },
    ],
  },
  {
    preset: 'Bank account numbers',
    lines: [
      { text: 'PL61 1090 1014 0000 0712 1981 2874', hit: true },
      { text: 'PL61109010140000071219812874', hit: true },
      { text: '61 1090 1014 0000 0712 1981 2874', hit: true },
      { text: 'DE89 3704 0044 0532 0130 00', hit: true },
      { text: 'GB29 NWBK 6016 1331 9268 19', hit: true },
      { text: 'ISO 9001', hit: false },
      { text: 'Ref AB12 3456', hit: false },
    ],
  },
  {
    preset: 'NIP / PESEL numbers',
    lines: [
      { text: 'NIP 542-333-87-95', hit: true, match: '542-333-87-95' },
      { text: 'NIP 5423338795', hit: true, match: '5423338795' },
      { text: 'NIP 542-33-38-795', hit: true, match: '542-33-38-795' },
      { text: 'PESEL 44051401359', hit: true, match: '44051401359' },
      { text: 'Code 12-345', hit: false },
      { text: 'Serial 123456789012', hit: false },
      { text: 'Year 2026', hit: false },
    ],
  },
];

/** Planted in many places of secrets.pdf; none of them may survive redaction. */
export const SECRET = 'TOPSECRET-4471';

/** Comments and form fields of comments.pdf that do not contain SECRET (see tests/global-setup.ts). */
export const COMMENTS = {
  keepNote: 'KEEP-THIS-NOTE',
  email: 'reviewer.mail@example.org',
  keepField: 'KEEP-FIELD-VALUE',
};

/** Polish text of polish.pdf (pages 1 and 3; page 2 is empty). */
export const POLISH = {
  heading: 'Zażółć gęślą jaźń',
  line1: 'Łódź, ul. Świętokrzyska 5',
  line2: 'Zamówienie nr 7/2026 dla Pani Żanety',
  para2: 'Drugi akapit: źdźbło, chrząszcz.',
  page3: 'Strona trzecia: ćma i źrebię.',
  stdBold: 'Standard bold line',
  stdSmall: 'Standard small line',
};
