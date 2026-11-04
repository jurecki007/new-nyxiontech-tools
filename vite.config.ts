import fs from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version: string };

// `vite preview` sends the same security headers as nginx in production, so
// the production build is tested under the real Content-Security-Policy.
// (The dev server can't: React Fast Refresh needs an inline script.)
const securityHeaders = Object.fromEntries(
  [...fs.readFileSync('nginx/security-headers.conf', 'utf8').matchAll(/^add_header\s+(\S+)\s+"([^"]*)"/gm)].map((m) => [m[1], m[2]]),
);

/** One directive of a Content-Security-Policy, e.g. connect-src, without its name. */
const cspDirective = (csp: string, name: string) =>
  csp
    .split(';')
    .map((d) => d.trim())
    .find((d) => d.startsWith(`${name} `))
    ?.slice(name.length + 1) ?? '';
// Shown in the app's Privacy explainer, read from the policies the app is actually served with,
// so the text can't drift from them (tests/e2e/privacy.spec.ts compares it with the live header).
const tauriCsp = (JSON.parse(fs.readFileSync('src-tauri/tauri.conf.json', 'utf8')) as { app: { security: { csp: string } } }).app.security.csp;
const connectSrc = {
  web: cspDirective(securityHeaders['Content-Security-Policy'] ?? '', 'connect-src'),
  desktop: cspDirective(tauriCsp, 'connect-src'),
};
if (!connectSrc.web || !connectSrc.desktop) throw new Error('connect-src not found in nginx/security-headers.conf or src-tauri/tauri.conf.json');

/**
 * Writes /version.json next to the build. A running app polls it (same origin, so
 * the CSP allows it) and offers a reload when a newer version has been deployed.
 */
function versionFile(): Plugin {
  const body = JSON.stringify({ version: pkg.version });
  return {
    name: 'version-file',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: body });
    },
    configureServer(server) {
      server.middlewares.use('/version.json', (_req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.end(body);
      });
    },
  };
}

/**
 * `vite preview` sends the Cache-Control that nginx/nginx.conf sets for /assets/ and /vendor/
 * (sirv's default is no-cache), so tests see what production browsers cache. That matters for
 * offline use: a part a tool loaded once is then served from the browser's cache.
 */
function previewCacheHeaders(): Plugin {
  const nginx = fs.readFileSync('nginx/nginx.conf', 'utf8');
  const rules = ['/assets/', '/vendor/'].flatMap((prefix) => {
    const m = new RegExp(`location\\s+${prefix.replace(/\//g, '\\/')}\\s*\\{[^}]*?add_header\\s+Cache-Control\\s+"([^"]+)"`).exec(nginx);
    return m ? [{ prefix, value: m[1] }] : [];
  });
  return {
    name: 'preview-cache-headers',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const rule = rules.find((r) => req.url?.startsWith(r.prefix));
        if (rule) res.setHeader('Cache-Control', rule.value);
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), versionFile(), previewCacheHeaders()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __CSP_CONNECT_SRC__: JSON.stringify(connectSrc) },
  server: { port: 5180 },
  preview: { headers: securityHeaders },
  // pdf.js, the embedded fonts and the on-demand HEIC decoder (~3.2 MB, libheif
  // compiled to plain JS) are large; this is a local tool, so big chunks are fine.
  build: { chunkSizeWarningLimit: 3300 },
});
