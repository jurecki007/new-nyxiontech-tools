// Fails the build if public/_headers (Cloudflare Pages) sends different security
// headers than nginx/security-headers.conf (Docker image), so both hostings
// always use the same Content-Security-Policy. Runs before `npm run build`.
import { readFileSync } from 'node:fs';

const nginx = Object.fromEntries(
  [...readFileSync('nginx/security-headers.conf', 'utf8').matchAll(/^add_header\s+(\S+)\s+"([^"]*)"/gm)].map((m) => [m[1], m[2]]),
);
// The "/*" block: from its line to the next blank line.
const block = readFileSync('public/_headers', 'utf8').split(/^\/\*\s*$/m)[1]?.split(/\n\s*\n/)[0] ?? '';
const pages = Object.fromEntries(
  [...block.matchAll(/^\s+([\w-]+):\s*(.*)$/gm)].map((m) => [m[1], m[2].trim()]),
);

const wrong = Object.keys(nginx).filter((k) => pages[k] !== nginx[k]);
if (wrong.length) {
  console.error(`public/_headers differs from nginx/security-headers.conf: ${wrong.join(', ')}`);
  console.error('Copy the values from nginx/security-headers.conf into the "/*" block of public/_headers.');
  process.exit(1);
}
