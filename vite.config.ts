import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildPages, notFoundPage, sitemap, toolLinks } from './src/seo/pages.ts';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version: string };

// `vite preview` sends the same security headers as nginx in production, so
// the production build is tested under the real Content-Security-Policy.
// (The dev server can't: React Fast Refresh needs an inline script.)
const securityHeaders = Object.fromEntries(
  [...fs.readFileSync('nginx/security-headers.conf', 'utf8').matchAll(/^add_header\s+(\S+)\s+"([^"]*)"/gm)].map((m) => [m[1], m[2]]),
);

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
 * A crawlable page per tool and language (dist/merge-pdf.html, dist/pl/polacz-pdf.html,
 * dist/pl/index.html), the 404 page and sitemap.xml, all from src/seo. See src/seo/pages.ts.
 */
function seoPages(): Plugin {
  let outDir = 'dist';
  return {
    name: 'seo-pages',
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    transformIndexHtml(html) {
      const marker = /<!-- tool-links:[^>]*-->/;
      if (!marker.test(html)) throw new Error('index.html: the tool-links marker is missing');
      return html.replace(marker, () => toolLinks('en'));
    },
    generateBundle: {
      order: 'post',
      handler(_, bundle) {
        const index = bundle['index.html'];
        if (index?.type !== 'asset') throw new Error('seo-pages: index.html is not in the bundle');
        for (const page of buildPages(String(index.source))) this.emitFile({ type: 'asset', fileName: page.file, source: page.html });
        this.emitFile({ type: 'asset', fileName: '404.html', source: notFoundPage() });
        this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap() });
      },
    },
    // `vite preview` answers like Cloudflare Pages, so the tests see production behaviour.
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => cleanUrls(outDir, req, res, next));
    },
  };
}

/**
 * Cloudflare Pages' routing for extension-less paths: /merge-pdf serves merge-pdf.html,
 * /pl/ serves pl/index.html, a trailing-slash mismatch redirects, and anything else
 * gets 404.html with a 404 status.
 */
function cleanUrls(dir: string, req: IncomingMessage, res: ServerResponse, next: () => void) {
  const pathname = decodeURIComponent((req.url ?? '/').split('?')[0]);
  const query = (req.url ?? '').includes('?') ? (req.url ?? '').slice((req.url ?? '').indexOf('?')) : '';
  if ((req.method !== 'GET' && req.method !== 'HEAD') || pathname === '/' || pathname.includes('..')) return next();
  const isFile = (p: string) => fs.existsSync(path.join(dir, p)) && fs.statSync(path.join(dir, p)).isFile();
  const bare = pathname.replace(/\/+$/, '');
  const send = (status: number, file: string) => {
    res.statusCode = status;
    for (const [k, v] of Object.entries(securityHeaders)) res.setHeader(k, v);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.end(req.method === 'HEAD' ? undefined : fs.readFileSync(path.join(dir, file)));
  };
  const redirect = (to: string) => {
    res.statusCode = 308;
    res.setHeader('Location', to + query);
    res.end();
  };
  if (isFile(pathname)) return next();
  if (pathname.endsWith('/')) {
    if (isFile(`${pathname}index.html`)) return send(200, `${pathname}index.html`);
    if (isFile(`${bare}.html`)) return redirect(bare);
  } else {
    if (isFile(`${pathname}.html`)) return send(200, `${pathname}.html`);
    if (isFile(`${pathname}/index.html`)) return redirect(`${pathname}/`);
  }
  return send(404, '404.html');
}

export default defineConfig({
  plugins: [react(), versionFile(), seoPages()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5180 },
  preview: { headers: securityHeaders },
  // pdf.js, the embedded fonts and the on-demand HEIC decoder (~3.2 MB, libheif
  // compiled to plain JS) are large; this is a local tool, so big chunks are fine.
  build: { chunkSizeWarningLimit: 3300 },
});
