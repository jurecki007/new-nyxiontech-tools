import { useEffect, useState } from 'react';
import { Copy, FileText, FolderOpen, Trash2, Upload } from 'lucide-react';
import { Thumb } from './Thumb';
import { pickFiles } from '../lib/files';
import { linkTo } from '../lib/route';
import { loadFonts } from '../lib/fonts';
import { usePageInfos, pageKey } from '../lib/hooks';
import { clearProjects, deleteProject, listProjects, saveProject } from '../lib/storage';
import { UTILITIES, UTILITY_GROUPS, type UtilityContext } from '../utilities';
import type { Project } from '../types';
import { storedFrom, storedIn, useLang, useT, type Messages } from '../i18n';

function timeAgo(time: number, t: Messages, lang: string) {
  const s = (Date.now() - time) / 1000;
  if (s < 60) return t.home.justNow;
  if (s < 3600) return t.home.minutesAgo(Math.floor(s / 60));
  if (s < 86400) return t.home.hoursAgo(Math.floor(s / 3600));
  return new Date(time).toLocaleDateString(lang);
}

export function Home({ ctx, onOpenProject }: { ctx: UtilityContext; onOpenProject: (p: Project) => void }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const t = useT();

  const refresh = () => void listProjects().then(setProjects, () => setProjects([]));
  useEffect(refresh, []);

  async function duplicate(p: Project) {
    const copy: Project = { ...p, id: crypto.randomUUID(), name: t.home.copyName(p.name), createdAt: Date.now(), updatedAt: Date.now() };
    await saveProject(copy);
    refresh();
  }

  return (
    <div className="home">
      <header className="home-header">
        <div>
          <h1>{t.home.title}</h1>
          <p className="muted">{t.home.subtitle(storedIn(t))}</p>
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
          <h2>{t.home.openTitle}</h2>
          <p className="muted">{t.home.openHint}</p>
        </div>
      </section>

      <section className="tool-grid-section">
        <h3>{t.home.tools}</h3>
        {UTILITY_GROUPS.map((g) => {
          const items = UTILITIES.filter((u) => u.group === g.id);
          if (!items.length) return null;
          return (
            <div key={g.id} className="tool-grid-group">
              <div className="tool-grid-label">{t.groups[g.id]}</div>
              <div className="tool-grid">
                {items.map((u) => (
                  <a key={u.id} className="tool-card" {...linkTo(u.id)}>
                    <span className="tool-card-icon">
                      <u.icon size={20} />
                    </span>
                    <span>
                      <b>{t.tools[u.id].label}</b>
                      <span className="muted">{t.tools[u.id].description}</span>
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
            {t.home.recent} {projects && projects.length > 0 && <span className="count">{projects.length}</span>}
          </h3>
          {projects && projects.length > 0 && (
            <button
              className="btn ghost danger"
              onClick={() => {
                if (confirm(t.home.confirmClearAll(projects.length, storedFrom(t)))) void clearProjects().then(refresh);
              }}
            >
              <Trash2 size={15} /> {t.home.clearAll}
            </button>
          )}
        </div>
        {projects === null ? (
          <p className="muted">{t.common.loading}</p>
        ) : projects.length === 0 ? (
          <p className="muted">{t.home.empty}</p>
        ) : (
          <div className="cards">
            {projects.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                onOpen={() => onOpenProject(p)}
                onDuplicate={() => void duplicate(p)}
                onDelete={() => {
                  if (confirm(t.home.confirmDelete(p.name, storedFrom(t)))) void deleteProject(p.id).then(refresh);
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
  const t = useT();
  const lang = useLang();

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
          {t.common.pages(p.doc.pages.length)} · {t.home.edits(edits)} · {timeAgo(p.updatedAt, t, lang)}
        </span>
      </div>
      <div className="card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn" title={t.home.open} onClick={onOpen}>
          <FolderOpen size={16} />
        </button>
        <button className="icon-btn" title={t.home.duplicate} onClick={onDuplicate}>
          <Copy size={16} />
        </button>
        <button className="icon-btn danger" title={t.home.delete} onClick={onDelete}>
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
