import { MousePointer2 } from 'lucide-react';
import { defineModeTool } from './types';

/** Selects, moves and resizes elements. Clicking empty space clears the selection. */
export const selectTool = defineModeTool({
  kind: 'mode',
  id: 'select',
  label: 'Select',
  icon: MousePointer2,
  group: 'general',
  shortcut: 'V',
  hint: 'Drag to move, use the corner handle to resize. Arrow keys nudge.',
  begin: (ctx) => ctx.select(null),
});
