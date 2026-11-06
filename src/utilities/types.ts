import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ToolId } from './routes';

export type UtilityGroup = 'organize' | 'edit' | 'optimize' | 'convert' | 'security' | 'review' | 'images' | 'other';

/** Sidebar and dashboard sections, in order. Their names are in the dictionaries (src/i18n, `groups`). */
export const UTILITY_GROUPS: { id: UtilityGroup }[] = [
  { id: 'edit' },
  { id: 'organize' },
  { id: 'optimize' },
  { id: 'convert' },
  { id: 'security' },
  { id: 'review' },
  { id: 'images' },
  { id: 'other' },
];

/** What a dashboard tool can ask of the app shell. */
export interface UtilityContext {
  /** Opens files (merged) in the editor, optionally with an editor tool picked. */
  openInEditor: (files: File[], tool?: string) => void;
}

/** A stand-alone tool with its own page in the dashboard (merge, compress, QR, ...). */
export interface Utility {
  /**
   * Also picks its public URL (TOOL_SLUGS in routes.ts) and its name and one-sentence
   * description in every language (`tools` in src/i18n/en.ts).
   */
  id: ToolId;
  icon: LucideIcon;
  group: UtilityGroup;
  Component: FC<{ ctx: UtilityContext }>;
}
