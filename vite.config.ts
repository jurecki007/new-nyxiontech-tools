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

export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 5180 },
  preview: { headers: securityHeaders },
  // pdf.js and the embedded fonts are large; this is a local tool, so one bundle is fine.
  build: { chunkSizeWarningLimit: 2500 },
});
