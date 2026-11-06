import { MousePointer2 } from 'lucide-react';
import { defineModeTool } from './types';

/** Selects, moves and resizes elements. Clicking empty space clears the selection. */
export const selectTool = defineModeTool({
  kind: 'mode',
  id: 'select',
  icon: MousePointer2,
  group: 'general',
  shortcut: 'V',
  begin: (ctx) => ctx.select(null),
});
