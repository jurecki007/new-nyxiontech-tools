# Contributing to Nyxiontech PDF Tools

Thanks for helping! Bug reports, fixes, new tools, tests and documentation are all welcome.

## Ground rules

- **Files never leave the browser.** No feature may upload documents, call third-party APIs or load scripts from a CDN. The Content-Security-Policy in `nginx/security-headers.conf` enforces this, and the tests run under it.
- Keep changes focused: one fix or feature per pull request.
- For a larger feature, open an issue first so we can agree on the approach.
- Never attach real or confidential documents to issues or tests. Generate test PDFs in `tests/global-setup.ts`.

## Development

```bash
npm install
npm run dev          # http://localhost:5180
npm run typecheck
npm run test:e2e     # Playwright, against the production build
```

The README explains the architecture and how to add a dashboard tool or an editor tool.

## Pull requests

1. Fork the repository and create a branch from `master`.
2. Make your change and add or update an end-to-end test in `tests/e2e/` when behaviour changes.
3. Add a line to `CHANGELOG.md` (under an `## [Unreleased]` heading at the top) for anything users will notice.
4. Make sure `npm run typecheck` and `npm run test:e2e` pass.
5. Open the pull request and describe what changed and why.

### Dependencies

Only add a dependency when it is clearly worth it, and check its licence: it must be compatible with the AGPL-3.0 (MIT, BSD, ISC, Apache-2.0, MPL-2.0, LGPL and OFL are fine). Pin exact versions in `package.json`. If the package ships in the app, regenerate the notices:

```bash
npx generate-license-file --input package.json --output notices.txt --overwrite
```

Then update Part 1 of `public/THIRD-PARTY-NOTICES.txt` with it.

## Licence of contributions

By submitting a contribution, you agree that it is licensed under the project's licence, the [GNU AGPL v3.0 or later](LICENSE) (inbound = outbound), and that you have the right to submit it.
