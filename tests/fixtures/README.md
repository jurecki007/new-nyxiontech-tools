# Test fixtures

Sample files checked in as-is (generated fixtures live in `tests/.fixtures`, see `tests/global-setup.ts`).

| File | Used by | What it contains | Source |
| --- | --- | --- | --- |
| `bug_jpx.pdf` | `e2e/image-codecs.spec.ts` | One page with a 128×64 greyscale JPEG 2000 image (`/JPXDecode`) | [mozilla/pdf.js `test/pdfs/bug_jpx.pdf`](https://github.com/mozilla/pdf.js/blob/master/test/pdfs/bug_jpx.pdf) |
| `jbig2_symbol_offset.pdf` | `e2e/image-codecs.spec.ts` | One page with a JBIG2 image (`/JBIG2Decode`, symbol dictionary and text region) reading "JBIG2 TEXT" | [mozilla/pdf.js `test/pdfs/jbig2_symbol_offset.pdf`](https://github.com/mozilla/pdf.js/blob/master/test/pdfs/jbig2_symbol_offset.pdf) |
| `sample.heic` | `e2e/convert.spec.ts` | A 320×160 HEIC image (left half red, right half blue), 565 bytes | Made for this project with pillow-heif 1.3: `Image.new("RGB", (320, 160), (220, 30, 30))`, right half filled `(30, 60, 220)`, saved with `quality=60` |

The two PDFs are unmodified synthetic test files from the PDF.js test suite,
Copyright Mozilla Foundation and contributors, licensed under the
[Apache License 2.0](https://github.com/mozilla/pdf.js/blob/master/LICENSE).
