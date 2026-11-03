import { useEffect, useState } from 'react';
import { Copy, FileText, FolderOpen, Trash2, Upload } from 'lucide-react';
import { Thumb } from './Thumb';
import { pickFiles } from '../lib/files';
import { loadFonts } from '../lib/fonts';
import { usePageInfos, pageKey } from '../lib/hooks';
import { clearProjects, deleteProject, listProjects, saveProject } from '../lib/storage';
import { UTILITIES, UTILITY_GROUPS, type UtilityContext } from '../utilities';
import type { Project } from '../types';

function timeAgo(t: number) {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
}

export function Home({ ctx, onOpenProject }: { ctx: UtilityContext; onOpenProject: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const refresh = () => void listProjects().then(setProjects, () => setProjects([]));
  useEffect(refresh, []);

  async function duplicate(p: Project) {
    const copy: Project = { ...p, id: crypto.randomUUID(), name: `${p.name} (copy)`, createdAt: Date.now(), updatedAt: Date.now() };
    await saveProject(copy);
    refresh();
  }

  return (
    <div className="home">
      <header className="home-header">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">Everything runs in this browser: no uploads, no accounts, no limits.</p>
        </div>
      </header>

      <section
        className={`dropzone${dragOver ? ' over' : ''}`}
        onClick={() => void pickFiles('application/pdf,.pdf', true).then((f) => (f.length ? ctx.openInEditor(f) : undefined))}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          ctx.openInEditor(Array.from(e.dataTransfer.files));
        }}
      >
        <Upload size={30} />
        <div>
          <h2>Open PDF in the editor</h2>
          <p className="muted">Drop files here or click to choose. Several files are merged into one document.</p>
        </div>
      </section>

      <section className="tool-grid-section">
        <h3>Tools</h3>
        {UTILITY_GROUPS.map((g) => {
          const items = UTILITIES.filter((u) => u.group === g.id);
          if (!items.length) return null;
          return (
            <div key={g.id} className="tool-grid-group">
              <div className="tool-grid-label">{g.label}</div>
              <div className="tool-grid">
                {items.map((u) => (
                  <a key={u.id} className="tool-card" href={`#/tool/${u.id}`}>
                    <span className="tool-card-icon">
                      <u.icon size={20} />
                    </span>
                    <span>
                      <b>{u.label}</b>
                      <span className="muted">{u.description}</span>
                    </span>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      <section className="recent">
        <div className="recent-head">
          <h3>
            Recent documents {projects && projects.length > 0 && <span className="count">{projects.length}</span>}
          </h3>
          {projects && projects.length > 0 && (
            <button
              className="btn ghost danger"
              onClick={() => {
                if (confirm(`Delete all ${projects.length} documents from this browser? This cannot be undone.`)) void clearProjects().then(refresh);
              }}
            >
              <Trash2 size={15} /> Clear all documents
            </button>
          )}
        </div>
        {projects === null ? (
          <p className="muted">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="muted">Nothing here yet. Open a PDF to start; your work is saved automatically.</p>
        ) : (
          <div className="cards">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => onOpenProject(p)}
                onDuplicate={() => void duplicate(p)}
                onDelete={() => {
                  if (confirm(`Delete “${p.name}” from this browser?`)) void deleteProject(p.id).then(refresh);
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectCard({
  project: p,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  project: Project;
  onOpen: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const first = p.doc.pages[0];
  const infos = usePageInfos(p.sources, first ? [first] : []);
  const info = first && infos[pageKey(first)];
  const source = first && p.sources.find((s) => s.id === first.sourceId);
  const edits = p.doc.annots.length;

  // Register the fonts used by the thumbnail's text; the browser repaints once they load.
  useEffect(() => {
    void loadFonts(p.doc.annots.flatMap((a) => (a.kind === 'text' ? [a.font] : [])));
  }, [p.doc.annots]);

  return (
    <div className="card" onClick={onOpen}>
      <div className="card-thumb">
        {first && info && source ? (
          <Thumb source={source} page={first} info={info} width={150} annots={p.doc.annots.filter((a) => a.pageId === first.id)} />
        ) : (
          <FileText size={40} />
        )}
      </div>
      <div className="card-body">
        <b title={p.name}>{p.name}</b>
        <span className="muted">
          {p.doc.pages.length} {p.doc.pages.length === 1 ? 'page' : 'pages'} · {edits} {edits === 1 ? 'edit' : 'edits'} · {timeAgo(p.updatedAt)}
        </span>
      </div>
      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" title="Open" onClick={onOpen}>
          <FolderOpen size={16} />
        </button>
        <button className="icon-btn" title="Duplicate" onClick={onDuplicate}>
          <Copy size={16} />
        </button>
        <button className="icon-btn danger" title="Delete" onClick={onDelete}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
