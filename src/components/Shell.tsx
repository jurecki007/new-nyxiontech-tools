import { useCallback, useEffect, useState } from 'react';
import { Download, Globe, Heart, Info, LayoutDashboard, RefreshCw, Search, Sparkles } from 'lucide-react';
import { AboutDialog, type AboutTab } from './AboutDialog';
import { GithubIcon } from './GithubIcon';
import { LanguageSwitch } from './LanguageSwitch';
import { Home } from './Home';
import { PrivacyIndicator } from './Privacy';
import { SupportNote } from './SupportNote';
import { APP_NAME, APP_SHORT_NAME, APP_VERSION, COMPANY_URL, DONATE_URL, REPO_URL } from '../config';
import { externalLink } from '../lib/desktop';
import { en } from '../i18n/en';
import { fold, storedIn, useT } from '../i18n';
import { useInstallPrompt } from '../lib/pwa';
import { linkTo, useRoute } from '../lib/route';
import { useUpdates, type AvailableUpdate, type InstallState } from '../lib/updates';
import { getUtility, UTILITIES, UTILITY_GROUPS, type ToolId, type UtilityContext } from '../utilities';
import type { Project } from '../types';

/** Dashboard layout: tool navigation on the left, the dashboard or a tool page on the right. */
export function Shell({ ctx, onOpenProject, error, onDismissError }: { ctx: UtilityContext; onOpenProject: (p: Project) => void; error: string | null; onDismissError: () => void }) {
  const route = useRoute();
  const [query, setQuery] = useState('');
  const [about, setAbout] = useState<AboutTab | null>(null);
  const closeAbout = useCallback(() => setAbout(null), []);
  const updates = useUpdates();
  const install = useInstallPrompt();
  const update = updates.available;
  const utility = route.tool ? getUtility(route.tool) : undefined;
  const t = useT();
  const label = utility && t.tools[utility.id].label;

  useEffect(() => {
    document.querySelector('.shell-main')?.scrollTo(0, 0);
    document.title = label ? `${label} · ${APP_SHORT_NAME}` : APP_NAME;
  }, [label]);

  // Matches the tool's name and description in the current language and in English, ignoring accents.
  const q = fold(query.trim());
  const matches = (id: ToolId) => !q || [t.tools[id], en.tools[id]].some((s) => fold(s.label).includes(q) || fold(s.description).includes(q));

  return (
    <div className="shell">
      <aside className="nav">
        <a className="brand nav-brand" {...linkTo(null)}>
          NYXION<b>TECH</b>
          <i>.</i>
          <span>PDF</span>
        </a>
        <label className="nav-search">
          <Search size={15} />
          <input placeholder={t.shell.searchTools} value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <nav className="nav-list">
          {!q && (
            <a {...linkTo(null)} className={`nav-item${!utility ? ' on' : ''}`}>
              <LayoutDashboard size={17} /> {t.shell.dashboard}
            </a>
          )}
          {UTILITY_GROUPS.map((g) => {
            const items = UTILITIES.filter((u) => u.group === g.id && matches(u.id));
            if (!items.length) return null;
            return (
              <div key={g.id} className="nav-section">
                <div className="nav-group">{t.groups[g.id]}</div>
                {items.map((u) => (
                  <a key={u.id} {...linkTo(u.id, () => setQuery(''))} className={`nav-item${u.id === utility?.id ? ' on' : ''}`}>
                    <u.icon size={17} /> {t.tools[u.id].label}
                  </a>
                ))}
              </div>
            );
          })}
          {q && !UTILITIES.some((u) => matches(u.id)) && <p className="hint nav-empty">{t.shell.noMatch(query)}</p>}
        </nav>
        <div className="nav-foot">
          <PrivacyIndicator onOpen={() => setAbout('privacy')} />
          <div className="nav-links">
            <button onClick={() => setAbout('changes')} title={t.shell.whatsNewTitle}>
              <Sparkles size={13} /> {t.shell.whatsNew}
            </button>
            <button onClick={() => setAbout('about')} title={t.shell.aboutTitle(APP_NAME)}>
              <Info size={13} /> {t.shell.about}
            </button>
            {install && (
              <button className="install" onClick={install} title={t.shell.installTitle}>
                <Download size={13} /> {t.shell.install}
              </button>
            )}
            <a href={REPO_URL} {...externalLink} title={t.shell.starTitle}>
              <GithubIcon size={13} /> {t.shell.star}
            </a>
            <a href={COMPANY_URL} {...externalLink} title={t.shell.madeBy}>
              <Globe size={13} /> nyxiontech.com
            </a>
            {DONATE_URL && (
              <a className="donate" href={DONATE_URL} {...externalLink} title={t.shell.supportTitle}>
                <Heart size={13} /> {t.shell.support}
              </a>
            )}
          </div>
          <div className="nav-version-row">
            <div className="nav-version">v{APP_VERSION} · AGPL-3.0</div>
            <LanguageSwitch />
          </div>
        </div>
      </aside>

      <main className="shell-main">
        {update && <UpdateBanner update={update} />}
        {error && (
          <div className="banner error" onClick={onDismissError}>
            {error} <span className="muted">{t.common.clickToDismiss}</span>
          </div>
        )}
        {utility ? <utility.Component key={utility.id} ctx={ctx} /> : <Home ctx={ctx} onOpenProject={onOpenProject} />}
      </main>
      {about && <AboutDialog initialTab={about} updates={updates} onClose={closeAbout} />}
      <SupportNote />
    </div>
  );
}

/** Offers a newer version: a reload in the browser, a signed download-and-install in the desktop app. */
function UpdateBanner({ update }: { update: AvailableUpdate }) {
  const [state, setState] = useState<InstallState>({ phase: 'idle' });
  const notes = update.install ? `${REPO_URL}/releases/tag/v${update.version}` : `${REPO_URL}/blob/master/CHANGELOG.md`;
  const busy = state.phase === 'downloading' || state.phase === 'installing';
  const t = useT();
  return (
    <div className="banner update" role="status">
      <RefreshCw size={15} />
      <span>
        {state.phase === 'downloading'
          ? t.update.downloading(update.version, state.percent)
          : state.phase === 'installing'
            ? t.update.installing(update.version)
            : state.phase === 'error'
              ? t.update.failed(state.message)
              : update.install
                ? t.update.availableDesktop(update.version, storedIn(t))
                : t.update.availableWeb(update.version, storedIn(t))}
      </span>
      <span className="spacer" />
      <a className="btn ghost" href={notes} {...externalLink}>
        {t.update.whatsNew}
      </a>
      {update.install ? (
        <button className="btn primary" disabled={busy} onClick={() => void update.install!(setState)}>
          {state.phase === 'error' ? t.update.tryAgain : t.update.installAndRestart}
        </button>
      ) : (
        <button className="btn primary" onClick={() => window.location.reload()}>
          {t.update.reload}
        </button>
      )}
    </div>
  );
}
