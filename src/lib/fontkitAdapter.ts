import * as fontkit from 'fontkit';
import type { PDFDocument } from 'pdf-lib';

type Fontkit = Parameters<PDFDocument['registerFontkit']>[0];

/**
 * pdf-lib was written against fontkit 1.x. Its maintained fork (@pdf-lib/fontkit)
 * produces broken subsets when several custom fonts share one PDF, and fails on
 * some modern TTFs, so we use fontkit 2 instead. The only API difference pdf-lib
 * touches is `subset.encodeStream()`, which fontkit 2 replaced with `encode()`.
 */
export const fontkitAdapter = {
  create(data: Uint8Array) {
    const font = fontkit.create(data);
    const createSubset = font.createSubset.bind(font);
    font.createSubset = () => {
      const subset = createSubset();
      // Mimics the old stream: pdf-lib attaches data/end/error handlers, then waits.
      (subset as unknown as { encodeStream: () => unknown }).encodeStream = () => {
        const handlers: Record<string, (arg?: unknown) => void> = {};
        const emitter = {
          on(event: string, fn: (arg?: unknown) => void) {
            handlers[event] = fn;
            if (event === 'error') queueMicrotask(run);
            return emitter;
          },
        };
        const run = () => {
          try {
            handlers.data?.(subset.encode());
            handlers.end?.();
          } catch (e) {
            handlers.error?.(e);
          }
        };
        return emitter;
      };
      return subset;
    };
    return font;
  },
} as unknown as Fontkit;
