# Changelog

All notable changes to this project are listed here. The app shows this file under "What's new".
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed
- Sidebar links, version and "What's new" are now reachable on phones.
- Default snippets are "Approved for payment" and "Copy – original on file" instead of a Poland-specific stamp. Snippets you saved yourself are kept.
- Updated pdf.js to 6, which adds decoding of JPEG 2000 and JBIG2 images and ICC colour profiles (loaded from this server, like the other WebAssembly files).
- Updated React to 19.3, Vite to 8, TypeScript to 7 and lucide icons to 1.x; the Docker image now uses Node 26 and nginx 1.31.

### Added
- Licences of the Rust libraries in the Windows app are listed in THIRD-PARTY-NOTICES.

## [1.1.0] - 2026-11-03

### Added
- Open-source release under the GNU AGPL v3.
- "What's new" and "About" in the sidebar, with the running version and the full change history.
- Update notice: when a newer version is deployed, a banner offers to reload. The check only asks this server for `/version.json`; nothing is sent anywhere else.
- Links to the project website, source code and issue tracker.
- "Support" link to the project's Ko-fi page; GitHub Sponsors in the repository.
- Windows desktop app (Tauri 2) with NSIS and MSI installers, including offline variants with WebView2.

### Changed
- Renamed to Nyxiontech PDF Tools, with a new logo and colours.
- The QR code generator suggests nyxiontech.com as the sample link.
- Documents, snippets and settings saved by earlier versions are moved to the new storage names on first start.

### Removed
- Internal deployment pipeline (Jenkinsfile). See the README for self-hosting with Docker.

## [1.0.0] - 2026-11-02

### Added
- PDF editor: text in 21 embedded fonts, whiteout, highlight, boxes, images, signatures, snippets, page organisation, undo/redo.
- Dashboard tools: merge, split, organise, rotate, compress, OCR, images to PDF, PDF to images/text/Word, Word to PDF, protect, unlock, redact, compare, form filling, page numbers, watermark, metadata, image compression, background removal, HEIC to JPG and a QR code generator.
- Everything runs in the browser; files are never uploaded.
