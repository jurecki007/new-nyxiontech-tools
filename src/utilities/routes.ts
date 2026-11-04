// The public address of every dashboard tool, in English and Polish. This is the one
// place that maps a tool id to its URL: the app's router (src/lib/route.ts), the
// static page generator (src/seo) and the sitemap all read it. Plain data, so the
// build can import it without React.
//
// The slugs are public links (search results, README, bookmarks): don't change them.

export const TOOL_SLUGS = {
  edit: { en: 'edit-pdf', pl: 'edytuj-pdf' },
  sign: { en: 'sign-pdf', pl: 'podpisz-pdf' },
  'fill-form': { en: 'fill-pdf-form', pl: 'wypelnij-formularz-pdf' },
  'page-numbers': { en: 'add-page-numbers-to-pdf', pl: 'numeracja-stron-pdf' },
  watermark: { en: 'watermark-pdf', pl: 'znak-wodny-pdf' },
  metadata: { en: 'edit-pdf-metadata', pl: 'edytuj-metadane-pdf' },
  merge: { en: 'merge-pdf', pl: 'polacz-pdf' },
  split: { en: 'split-pdf', pl: 'podziel-pdf' },
  organize: { en: 'organize-pdf-pages', pl: 'zmien-kolejnosc-stron-pdf' },
  rotate: { en: 'rotate-pdf', pl: 'obroc-pdf' },
  compress: { en: 'compress-pdf', pl: 'kompresuj-pdf' },
  ocr: { en: 'ocr-pdf', pl: 'ocr-pdf' },
  'images-to-pdf': { en: 'image-to-pdf', pl: 'jpg-do-pdf' },
  'pdf-to-images': { en: 'pdf-to-jpg', pl: 'pdf-do-jpg' },
  'pdf-to-text': { en: 'pdf-to-text', pl: 'pdf-do-tekstu' },
  'pdf-to-word': { en: 'pdf-to-word', pl: 'pdf-do-word' },
  'word-to-pdf': { en: 'word-to-pdf', pl: 'word-do-pdf' },
  protect: { en: 'protect-pdf', pl: 'zabezpiecz-pdf-haslem' },
  unlock: { en: 'unlock-pdf', pl: 'odblokuj-pdf' },
  redact: { en: 'redact-pdf', pl: 'anonimizuj-pdf' },
  compare: { en: 'compare-pdf', pl: 'porownaj-pdf' },
  'image-converter': { en: 'image-converter', pl: 'kompresuj-zdjecia' },
  'remove-background': { en: 'remove-background', pl: 'usun-tlo' },
  'heic-to-jpg': { en: 'heic-to-jpg', pl: 'heic-do-jpg' },
  qr: { en: 'qr-code-generator', pl: 'generator-kodow-qr' },
} as const satisfies Record<string, Record<Lang, string>>;

export type ToolId = keyof typeof TOOL_SLUGS;
export type Lang = 'en' | 'pl';

export const TOOL_IDS = Object.keys(TOOL_SLUGS) as ToolId[];

/** Path of the home page in a language: "/" or "/pl/". */
export const homePath = (lang: Lang) => (lang === 'pl' ? '/pl/' : '/');

/** Path of a tool's page: "/merge-pdf" or "/pl/polacz-pdf". */
export const toolPath = (id: ToolId, lang: Lang) => (lang === 'pl' ? `/pl/${TOOL_SLUGS[id].pl}` : `/${TOOL_SLUGS[id].en}`);

/** The page a path names, or null if it isn't one. Accepts a trailing slash and any letter case. */
export function parsePath(pathname: string): { tool: ToolId | null; lang: Lang } | null {
  let p = pathname.toLowerCase().replace(/\/index\.html$/, '/');
  if (p !== '/' && p.endsWith('/')) p = p.slice(0, -1);
  if (p === '' || p === '/') return { tool: null, lang: 'en' };
  if (p === '/pl') return { tool: null, lang: 'pl' };
  const lang: Lang = p.startsWith('/pl/') ? 'pl' : 'en';
  const slug = lang === 'pl' ? p.slice(4) : p.slice(1);
  const tool = TOOL_IDS.find((id) => TOOL_SLUGS[id][lang] === slug);
  return tool ? { tool, lang } : null;
}
