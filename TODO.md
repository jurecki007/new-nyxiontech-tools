# TODO

Where the project stands and what is left. Last updated 2026-11-04.

## Status

- **v1.1.0 is released**: web app, Windows installers (`.exe`, `.msi`) and signed update files on [GitHub Releases](https://github.com/jurecki007/nyxiontech-tools/releases/tag/v1.1.0).
- **The repository is public** (since 2026-11-04): anyone can download the installers, and installed apps fetch updates from GitHub Releases.
- **CI is green on `master`**: web tests on Linux, desktop build on Windows. Desktop smoke tests run for information only, see below.
- **Donations**: Ko-fi live at `ko-fi.com/nyxiontech` (Stripe: card, Apple/Google Pay, Przelewy24, BLIK). GitHub Sponsors for `jurecki007` is under review.
- **Update signing key**: stored in the repo secret `TAURI_SIGNING_PRIVATE_KEY`, with a backup on Google Drive. Never commit it; losing it means installed apps can't update anymore.

## Next: go public

- [x] Make the repository public.
- [x] Turn on private vulnerability reporting, Dependabot alerts, secret scanning and push protection.
- [x] Protect `master`: PRs need green `build-and-test` and `desktop`; no force pushes or deletion. The owner can still push directly. For a history rewrite, turn off the force-push block in Settings → Branches first.
- [x] Check the public page: licence detected as AGPL-3.0, release and updater endpoint reachable without login.
- [ ] Install v1.1.0 from the release on a clean machine, and check the SmartScreen warning and that the app starts.

## Code signing (free, through SignPath Foundation)

Goal: no more "unknown publisher" warning. The publisher shown will be "SignPath Foundation". Requirements: <https://signpath.org/terms>.

Code changes: done and merged (PR #18): the update check setting and "Check now" (About dialog), `PRIVACY.md`, the privacy policy on the installers' licence page, the README section "Code signing policy" and links in the release notes.

Steps for the owner:
- [x] Two-factor sign-in on GitHub (`jurecki007`, GitHub Mobile). Also set it up on the SignPath account once it exists.
- [x] Applied at <https://signpath.org/apply> on 2026-11-04 (category Productivity, build system GitHub Actions). **Waiting for SignPath's reply**; they may decline because the project is new.
- [ ] SignPath asks for "installation options to disable" network features. The update check can be turned off in the app (About) but not yet in the installer. If SignPath asks for it, add an installer checkbox (NSIS hook) that writes the setting.
- [ ] After approval: add the SignPath signing step to `.github/workflows/release.yml` and store the credentials as repo secrets. Each release is then approved manually in SignPath before signing.

## Release process improvements

- [x] The draft release's `latest.json` gets API asset URLs that installed apps can't download. Fixed by `scripts/fix-latest-json.mjs`, run locally before publishing (README → Releasing, step 5). Local on purpose: no extra GitHub Actions minutes.
- [ ] Desktop smoke tests don't work on GitHub's Windows runners: the app starts, but WebView2 never opens the remote-debugging port. They run with `continue-on-error`. Until this is fixed, run `npm run test:desktop` locally before tagging (see README → Releasing).

## Later / optional

- [x] Public web instance at https://tools.nyxiontech.com (Cloudflare Pages, auto-deploys from `master`), with SEO / AI-search metadata.
- [ ] Link from nyxiontech.com: portfolio case study ready in jurecki007/nyxiontech-ignition PR #5; merge to publish.
- [x] Google Search Console: domain property `nyxiontech.com` (auto-verified via Cloudflare DNS); tools sitemap read successfully (2 pages).
- [ ] Bing Webmaster Tools: nyxiontech.com imported from Google on 2026-11-04, still processing (up to 48 h). Then check that `https://tools.nyxiontech.com/sitemap.xml` is listed under Sitemaps, and submit it if not.
- [x] Renamed the repo to `nyxiontech-tools` (2026-11-04). GitHub redirects the old URLs, so v1.1.0 still finds updates at its old address.
- [x] Ko-fi: profile picture, description, category, EUR, PayPal and Stripe connected.
- [x] PDFs with JPEG 2000 / JBIG2 images render correctly; covered by `tests/e2e/image-codecs.spec.ts` (samples from the pdf.js test corpus).
