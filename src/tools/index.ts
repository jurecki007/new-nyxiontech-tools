// The tool registry. To add a tool, create a module next to these that exports a
// `ModeTool` (acts on pointer input on a page) or an `ActionTool` (runs once when
// picked), and list it here. The sidebar, shortcuts and settings pick it up.
import { imageTool } from './image';
import { selectTool } from './select';
import { boxTool, highlightTool, whiteoutTool } from './shapes';
import { signatureTool } from './signature';
import { textTool } from './text';
import type { ModeTool, ToolDef } from './types';

export const TOOLS: ToolDef[] = [selectTool, textTool, whiteoutTool, highlightTool, boxTool, imageTool, signatureTool];

export const DEFAULT_TOOL = selectTool.id;

export function getModeTool(id: string): ModeTool {
  const tool = TOOLS.find((t) => t.id === id);
  return tool?.kind === 'mode' ? tool : selectTool;
}

export { TOOL_GROUPS } from './types';
export type { ActionTool, EditorToolContext, ModeTool, ToolDef } from './types';
