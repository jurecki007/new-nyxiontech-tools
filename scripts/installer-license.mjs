// Writes the text shown on the installer's licence page: the privacy policy first,
// then the licence. Run by `tauri build` (beforeBuildCommand in tauri.conf.json).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src-tauri/target/installer-license.txt');

// The installers read the file as plain text: drop Markdown markup.
const privacy = readFileSync(join(root, 'PRIVACY.md'), 'utf8')
  .replace(/\*\*(.+?)\*\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/<(https?:[^>]+)>/g, '$1')
  .replace(/^#+ (.+)$/gm, (_, title) => title.toUpperCase());
const license = readFileSync(join(root, 'LICENSE'), 'utf8');

const text = `${privacy.trim()}\n\n${'='.repeat(78)}\n\n${license}`.replace(/\r?\n/g, '\r\n');
// NSIS shows non-ASCII text in the wrong code page.
const bad = text.match(/[^\x00-\x7f]/);
if (bad) throw new Error(`installer licence text must be ASCII, found "${bad[0]}"`);
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, text);
console.log(`wrote ${out}`);
