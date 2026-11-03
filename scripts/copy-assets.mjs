// Copies runtime assets that libraries load by URL (OCR worker, WASM, language
// data, ML model) into public/vendor, so the app never fetches them from a CDN.
// Runs automatically before `npm run dev` and `npm run build`.
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = join(root, 'node_modules');
const out = join(root, 'public', 'vendor');

function copy(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  // Skip unchanged files so dev restarts stay fast.
  if (existsSync(to) && statSync(to).size === statSync(from).size && statSync(to).mtimeMs >= statSync(from).mtimeMs) return;
  copyFileSync(from, to);
}

// Tesseract OCR: worker, the four core builds it picks between at runtime
// (the .wasm.js files embed their WebAssembly), and language data.
copy(join(nm, 'tesseract.js/dist/worker.min.js'), join(out, 'tesseract/worker.min.js'));
for (const f of readdirSync(join(nm, 'tesseract.js-core'))) {
  if (/^tesseract-core.*\.wasm\.js$/.test(f)) copy(join(nm, 'tesseract.js-core', f), join(out, 'tesseract-core', f));
}
for (const lang of ['pol', 'eng']) {
  copy(join(nm, `@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`), join(out, 'tessdata', `${lang}.traineddata.gz`));
}

// pdf.js: WebAssembly image decoders (JPEG 2000, JBIG2) and colour management,
// plus the JS fallbacks it loads where WebAssembly is unavailable, and ICC profiles.
for (const f of ['openjpeg.wasm', 'jbig2.wasm', 'qcms_bg.wasm', 'openjpeg_nowasm_fallback.js', 'jbig2_nowasm_fallback.js']) {
  copy(join(nm, 'pdfjs-dist/wasm', f), join(out, 'pdfjs/wasm', f));
}
for (const f of readdirSync(join(nm, 'pdfjs-dist/iccs'))) {
  if (f.endsWith('.icc')) copy(join(nm, 'pdfjs-dist/iccs', f), join(out, 'pdfjs/iccs', f));
}

// ONNX Runtime (background removal).
for (const f of readdirSync(join(nm, 'onnxruntime-web/dist'))) {
  if (/^ort-wasm-simd-threaded\.(mjs|wasm)$/.test(f)) copy(join(nm, 'onnxruntime-web/dist', f), join(out, 'ort', f));
}

// U²-Net (small) salient-object model: U-2-Net (Apache-2.0), ONNX export from rembg (MIT). See THIRD-PARTY-NOTICES.
copy(join(root, 'assets/models/u2netp.onnx'), join(out, 'models/u2netp.onnx'));

console.log('vendor assets ready in public/vendor');
