import { zipSync } from 'fflate';
import { isDesktop, saveWithDialog } from './desktop';
import { getLang } from '../i18n';

/** Packs files into a .zip; duplicate names get a numeric suffix. */
export async function zipFiles(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) {
    let name = f.name;
    for (let i = 2; name in entries; i++) name = f.name.replace(/(\.[^.]+)?$/, ` (${i})$1`);
    entries[name] = new Uint8Array(await f.blob.arrayBuffer());
  }
  // Images and PDFs are already compressed; storing them is much faster.
  const zipped = zipSync(entries, { level: 0 });
  return new Blob([zipped], { type: 'application/zip' });
}

/** Fired on window after a result has been saved (see SupportNote). */
export const FILE_SAVED_EVENT = 'nyxiontech:file-saved';
const notifySaved = () => window.dispatchEvent(new Event(FILE_SAVED_EVENT));

/** Saves a file: a "Save as" dialog in the desktop app, a download in the browser. */
export function downloadBlob(blob: Blob, filename: string) {
  if (isDesktop) {
    saveWithDialog(blob, filename).then(
      (saved) => saved && notifySaved(),
      (e) => window.alert(String(e)),
    );
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notifySaved();
}

/** "1.5 KB" in English, "1,5 KB" in languages with a decimal comma. */
export function formatBytes(n: number): string {
  const num = (x: number, digits: number) => {
    const s = x.toFixed(digits);
    return (1.5).toLocaleString(getLang()).includes(',') ? s.replace('.', ',') : s;
  };
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${num(n / 1024, 1)} KB`;
  return `${num(n / 1024 / 1024, 2)} MB`;
}
