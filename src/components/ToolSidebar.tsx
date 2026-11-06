import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { TOOL_GROUPS, TOOLS, type ModeTool, type ToolDef } from '../tools';
import { useT } from '../i18n';

interface Props {
  activeTool: ModeTool;
  settings: unknown;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onPick: (tool: ToolDef) => void;
  onSettingsChange: (patch: object) => void;
}

/** Vertical tool palette, grouped, with the active tool's options underneath. */
export function ToolSidebar({ activeTool, settings, collapsed, onToggleCollapsed, onPick, onSettingsChange }: Props) {
  const Options = activeTool.Options;
  const t = useT();
  const active = t.editor.tools[activeTool.id];
  return (
    <aside className={`tool-sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="tool-sidebar-head">
        {!collapsed && <span className="panel-title">{t.editor.toolsTitle}</span>}
        <button className="icon-btn" title={collapsed ? t.editor.expandTools : t.editor.collapseTools} onClick={onToggleCollapsed}>
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <nav className="tool-groups">
        {TOOL_GROUPS.map((group) => {
          const tools = TOOLS.filter((t) => t.group === group.id);
          if (!tools.length) return null;
          return (
            <div key={group.id} className="tool-group-section">
              {!collapsed && <div className="tool-group-label">{t.editor.groups[group.id]}</div>}
              {tools.map((tool) => (
                <button
                  key={tool.id}
                  className={`tool-item${tool.id === activeTool.id ? ' on' : ''}`}
                  title={collapsed ? `${t.editor.tools[tool.id].label}${tool.shortcut ? ` (${tool.shortcut})` : ''}` : undefined}
                  onClick={() => onPick(tool)}
                >
                  <tool.icon size={18} />
                  {!collapsed && <span className="tool-item-label">{t.editor.tools[tool.id].label}</span>}
                  {!collapsed && tool.shortcut && <kbd>{tool.shortcut}</kbd>}
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      {!collapsed && (Options || active.hint) && (
        <section className="tool-options">
          <div className="panel-title">{t.editor.toolOptions(active.label)}</div>
          {Options && <Options value={settings} onChange={onSettingsChange} />}
          {active.hint && <p className="hint">{active.hint}</p>}
        </section>
      )}
    </aside>
  );
}
