# Changelog

All notable changes to this project are listed here. The app shows this file under "What's new".
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Windows app: "Check for updates automatically" under About (on by default). When it's off, the app never contacts GitHub on its own; "Check now" checks on request.
- Privacy policy (PRIVACY.md), also shown on the installer's licence page.
- Tests cover PDFs with JPEG 2000 and JBIG2 images, checking that they actually render.
- Detailed tests for the Convert and Security tools: every option's effect on the output file, AES-256 encryption details and permissions, and redaction leaks in text, file bytes, metadata, outlines, comments, form fields and attachments.

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
