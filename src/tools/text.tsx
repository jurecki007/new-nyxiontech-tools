import { Type } from 'lucide-react';
import { TextStyleFields } from '../components/fields';
import { ops, uid } from '../lib/doc';
import { DEFAULT_FONT } from '../lib/fonts';
import type { TextAnnot, TextStyle } from '../types';
import { defineModeTool } from './types';

export const DEFAULT_TEXT_STYLE: TextStyle = {
  font: DEFAULT_FONT,
  size: 11,
  color: '#000000',
  bold: false,
  italic: false,
};

/** Click to place a text element, then type in the properties panel. */
export const textTool = defineModeTool<TextStyle>({
  kind: 'mode',
  id: 'text',
  label: 'Text',
  icon: Type,
  group: 'annotate',
  shortcut: 'T',
  cursor: 'text',
  hint: 'Click where the text should start. Double-click text to edit it.',
  // Clicking a whiteout or highlight should still place text on top of it.
  selects: (a) => a.kind === 'text',
  defaults: DEFAULT_TEXT_STYLE,
  Options: ({ value, onChange }) => <TextStyleFields value={value} onChange={(patch) => onChange(patch)} />,
  begin: (ctx, p) => {
    const style = { ...DEFAULT_TEXT_STYLE, ...ctx.settings };
    const annot: TextAnnot = {
      kind: 'text',
      id: uid(),
      pageId: ctx.page.id,
      x: p.x,
      // Put the click roughly at the middle of the first line.
      y: p.y + style.size * 0.35,
      text: 'Text',
      opacity: 1,
      ...style,
    };
    ctx.dispatch({ type: 'apply', fn: ops.addAnnot(annot), history: true });
    ctx.select(annot.id);
    ctx.setTool('select');
    ctx.editText();
  },
});
