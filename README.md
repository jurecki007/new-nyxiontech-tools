<div align="center">

# Nyxiontech PDF Tools

**Free, open-source PDF and image tools that run entirely in your browser.**<br>
Edit, sign, merge, split, compress, OCR, redact and convert, without uploading a single file.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![CI](https://github.com/jurecki007/nyxiontech-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/jurecki007/nyxiontech-tools/actions/workflows/ci.yml)
[![Made by Nyxiontech](https://img.shields.io/badge/made%20by-Nyxiontech-2643e8)](https://nyxiontech.com)

[Website](https://nyxiontech.com) · [Report a bug](https://github.com/jurecki007/nyxiontech-tools/issues/new?template=bug_report.yml) · [Request a feature](https://github.com/jurecki007/nyxiontech-tools/issues/new?template=feature_request.yml) · [Support the project](#support-the-project)

</div>

---

Nyxiontech PDF Tools covers the everyday jobs people otherwise pay iLovePDF, Smallpdf and similar services for.
Everything runs locally in the browser: **files are never uploaded**, there is no account and no tracking. Projects are autosaved in the browser's IndexedDB.

Built and maintained by [Nyxiontech](https://nyxiontech.com), which builds AI implementations, business automations and custom web and mobile apps.

## Support the project

Nyxiontech PDF Tools is free and will stay free. If it saves you a subscription, please consider supporting its development:

<!--
  DONATION LINKS: replace the placeholders below, then uncomment this block.
  Use the same URL for DONATE_URL in src/config.ts (shows a "Support" link in the app)
  and enable the matching line in .github/FUNDING.yml (adds GitHub's "Sponsor" button).

<p>
  <a href="https://github.com/sponsors/YOUR_GITHUB_USERNAME"><img alt="Sponsor on GitHub" src="https://img.shields.io/badge/Sponsor-GitHub-ea4aaa?logo=githubsponsors&logoColor=white"></a>
  <a href="https://ko-fi.com/YOUR_KOFI_NAME"><img alt="Support on Ko-fi" src="https://img.shields.io/badge/Support-Ko--fi-ff5e5b?logo=kofi&logoColor=white"></a>
  <a href="https://buymeacoffee.com/YOUR_BMC_NAME"><img alt="Buy me a coffee" src="https://img.shields.io/badge/Buy%20me%20a-coffee-ffdd00?logo=buymeacoffee&logoColor=black"></a>
</p>
-->

- ⭐ Star the repository: it helps other people find it.
- 🐛 [Report bugs](https://github.com/jurecki007/nyxiontech-tools/issues) and suggest features.
- 🛠️ [Contribute](CONTRIBUTING.md) code, tests or translations.
- 💼 Need a custom tool, an integration or AI automation for your business? [Work with Nyxiontech](https://nyxiontech.com).

## Run

```bash
npm install
npm run dev      # http://localhost:5180
```

On Windows you can also double-click `start.bat`.

`npm run build` produces a static site in `dist/` that can be served by any web server.

### Tests

End-to-end tests use Playwright (`tests/e2e`). They cover the dashboard, the editor and every tool, and check the downloaded files with pdf-lib and pdf.js.

```bash
npm run test:e2e          # builds, serves the production build on :4173, runs the suite (~1–2 min)
npm run test:e2e:report   # opens the HTML report
```

- Test documents are generated in `tests/global-setup.ts` and contain no real data.
- Tests use the installed Google Chrome. Set `PW_CHANNEL=chromium` after `npx playwright install chromium` to use Playwright's own browser (CI does this).
- Tests run with one worker, because OCR and the AI model use a lot of memory.
- `vite preview` sends the same security headers as nginx (read from `nginx/security-headers.conf`), so the tests run under the production Content-Security-Policy. The dev server (`npm run dev`) cannot send it: React Fast Refresh needs an inline script.

Not covered: HEIC conversion (needs a sample iPhone photo) and the print dialog in "Word to PDF".

## Self-hosting

The app is a static site, so any web server works. The included Docker image is nginx serving the build:

```bash
docker build -t nyxiontech-pdf-tools .
docker run --rm -p 8080:80 nyxiontech-pdf-tools   # http://localhost:8080
```

- `/health` returns `{"status":"UP"}` for liveness and readiness probes.
- `/info` returns the name, version and build time.
- Hashed `/assets/*` are cached for a year, `/vendor/*` (OCR and ML files) for a week, and `index.html` is always revalidated.
- A strict Content-Security-Policy allows only this origin, plus WebAssembly and blob workers (`nginx/security-headers.conf`).
- There is no backend: documents never reach the server.

### Updates

Each build writes `/version.json`. The app checks it on start, every 30 minutes and when the tab becomes visible again. When a newer version has been deployed, it shows a banner offering to reload. The check only talks to the server the app was loaded from.
"What's new" and "About" in the sidebar show the running version and the history from `CHANGELOG.md`.

To release: bump `version` in `package.json`, add a section to `CHANGELOG.md`, and deploy.

### Rebranding a fork

Name, links and the optional donation URL are in `src/config.ts`. Colours are the `--accent*` and `--dark` tokens at the top of `src/styles.css`. The wordmark is in `Shell.tsx` and `Editor.tsx`, and the favicon is in `index.html`.
Under the AGPL, a modified version that you let others use over a network must offer them its source code. Keep the "Source code" link pointing at your fork.

## Dashboard tools

The sidebar on the main screen lists every tool, grouped and searchable. Each tool has its own URL (`#/tool/<id>`).

| Group | Tools |
| --- | --- |
| Edit & sign | Edit PDF, Sign PDF (draw / type / upload, with white-background removal), Fill PDF form (incl. flatten), Page numbers, Watermark, Edit metadata |
| Organize | Merge PDF, Split PDF (every page / ranges / extract), Organize pages, Rotate PDF |
| Optimize | Compress PDF (lossless repack, or rasterize at three levels) |
| Convert | OCR: searchable PDF (Polish + English), Images to PDF (incl. iPhone HEIC), PDF to images, PDF to text, PDF to Word, Word to PDF |
| Security | Protect PDF (AES-256, permissions), Unlock PDF, Redact PDF (find text, preset patterns, or draw boxes) |
| Review | Compare PDFs (text diff and visual diff per page) |
| Images | Compress & convert images (JPG/PNG/WebP, resize, strips EXIF), Remove background (on-device AI or plain colour), HEIC to JPG |
| Other | QR code generator (link, Wi-Fi, contact card, e-mail, text; PNG/SVG) |

Results can be downloaded one by one or as a .zip, and PDFs can be sent straight to the editor.

### How the heavier tools work

- **OCR**: Tesseract (tesseract.js) recognises each page; the words are added as an invisible text layer over the untouched page, so the PDF looks identical but becomes searchable. About 10 s per page at 300 dpi.
- **Redact**: pages with redactions are re-rendered as images with the boxes burnt in, so the hidden text is really gone. Pages without redactions stay as they are.
- **Remove background**: U²-Net (small) runs on-device with ONNX Runtime Web; the plain-colour mode flood-fills from the image edges.
- **Word**: PDF to Word keeps text, paragraphs, bold and sizes but not tables, columns or images. Word to PDF converts .docx to HTML (mammoth) and uses the browser's print dialog ("Save as PDF"). Neither reproduces complex layouts exactly; that needs Word or LibreOffice.

### Offline assets

OCR and background removal load a worker, WebAssembly, language data and a model by URL.
`scripts/copy-assets.mjs` copies them from `node_modules` and `assets/` into `public/vendor/` (about 50 MB) before `npm run dev` and `npm run build`, so nothing is fetched from a CDN.

## Editor features

- **Dashboard**: drop one or more PDFs (several files are merged into one document) and see recent documents with thumbnails. You can open, duplicate or delete them, or remove them all with "Clear all documents" (useful on shared computers).
- **Tools sidebar** on the left, grouped and collapsible. The active tool's options (for example the default font for new text, or the whiteout colour) appear underneath and are remembered.
- **Text**: click to place it, then edit content, font, size, bold/italic, colour and opacity. Supports multiple lines and Polish characters.
- **21 fonts**, all with Polish characters and all embedded as subsets in the output:
  - Sans-serif: DejaVu Sans, Arimo, Roboto, Open Sans, Lato, Source Sans 3, Montserrat, DejaVu Sans Condensed, Oswald
  - Serif: DejaVu Serif, Tinos, PT Serif, Merriweather, EB Garamond, Playfair Display
  - Monospace: Cousine, Roboto Mono, DejaVu Sans Mono
  - Handwriting: Dancing Script, Great Vibes, Caveat

  Arimo, Tinos and Cousine have the same metrics as Arial, Times and Courier, so added text matches typical generated invoices. New text defaults to Arimo.
- **Whiteout / Highlight / Box**: drag to draw. To "change" existing text, whiteout the old text and type over it.
- **Images & stamps**: PNG, JPEG, WebP, GIF or SVG (converted to PNG). Resizing keeps the aspect ratio; hold Shift to resize freely.
- **Snippets**: reusable text stamps, stored in localStorage. "Country of Origin: Poland (Polska)" is included by default. Save any selected text as a snippet with the stamp button.
- **Pages**: drag to reorder; rotate, duplicate or delete pages; append pages from other PDFs.
- **Undo/redo** and keyboard shortcuts (listed in the sidebar).
- **Download**: writes a new PDF that keeps the original content and draws the edits on top. The file name comes from the name field in the top bar.

## How it works

| Piece | Library |
| --- | --- |
| Rendering pages | `pdfjs-dist` |
| Writing the output PDF | `pdf-lib` + `fontkit` 2 (through `src/lib/fontkitAdapter.ts`) |
| Fonts (on screen and embedded as subsets) | `dejavu-fonts-ttf` (Bitstream Vera), `@expo-google-fonts/*` (SIL OFL) |
| Local storage | `idb-keyval` |
| Password protect / unlock | `@cantoo/pdf-lib` (maintained pdf-lib fork, loaded on demand) |
| HEIC photos | `heic2any` (loaded on demand; contains libheif/libde265, LGPL-3.0) |
| Zip, QR codes | `fflate`, `qrcode` |
| OCR | `tesseract.js` + `tesseract.js-core` + `@tesseract.js-data/pol`, `/eng` |
| Background removal | `onnxruntime-web` + U²-Net small (`assets/models`) |
| Word | `docx` (write .docx), `mammoth` (read .docx) |

`@pdf-lib/fontkit` is deliberately not used: it writes broken subsets when one PDF uses several custom fonts.
fontkit 2 does not have that problem; the adapter only bridges one renamed method.

Annotations are stored in *view space*: points measured from the top-left of the page as displayed, after rotation.
`src/lib/export.ts` maps them back to PDF user space for every rotation, taking the crop box into account.
The original page content is never modified.

### Source layout

```
src/
  utilities/            dashboard tools (merge, compress, QR, ...), registry in index.ts
  tools/                editor tools: one module per tool, registry in index.ts
  types.ts              data model (Project, PageRef, Annot, ...)
  lib/doc.ts            pure document operations + undo/redo reducer
  lib/export.ts         PDF generation from the editor
  lib/pdfTools.ts       PDF operations for the dashboard tools
  lib/images.ts         image decode/encode, HEIC, images → PDF
  lib/ocr.ts, forms.ts, redact.ts, compare.ts, background.ts, office.ts   the heavier tools
  lib/pdfjs.ts          pdf.js loading/rendering cache
  lib/fonts.ts          font registry API, lazy loading for the screen
  lib/fontFiles.ts      list of bundled font files
  lib/fontkitAdapter.ts fontkit 2 for pdf-lib
  lib/storage.ts        IndexedDB projects, localStorage snippets
  lib/updates.ts        update check (/version.json) and changelog parser
  config.ts             app name, links, donation URL
  components/           Shell (sidebar), Home (dashboard), Editor, AboutDialog, ToolSidebar, PageView, Inspector, ...
```

## Adding a dashboard tool

Write a `Utility` in `src/utilities/`. `ui.tsx` has the shared building blocks: file drop, file list, options, run button with progress, and results with zip download.
Then list it in `src/utilities/index.ts`. The sidebar, dashboard grid and route pick it up.
PDF operations live in `src/lib/pdfTools.ts`, image ones in `src/lib/images.ts`.

## Adding an editor tool

1. Create a module in `src/tools/`. It exports either:
   - a `ModeTool`: stays active and handles pointer input on a page. `begin()` runs on pointer down and may return a drag session. Optional `defaults` and `Options` add per-tool settings to the sidebar.
   - an `ActionTool`: `run()` executes once when the tool is picked, for example to open a file dialog.
2. Add it to `TOOLS` in `src/tools/index.ts`.

The sidebar, keyboard shortcut and settings persistence pick it up automatically.
Moving, resizing and selecting existing elements are handled by `PageView` for every tool.
Use `select.ts`, `text.tsx`, `shapes.tsx` and `image.ts` as examples.

To add a font, install a package that ships TTF files and add an entry to `src/lib/fontFiles.ts`.

## Notes

- Invoices registered in KSeF: editing the PDF does not change the KSeF record.
- Existing PDF text cannot be edited in place; use Whiteout and add new text instead.

## Contributing

Contributions are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). Please report security issues privately as described in [SECURITY.md](SECURITY.md).
This project follows the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Copyright © 2026 Nyxiontech and contributors.

Nyxiontech PDF Tools is free software: you can redistribute it and/or modify it under the terms of the [GNU Affero General Public License v3.0](LICENSE) or (at your option) any later version.
Bundled libraries, fonts, language data and the background-removal model keep their own licences; see [THIRD-PARTY-NOTICES.txt](public/THIRD-PARTY-NOTICES.txt).
