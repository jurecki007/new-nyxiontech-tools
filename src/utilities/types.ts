import type { FC } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { ToolId } from './routes';

export type UtilityGroup = 'organize' | 'edit' | 'optimize' | 'convert' | 'security' | 'review' | 'images' | 'other';

export const UTILITY_GROUPS: { id: UtilityGroup; label: string }[] = [
  { id: 'edit', label: 'Edit & sign' },
  { id: 'organize', label: 'Organize' },
  { id: 'optimize', label: 'Optimize' },
  { id: 'convert', label: 'Convert' },
  { id: 'security', label: 'Security' },
  { id: 'review', label: 'Review' },
  { id: 'images', label: 'Images' },
  { id: 'other', label: 'Other' },
];

/** What a dashboard tool can ask of the app shell. */
export interface UtilityContext {
  /** Opens files (merged) in the editor, optionally with an editor tool picked. */
  openInEditor: (files: File[], tool?: string) => void;
}

/** A stand-alone tool with its own page in the dashboard (merge, compress, QR, ...). */
export interface Utility {
  /** Also picks its public URL: see TOOL_SLUGS in routes.ts. */
  id: ToolId;
  label: string;
  /** One sentence, shown on the tool page and the dashboard card. */
  description: string;
  icon: LucideIcon;
  group: UtilityGroup;
  Component: FC<{ ctx: UtilityContext }>;
}
