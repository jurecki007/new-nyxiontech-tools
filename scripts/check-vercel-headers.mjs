// Fails the build if vercel.json's security headers differ from nginx/security-headers.conf,
// so the hosted site (Vercel) and self-hosted Docker image always send the same CSP.
// Runs before `npm run build`.
import { readFileSync } from 'node:fs';

const nginx = Object.fromEntries(
  [...readFileSync('nginx/security-headers.conf', 'utf8').matchAll(/^add_header\s+(\S+)\s+"([^"]*)"/gm)].map((m) => [m[1], m[2]]),
);
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));
const all = vercel.headers.find((h) => h.source === '/(.*)');
const got = Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]));

const wrong = Object.entries(nginx).filter(([k, v]) => got[k] !== v).map(([k]) => k);
if (wrong.length) {
  console.error(`vercel.json headers differ from nginx/security-headers.conf: ${wrong.join(', ')}`);
  console.error('Copy the values from nginx/security-headers.conf into the "/(.*)" entry of vercel.json.');
  process.exit(1);
}
