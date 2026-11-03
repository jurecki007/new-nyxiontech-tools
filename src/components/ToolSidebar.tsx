import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { TOOL_GROUPS, TOOLS, type ModeTool, type ToolDef } from '../tools';

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
  return (
    <aside className={`tool-sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="tool-sidebar-head">
        {!collapsed && <span className="panel-title">Tools</span>}
        <button className="icon-btn" title={collapsed ? 'Expand tools' : 'Collapse tools'} onClick={onToggleCollapsed}>
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <nav className="tool-groups">
        {TOOL_GROUPS.map((group) => {
          const tools = TOOLS.filter((t) => t.group === group.id);
          if (!tools.length) return null;
          return (
            <div key={group.id} className="tool-group-section">
              {!collapsed && <div className="tool-group-label">{group.label}</div>}
              {tools.map((t) => (
                <button
                  key={t.id}
                  className={`tool-item${t.id === activeTool.id ? ' on' : ''}`}
                  title={collapsed ? `${t.label}${t.shortcut ? ` (${t.shortcut})` : ''}` : undefined}
                  onClick={() => onPick(t)}
                >
                  <t.icon size={18} />
                  {!collapsed && <span className="tool-item-label">{t.label}</span>}
                  {!collapsed && t.shortcut && <kbd>{t.shortcut}</kbd>}
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      {!collapsed && (Options || activeTool.hint) && (
        <section className="tool-options">
          <div className="panel-title">{activeTool.label} options</div>
          {Options && <Options value={settings} onChange={onSettingsChange} />}
          {activeTool.hint && <p className="hint">{activeTool.hint}</p>}
        </section>
      )}
    </aside>
  );
}
