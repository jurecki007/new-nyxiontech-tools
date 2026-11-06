# Translating Nyxiontech PDF Tools

The interface is available in English and Polish. This page explains where the strings live, how the app picks a language, and how to add a new one.

## Where the strings are

| File | What it holds |
| --- | --- |
| `src/i18n/en.ts` | The reference dictionary: every string the interface shows, grouped by screen and tool. Its shape defines the `Messages` type. |
| `src/i18n/pl.ts` | The Polish dictionary, typed as `Messages`. |
| `src/i18n/index.ts` | The list of languages (`MESSAGES`), how each one names itself in the switch (`LANG_NAMES`), and how the language is chosen. |
| `src/i18n/plural.ts` | Plural forms for languages with more than two (Polish: 1 plik, 2 pliki, 5 plików). |

Keys are grouped by where they appear: `shell` (sidebar), `home` (dashboard), `tools` (the name and description of every dashboard tool), one group per tool (`merge`, `split`, `redact`, ...), `editor`, `about`, `privacy`, `errors` and so on.

A value is either a string or a function, when it contains a number or a name:

```ts
// en.ts
pages: (n: number) => count(n, 'page', 'pages'),
outsidePages: (part: string, count: number) => `"${part}" is outside pages 1–${count}.`,

// pl.ts
pages: (n) => count(n, 'strona', 'strony', 'stron'),
outsidePages: (part, count) => `„${part}” wykracza poza strony 1–${count}.`,
```

TypeScript checks every dictionary against `en.ts`: a missing key, an extra key or a function with the wrong parameters fails `npm run typecheck` and the build.

## How the language is chosen

- **Website:** the address decides. Pages under `/pl/` (`/pl/`, `/pl/polacz-pdf`, ...) are Polish, all others English, so a shared link always opens in the same language. The browser's language is not used. The EN / PL switch at the bottom of the sidebar is a link to the same page in the other language (the tool's other address from `TOOL_SLUGS` in `src/utilities/routes.ts`).
- **Desktop app:** the window always loads the same file, so it uses the first of the system's preferred languages that the app has (`navigator.languages`), else English. Picking a language with the switch overrides that and is remembered.

Components read the strings with `const t = useT()` and re-render when the language changes. Code outside components (error messages, defaults) uses `tr()`.

## Adding a language

Example: German, `de`.

1. Copy `src/i18n/pl.ts` to `src/i18n/de.ts`, rename the export to `de` and translate every value. Keep the keys and the function parameters. Use `plural()` from `./plural` if the language has more than two plural forms; otherwise write the forms inline as `en.ts` does.
2. Register it in `src/i18n/index.ts`: import it, add it to `MESSAGES`, and add its name to `LANG_NAMES` (`de: { short: 'DE', name: 'Deutsch' }`).
3. Run `npm run typecheck`. It lists every key that is missing or has the wrong form.

That is enough for the desktop app: it shows the language on systems set to it, and the switch lists it.

On the website a language also needs its own addresses, because the address picks the language. That is a bigger change, best discussed in an issue first:

- `src/utilities/routes.ts`: add the code to `Lang`, an address for every tool to `TOOL_SLUGS` (a `/de/` prefix, like `/pl/`), and handle the prefix in `homePath`, `toolPath` and `parsePath`.
- `src/seo/content.ts`: the search-page copy for every tool (title, description, steps, questions) and the shared texts in `UI`.
- `src/seo/pages.ts` and `vite.config.ts`: the page generator, hreflang links, home page, 404 page and sitemap are currently written for English and Polish.

Until then the switch on the website shows only the languages that have addresses.

## Style

- Translate what the code does, not word for word. Look at what a string is next to (button, hint, error) in the running app.
- Keep the terms consistent. For Polish, follow the search pages in `src/seo/content.ts` (for example „Anonimizuj PDF”, „Połącz PDF”, „korektor”).
- The search pages quote some button labels, for example: Kliknij „Anonimizuj i zapisz”. If you change such a label, change the quote too; `tests/e2e/i18n.spec.ts` checks that every quoted Polish label exists.
- No em dashes, no `--`, no ellipsis character (U+2026) and no arrows in sentences. Use a colon, a semicolon or a new sentence instead. Ranges such as `70–85%` are fine.
- Use the language's own quotation marks (in Polish, „ to open and ” to close).
- Keep product and format names as they are: PDF, JPG, PNG, WebP, HEIC, OCR, Wi-Fi, AES-256, GitHub, Ko-fi, Tesseract.
- Use the informal or formal address consistently; Polish uses the informal form (Ty, Twoje).

What stays in English on purpose:

- `CHANGELOG.md` (the "What's new" tab says so in Polish) and the legal texts (`LICENSE`, `PRIVACY.md`, third-party notices).
- The names of downloaded files (`invoice_merged.pdf`, `_redacted.pdf`), so guides and scripts can rely on them.
- The ready-made watermark texts and page number formats, which are offered in both languages anyway (KOPIA, COPY, „Strona 3 z 12”, "Page 3 of 12").
- Text inside the user's documents, form field names and messages from the browser itself.

## Testing a translation

```bash
npm run typecheck              # every key present, every function with the right parameters
npm run dev                    # then open http://localhost:5180/pl/ (or /pl/polacz-pdf, ...)
npm run test:e2e               # the full suite, including tests/e2e/i18n.spec.ts
```

For a language without web addresses yet, the development server accepts `?lang=de` (for example `http://localhost:5180/merge-pdf?lang=de`); it lasts until the tab is closed, and `?lang=` turns it off. Production builds ignore it. In the desktop app (`npm run desktop:dev`), use the switch.

Check each screen at the narrow width too (about 390 px): longer words must not overflow buttons, the sidebar or the segmented controls. Add a test like the Polish ones in `tests/e2e/i18n.spec.ts`: one page in the new language, its button labels, and that the dictionary has the same keys as English.
