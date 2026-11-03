import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Download, FilePlus2, Redo2, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { Inspector } from './Inspector';
import { PagesPanel } from './PagesPanel';
import { PageView } from './PageView';
import { SnippetsPanel } from './SnippetsPanel';
import { ToolSidebar } from './ToolSidebar';
import { canUndo, historyReducer, ops, uid, viewSize } from '../lib/doc';
import { downloadBytes, exportPdf } from '../lib/export';
import { pagesOf, pickFiles, readSources } from '../lib/files';
import { loadFonts } from '../lib/fonts';
import { pageKey, usePageInfos } from '../lib/hooks';
import { loadSnippets, loadUiPref, newSnippetId, saveProject, saveSnippets, saveUiPref } from '../lib/storage';
import { DEFAULT_TOOL, getModeTool, TOOLS, type EditorToolContext, type ToolDef } from '../tools';
import type { Annot, Doc, Project, Snippet, TextAnnot } from '../types';

const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

type ToolSettings = Record<string, object>;

export function Editor({ initial, initialTool, onClose }: { initial: Project; initialTool?: string; onClose: () => void }) {
  const [name, setName] = useState(initial.name);
  const [sources, setSources] = useState(initial.sources);
  const [history, dispatch] = useReducer(historyReducer, { doc: initial.doc, past: [], future: [] });
  const doc = history.doc;

  const [toolId, setToolId] = useState(DEFAULT_TOOL);
  const [toolSettings, setToolSettings] = useState<ToolSettings>(() => loadUiPref('tool-settings', {}));
  const [toolsCollapsed, setToolsCollapsed] = useState(() => loadUiPref('tools-collapsed', false));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(initial.doc.pages[0]?.id ?? null);
  const [zoom, setZoom] = useState(1.25);
  const [fontsVersion, setFontsVersion] = useState(0);
  const [focusToken, setFocusToken] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [snippets, setSnippets] = useState(loadSnippets);
  const [dialog, setDialog] = useState<((close: () => void) => ReactNode) | null>(null);
  const pendingTool = useRef(initialTool);
  const infos = usePageInfos(sources, doc.pages);

  const tool = getModeTool(toolId);
  const settingsFor = (id: string) => ({ ...getModeTool(id).defaults, ...toolSettings[id] });
  const activePage = doc.pages.find((p) => p.id === activeId) ?? doc.pages[0] ?? null;
  const activeInfo = activePage && infos[pageKey(activePage)];
  const activeSize = activePage && activeInfo ? viewSize(activeInfo, activePage) : null;
  const selected = doc.annots.find((a) => a.id === selectedId) ?? null;

  // ---- Fonts: load whatever is in use, then re-measure text -------------------
  const usedFonts = useMemo(() => {
    const ids = new Set<string>();
    for (const a of doc.annots) if (a.kind === 'text') ids.add(a.font);
    for (const s of snippets) ids.add(s.font);
    const textDefaults = { ...getModeTool('text').defaults, ...toolSettings.text } as { font?: string };
    if (textDefaults.font) ids.add(textDefaults.font);
    return [...ids].sort().join('|');
  }, [doc.annots, snippets, toolSettings]);

  useEffect(() => {
    let alive = true;
    void loadFonts(usedFonts.split('|').filter(Boolean)).then(() => alive && setFontsVersion((v) => v + 1));
    return () => {
      alive = false;
    };
  }, [usedFonts]);

  // ---- Autosave to IndexedDB --------------------------------------------------
  const snapshot = useCallback(
    (d: Doc): Project => ({ id: initial.id, name, createdAt: initial.createdAt, updatedAt: Date.now(), sources, doc: d }),
    [initial.id, initial.createdAt, name, sources],
  );
  const latest = useRef(snapshot(doc));
  latest.current = snapshot(doc);
  useEffect(() => {
    const t = setTimeout(() => void saveProject(latest.current), 400);
    return () => clearTimeout(t);
  }, [doc, name, sources]);

  const close = async () => {
    await saveProject(latest.current);
    onClose();
  };

  // ---- Tools -------------------------------------------------------------------
  const add = (annot: Annot) => {
    dispatch({ type: 'apply', fn: ops.addAnnot(annot), history: true });
    setSelectedId(annot.id);
    setActiveId(annot.pageId);
  };

  const toolContext: EditorToolContext = {
    page: activePage,
    size: activeSize,
    add,
    setTool: setToolId,
    reportError: setError,
    openDialog: (render) => setDialog(() => render),
  };

  const pickTool = (t: ToolDef) => {
    if (t.kind === 'mode') setToolId(t.id);
    else void t.run(toolContext);
  };

  // A tool requested by the dashboard (e.g. "Sign PDF") runs once the first page is ready.
  useEffect(() => {
    const id = pendingTool.current;
    if (!id || !activeSize) return;
    pendingTool.current = undefined;
    const t = TOOLS.find((t) => t.id === id);
    if (t) pickTool(t);
  });

  const changeToolSettings = (patch: object) => {
    const next = { ...toolSettings, [tool.id]: { ...toolSettings[tool.id], ...patch } };
    setToolSettings(next);
    saveUiPref('tool-settings', next);
  };

  const toggleTools = () => {
    setToolsCollapsed(!toolsCollapsed);
    saveUiPref('tools-collapsed', !toolsCollapsed);
  };

  // ---- Snippets ------------------------------------------------------------------
  const insertSnippet = (s: Snippet) => {
    if (!activePage || !activeSize) return;
    const { id: _id, ...style } = s;
    add({ kind: 'text', id: uid(), pageId: activePage.id, x: 40, y: activeSize.h / 2, opacity: 1, ...style });
  };

  const saveSnippet = (a: TextAnnot) => {
    const next = [...snippets, { id: newSnippetId(), text: a.text, font: a.font, size: a.size, color: a.color, bold: a.bold, italic: a.italic }];
    setSnippets(next);
    saveSnippets(next);
  };

  const removeSnippet = (id: string) => {
    const next = snippets.filter((s) => s.id !== id);
    setSnippets(next);
    saveSnippets(next);
  };

  // ---- Document -----------------------------------------------------------------
  const addPdf = async () => {
    const files = await pickFiles('application/pdf,.pdf', true);
    if (!files.length) return;
    setBusy('Adding pages…');
    try {
      const added = await readSources(files);
      const pages = await pagesOf(added);
      setSources((prev) => [...prev, ...added]);
      dispatch({ type: 'apply', fn: ops.insertPages(pages, activePage?.id ?? null), history: true });
      if (pages[0]) setActiveId(pages[0].id);
    } catch {
      setError('Could not read one of the selected PDFs.');
    } finally {
      setBusy(null);
    }
  };

  const download = async () => {
    if (!doc.pages.length) return;
    setBusy('Generating PDF…');
    try {
      const bytes = await exportPdf(sources, doc);
      downloadBytes(bytes, `${name.trim() || 'document'}.pdf`);
    } catch (e) {
      setError(`Export failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };

  const activatePage = (id: string) => {
    setActiveId(id);
    document.getElementById(`page-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const stepZoom = (dir: 1 | -1) => {
    const i = ZOOMS.findIndex((z) => z >= zoom - 0.001);
    setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? ZOOMS.length - 1 : i) + dir))]);
  };

  // ---- Keyboard shortcuts ---------------------------------------------------------
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, textarea, select, [contenteditable]')) return;
    if (dialog) {
      if (e.key === 'Escape') setDialog(null);
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    if (mod && key === 'z') dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
    else if (mod && key === 'y') dispatch({ type: 'redo' });
    else if (mod && key === 's') void download();
    else if (mod && key === 'd' && selected) add({ ...selected, id: uid(), x: selected.x + 10, y: selected.y + 10 });
    else if ((key === 'delete' || key === 'backspace') && selected) {
      dispatch({ type: 'apply', fn: ops.removeAnnot(selected.id), history: true });
      setSelectedId(null);
    } else if (key === 'escape') {
      setSelectedId(null);
      setToolId(DEFAULT_TOOL);
    } else if (key.startsWith('arrow') && selected) {
      const step = e.shiftKey ? 10 : 1;
      const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0;
      const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0;
      dispatch({ type: 'apply', fn: ops.updateAnnot(selected.id, { x: selected.x + dx, y: selected.y + dy }), history: true });
    } else if (!mod && !e.altKey) {
      const t = TOOLS.find((t) => t.shortcut?.toLowerCase() === key);
      if (!t) return;
      pickTool(t);
    } else return;
    e.preventDefault();
  };
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const annotsByPage = useMemo(() => {
    const map = new Map<string, Annot[]>();
    for (const a of doc.annots) map.set(a.pageId, [...(map.get(a.pageId) ?? []), a]);
    return map;
  }, [doc.annots]);

  return (
    <div className="editor">
      <header className="topbar">
        <button className="icon-btn" title="Back to dashboard" onClick={() => void close()}>
          <ArrowLeft size={18} />
        </button>
        <div className="brand small">
          NYXION<b>TECH</b>
          <i>.</i>
        </div>
        <input className="name-input" value={name} onChange={(e) => setName(e.target.value)} title="File name used for download" />

        <div className="tool-group">
          <button className="tool" title="Undo (Ctrl+Z)" disabled={!canUndo(history)} onClick={() => dispatch({ type: 'undo' })}>
            <Undo2 size={18} />
          </button>
          <button className="tool" title="Redo (Ctrl+Y)" disabled={!history.future.length} onClick={() => dispatch({ type: 'redo' })}>
            <Redo2 size={18} />
          </button>
        </div>

        <div className="tool-group">
          <button className="tool" title="Zoom out" onClick={() => stepZoom(-1)}>
            <ZoomOut size={18} />
          </button>
          <span className="zoom-label">{Math.round(zoom * 100)}%</span>
          <button className="tool" title="Zoom in" onClick={() => stepZoom(1)}>
            <ZoomIn size={18} />
          </button>
        </div>

        <span className="spacer" />
        <button className="btn ghost" onClick={() => void addPdf()}>
          <FilePlus2 size={16} /> Add PDF
        </button>
        <button className="btn primary" disabled={!doc.pages.length || !!busy} onClick={() => void download()}>
          <Download size={16} /> Download PDF
        </button>
      </header>

      {error && (
        <div className="banner error" onClick={() => setError(null)}>
          {error} <span className="muted">(click to dismiss)</span>
        </div>
      )}

      <div className="workspace">
        <ToolSidebar
          activeTool={tool}
          settings={settingsFor(tool.id)}
          collapsed={toolsCollapsed}
          onToggleCollapsed={toggleTools}
          onPick={pickTool}
          onSettingsChange={changeToolSettings}
        />

        <PagesPanel
          pages={doc.pages}
          sources={sources}
          infos={infos}
          annots={doc.annots}
          activeId={activePage?.id ?? null}
          dispatch={dispatch}
          onActivate={activatePage}
          onAddPdf={() => void addPdf()}
        />

        <main
          className="canvas-area"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setSelectedId(null);
          }}
        >
          {doc.pages.length === 0 && (
            <div className="empty">
              <p>This document has no pages.</p>
              <button className="btn primary" onClick={() => void addPdf()}>
                <FilePlus2 size={16} /> Add PDF pages
              </button>
            </div>
          )}
          {doc.pages.map((page, i) => {
            const info = infos[pageKey(page)];
            const source = sources.find((s) => s.id === page.sourceId)!;
            if (!info) return <div key={page.id} className="page loading">Loading page {i + 1}…</div>;
            return (
              <PageView
                key={page.id}
                page={page}
                number={i + 1}
                source={source}
                info={info}
                zoom={zoom}
                annots={annotsByPage.get(page.id) ?? []}
                selectedId={selectedId}
                tool={tool}
                toolSettings={settingsFor(tool.id)}
                active={page.id === activePage?.id}
                fontsVersion={fontsVersion}
                dispatch={dispatch}
                onActivate={() => setActiveId(page.id)}
                onSelect={setSelectedId}
                onEditText={() => setFocusToken((n) => n + 1)}
                setTool={setToolId}
              />
            );
          })}
        </main>

        <aside className="sidebar">
          <Inspector annot={selected} dispatch={dispatch} focusToken={focusToken} onSelect={setSelectedId} onSaveSnippet={saveSnippet} />
          <SnippetsPanel snippets={snippets} disabled={!activePage} onInsert={insertSnippet} onRemove={removeSnippet} />
          <section className="panel shortcuts">
            <div className="panel-title">Shortcuts</div>
            <dl>
              <dt>Del</dt>
              <dd>Delete selected</dd>
              <dt>Arrows</dt>
              <dd>Nudge 1pt (Shift: 10pt)</dd>
              <dt>Ctrl+D</dt>
              <dd>Duplicate</dd>
              <dt>Ctrl+Z / Y</dt>
              <dd>Undo / redo</dd>
              <dt>Ctrl+S</dt>
              <dd>Download PDF</dd>
              <dt>Esc</dt>
              <dd>Back to Select</dd>
            </dl>
          </section>
        </aside>
      </div>

      {busy && <div className="busy">{busy}</div>}
      {dialog && (
        <div
          className="modal-backdrop"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) setDialog(null);
          }}
        >
          {dialog(() => setDialog(null))}
        </div>
      )}
    </div>
  );
}
