# Changelog

All notable changes to this project are listed here. The app shows this file under "What's new".
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Every tool has its own address, such as tools.nyxiontech.com/merge-pdf or /compress-pdf, that can be bookmarked and shared, and a page search engines can find (title, description, how-to and questions for that tool). Old `#/tool/…` links still work and switch to the new address. The desktop app is unchanged.
- Polish pages for every tool, such as /pl/polacz-pdf or /pl/kompresuj-pdf, and a Polish home page at /pl/. They open the same app.
- Polish interface: under /pl/ every button, message and dialog is in Polish, and an EN / PL switch at the bottom of the sidebar opens the same page in the other language. The Windows app follows the system language and remembers a choice made with the switch. Translators can add a language: see TRANSLATING.md.
- Unknown addresses show a "Page not found" page with a 404 status instead of the dashboard.
- The sitemap is generated from the list of tools and includes both languages.
- Windows app: "Check for updates automatically" under About (on by default). When it's off, the app never contacts GitHub on its own; "Check now" checks on request.
- Privacy policy (PRIVACY.md), also shown on the installer's licence page.
- README: a short demo, a comparison with other PDF tools, and "Why does Windows warn me?" (the SmartScreen warning for the not yet code-signed installers, and how to check a download's SHA-256). The release notes on GitHub explain the warning too.
- Tests cover PDFs with JPEG 2000 and JBIG2 images, checking that they actually render.
- Detailed tests for the Convert and Security tools: every option's effect on the output file, AES-256 encryption details and permissions, and redaction leaks in text, file bytes, metadata, outlines, comments, form fields and attachments.
- "Files stay on this device" in the sidebar opens a new Privacy tab in About: how the files stay local, the site's actual `connect-src` policy (read from the server configuration at build time), and how to check it yourself offline or in DevTools. When the connection drops, the line says so and that tools you've used still work.
- After you save a result, a small note offers a GitHub star or a Ko-fi tip: at most once per browser session, and not again for a week once dismissed. The sidebar's GitHub link now reads "Star on GitHub".
- `vite preview` sends the same Cache-Control as nginx for `/assets/` and `/vendor/`, so tests see what browsers cache in production.
- The web app can be installed (Chrome, Edge): an "Install app" link appears in the sidebar when the browser offers it. Once installed, PDFs and images can be opened with it from the operating system, or shared to it from other apps. A small service worker receives shared files and hands them to the page; it caches nothing and sends nothing anywhere.

### Changed

- Editor: Highlight, Whiteout and Box stay active after drawing, so several areas can be marked in a row. Esc or V switches back to Select.

### Fixed
- Redact: a box could start too far right after narrow letters (such as "il"), leaving the start of an e-mail address or number readable. Boxes are now placed from measured character widths and never come out narrower than the text.
- Redact presets: phone numbers now include 9-digit Polish numbers; bank accounts include IBANs with letters (GB29 NWBK …) and lengths that aren't a multiple of 4; NIP also matches the 123-45-67-890 layout.
- PDF to Word keeps bold text and adds space between paragraphs.
- PDF to images no longer adds an extra pixel row at some resolutions.
- Protect and Unlock keep the document's producer and dates, like the other tools.
- Word to PDF: "Change file" also clears the old preview.
- PDF to text points scanned PDFs to the OCR tool.
- HEIC (iPhone) photos convert again in Images to PDF, HEIC to JPG and OCR. The old decoder needed `eval`, which the app's security policy blocks, so jobs hung on "Working…". It is replaced by heic-to's build without `eval` (LGPL-3.0, libheif inside).
- Redact: comments and form field values that contain the searched text or a selected pattern are now removed from the pages that aren't redacted too. Before, a secret in a comment on another page stayed in the file. The counter shows how many comments will be removed.

## [1.1.0] - 2026-11-03

### Added
- Open-source release under the GNU AGPL v3.
- "What's new" and "About" in the sidebar, with the running version and the full change history.
- Update notice: when a newer version is deployed, a banner offers to reload. The check only asks this server for `/version.json`; nothing is sent anywhere else.
- Links to the project website, source code and issue tracker.
- "Support" link to the project's Ko-fi page; GitHub Sponsors in the repository.
- Windows desktop app (Tauri 2) with NSIS and MSI installers, including offline variants with WebView2.
- The Windows app updates itself: when a new version is released, a banner offers "Install and restart". Updates are signed, and the app checks the signature before installing.
- Windows installers are published on GitHub Releases, built by a release workflow.
- Licences of the Rust libraries in the Windows app are listed in THIRD-PARTY-NOTICES.

### Changed
- Renamed to Nyxiontech PDF Tools, with a new logo and colours.
- The QR code generator suggests nyxiontech.com as the sample link.
- Documents, snippets and settings saved by earlier versions are moved to the new storage names on first start.
- Sidebar links, version and "What's new" are now reachable on phones.
- Default snippets are "Approved for payment" and "Copy – original on file" instead of a Poland-specific stamp. Snippets you saved yourself are kept.
- Updated pdf.js to 6, which adds decoding of JPEG 2000 and JBIG2 images and ICC colour profiles (loaded from this server, like the other WebAssembly files).
- Updated React to 19.3, Vite to 8, TypeScript to 7 and lucide icons to 1.x; the Docker image now uses Node 26 and nginx 1.31.

### Removed
- Internal deployment pipeline (Jenkinsfile). See the README for self-hosting with Docker.

## [1.0.0] - 2026-11-02

### Added
- PDF editor: text in 21 embedded fonts, whiteout, highlight, boxes, images, signatures, snippets, page organisation, undo/redo.
- Dashboard tools: merge, split, organise, rotate, compress, OCR, images to PDF, PDF to images/text/Word, Word to PDF, protect, unlock, redact, compare, form filling, page numbers, watermark, metadata, image compression, background removal, HEIC to JPG and a QR code generator.
- Everything runs in the browser; files are never uploaded.
