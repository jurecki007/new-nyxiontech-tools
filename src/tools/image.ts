import { ImagePlus } from 'lucide-react';
import { uid } from '../lib/doc';
import { pickFiles, readImage } from '../lib/files';
import type { ActionTool } from './types';
import { tr } from '../i18n';

/** Opens a file dialog and drops the image in the middle of the current page. */
export const imageTool: ActionTool = {
  kind: 'action',
  id: 'image',
  icon: ImagePlus,
  group: 'insert',
  shortcut: 'I',
  run: async (ctx) => {
    const { page, size } = ctx;
    if (!page || !size) return;
    const [file] = await pickFiles('image/png,image/jpeg,image/webp,image/gif,image/svg+xml', false);
    if (!file) return;
    try {
      const img = await readImage(file);
      // 96 dpi pixels to points, capped to a sensible starting size.
      const scale = Math.min(0.75, 200 / img.w, 200 / img.h);
      const w = img.w * scale;
      const h = img.h * scale;
      ctx.add({ kind: 'image', id: uid(), pageId: page.id, x: (size.w - w) / 2, y: (size.h - h) / 2, w, h, src: img.src, opacity: 1 });
      ctx.setTool('select');
    } catch {
      ctx.reportError(tr().editor.couldNotReadImage(file.name));
    }
  },
};
