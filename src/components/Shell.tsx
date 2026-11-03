import { useCallback, useEffect, useState } from 'react';
import { Globe, Heart, Info, LayoutDashboard, RefreshCw, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { AboutDialog, type AboutTab } from './AboutDialog';
import { GithubIcon } from './GithubIcon';
import { Home } from './Home';
import { APP_NAME, APP_SHORT_NAME, APP_VERSION, COMPANY_URL, DONATE_URL, REPO_URL } from '../config';
import { externalLink, storedIn } from '../lib/desktop';
import { useAvailableUpdate } from '../lib/updates';
import { getUtility, UTILITIES, UTILITY_GROUPS, type UtilityContext } from '../utilities';
import type { Project } from '../types';

function useHash() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

/** Dashboard layout: tool navigation on the left, the dashboard or a tool page on the right. */
export function Shell({ ctx, onOpenProject, error, onDismissError }: { ctx: UtilityContext; onOpenProject: (p: Project) => void; error: string | null; onDismissError: () => void }) {
  const hash = useHash();
  const [query, setQuery] = useState('');
  const [about, setAbout] = useState<AboutTab | null>(null);
  const closeAbout = useCallback(() => setAbout(null), []);
  const update = useAvailableUpdate();
  const toolId = /^#\/tool\/([\w-]+)/.exec(hash)?.[1];
  const utility = toolId ? getUtility(toolId) : undefined;

  useEffect(() => {
    document.querySelector('.shell-main')?.scrollTo(0, 0);
    document.title = utility ? `${utility.label} · ${APP_SHORT_NAME}` : APP_NAME;
  }, [utility]);

  const q = query.trim().toLowerCase();
  const matches = (label: string, description: string) => !q || label.toLowerCase().includes(q) || description.toLowerCase().includes(q);

  return (
    <div className="shell">
      <aside className="nav">
        <a className="brand nav-brand" href="#/">
          NYXION<b>TECH</b>
          <i>.</i>
          <span>PDF</span>
        </a>
        <label className="nav-search">
          <Search size={15} />
          <input placeholder="Search tools" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <nav className="nav-list">
          {!q && (
            <a href="#/" className={`nav-item${!utility ? ' on' : ''}`}>
              <LayoutDashboard size={17} /> Dashboard
            </a>
          )}
          {UTILITY_GROUPS.map((g) => {
            const items = UTILITIES.filter((u) => u.group === g.id && matches(u.label, u.description));
            if (!items.length) return null;
            return (
              <div key={g.id} className="nav-section">
                <div className="nav-group">{g.label}</div>
                {items.map((u) => (
                  <a key={u.id} href={`#/tool/${u.id}`} className={`nav-item${u.id === utility?.id ? ' on' : ''}`} onClick={() => setQuery('')}>
                    <u.icon size={17} /> {u.label}
                  </a>
                ))}
              </div>
            );
          })}
          {q && !UTILITIES.some((u) => matches(u.label, u.description)) && <p className="hint nav-empty">No tool matches “{query}”.</p>}
        </nav>
        <div className="nav-foot">
          <div className="nav-privacy">
            <ShieldCheck size={15} /> Files never leave this computer
          </div>
          <div className="nav-links">
            <button onClick={() => setAbout('changes')} title="What's new in this version">
              <Sparkles size={13} /> What's new
            </button>
            <button onClick={() => setAbout('about')} title={`About ${APP_NAME}`}>
              <Info size={13} /> About
            </button>
            <a href={REPO_URL} {...externalLink} title="Source code on GitHub">
              <GithubIcon size={13} /> GitHub
            </a>
            <a href={COMPANY_URL} {...externalLink} title="Made by Nyxiontech">
              <Globe size={13} /> nyxiontech.com
            </a>
            {DONATE_URL && (
              <a className="donate" href={DONATE_URL} {...externalLink} title="Support the project">
                <Heart size={13} /> Support
              </a>
            )}
          </div>
          <div className="nav-version">v{APP_VERSION} · AGPL-3.0</div>
        </div>
      </aside>

      <main className="shell-main">
        {update && (
          <div className="banner update" role="status">
            <RefreshCw size={15} />
            <span>
              Version {update} is available. Reloading is safe: your documents are saved {storedIn}.
            </span>
            <span className="spacer" />
            <a className="btn ghost" href={`${REPO_URL}/blob/master/CHANGELOG.md`} {...externalLink}>
              What's new
            </a>
            <button className="btn primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        )}
        {error && (
          <div className="banner error" onClick={onDismissError}>
            {error} <span className="muted">(click to dismiss)</span>
          </div>
        )}
        {utility ? <utility.Component key={utility.id} ctx={ctx} /> : <Home ctx={ctx} onOpenProject={onOpenProject} />}
      </main>
      {about && <AboutDialog initialTab={about} onClose={closeAbout} />}
    </div>
  );
}
