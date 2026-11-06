import { useEffect, useMemo, useState } from 'react';
import { Bug, ExternalLink, Globe, Heart, RefreshCw, X } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import { PrivacyPanel } from './Privacy';
import changelog from '../../CHANGELOG.md?raw';
import { APP_NAME, APP_VERSION, COMPANY_NAME, COMPANY_URL, DONATE_URL, ISSUES_URL, REPO_URL, SPONSORS_URL } from '../config';
import { externalLink, isDesktop } from '../lib/desktop';
import { parseChangelog, type Updates } from '../lib/updates';
import { useT } from '../i18n';

export type AboutTab = 'about' | 'privacy' | 'changes';

const TABS: AboutTab[] = ['about', 'privacy', 'changes'];

/** "About", "Privacy" and "What's new" in one dialog. */
export function AboutDialog({ initialTab, updates, onClose }: { initialTab: AboutTab; updates: Updates; onClose: () => void }) {
  const [tab, setTab] = useState<AboutTab>(initialTab);
  const releases = useMemo(() => parseChangelog(changelog), []);
  const t = useT();
  const a = t.about;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal about" role="dialog" aria-modal="true" aria-label={tab === 'about' ? t.shell.aboutTitle(APP_NAME) : a.tabs[tab]}>
        <header className="modal-head">
          <b>{APP_NAME}</b>
          <span className="version-pill">v{APP_VERSION}</span>
          <button className="icon-btn" title={t.common.close} onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="segmented">
          {TABS.map((id) => (
            <button key={id} className={tab === id ? 'on' : ''} aria-pressed={tab === id} onClick={() => setTab(id)}>
              {a.tabs[id]}
            </button>
          ))}
        </div>

        {tab === 'privacy' ? (
          <PrivacyPanel />
        ) : tab === 'about' ? (
          <div className="about-body">
            <p>{a.intro(isDesktop ? a.onYourComputer : a.inYourBrowser)}</p>
            <p className="muted">
              {a.madeBy}{' '}
              <a href={COMPANY_URL} {...externalLink}>
                {COMPANY_NAME}
              </a>
              . {a.licensedUnder}{' '}
              <a href={`${REPO_URL}/blob/master/LICENSE`} {...externalLink}>
                GNU Affero General Public License v3.0
              </a>
              . {a.builtOn}{' '}
              <a href={isDesktop ? `${REPO_URL}/blob/master/public/THIRD-PARTY-NOTICES.txt` : '/THIRD-PARTY-NOTICES.txt'} {...externalLink}>
                {a.thirdParty}
              </a>
              .
            </p>
            <div className="about-links">
              <a className="btn" href={COMPANY_URL} {...externalLink}>
                <Globe size={15} /> nyxiontech.com
              </a>
              <a className="btn" href={REPO_URL} {...externalLink}>
                <GithubIcon size={15} /> {a.sourceCode}
              </a>
              <a className="btn" href={ISSUES_URL} {...externalLink}>
                <Bug size={15} /> {a.reportProblem}
              </a>
              {DONATE_URL && (
                <a className="btn primary" href={DONATE_URL} {...externalLink}>
                  <Heart size={15} /> {a.supportProject}
                </a>
              )}
              {SPONSORS_URL && (
                <a className="btn" href={SPONSORS_URL} {...externalLink}>
                  <Heart size={15} /> GitHub Sponsors
                </a>
              )}
            </div>
            {isDesktop && <UpdateSettings updates={updates} />}
          </div>
        ) : (
          <div className="changelog">
            {a.changelogNote && <p className="muted">{a.changelogNote}</p>}
            {releases.map((r) => (
              <section key={r.version}>
                <h4>
                  {r.version} {r.version === APP_VERSION && <span className="version-pill">{a.current}</span>}
                  {r.date && <span className="muted"> · {r.date}</span>}
                </h4>
                {r.sections.map((s, i) => (
                  <div key={i}>
                    {s.title && <div className="changelog-section">{s.title}</div>}
                    <ul>
                      {s.items.map((item, j) => (
                        <li key={j}>{item.replace(/`/g, '')}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </section>
            ))}
            <a className="muted changelog-full" href={`${REPO_URL}/blob/master/CHANGELOG.md`} {...externalLink}>
              {a.fullChangelog} <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

type CheckState = { phase: 'idle' | 'checking' | 'latest' } | { phase: 'found'; version: string } | { phase: 'error'; message: string };

/** Desktop app: turns the automatic update check on or off, and checks on request. */
function UpdateSettings({ updates }: { updates: Updates }) {
  const [state, setState] = useState<CheckState>({ phase: 'idle' });
  const a = useT().about;
  const checkNow = () => {
    setState({ phase: 'checking' });
    updates.checkNow().then(
      (u) => setState(u ? { phase: 'found', version: u.version } : { phase: 'latest' }),
      (e: unknown) => setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
  };
  return (
    <section className="about-updates">
      <h4>{a.updates}</h4>
      <label className="check">
        <input type="checkbox" checked={updates.autoCheck} onChange={(e) => updates.setAutoCheck(e.target.checked)} />
        {a.autoCheck}
      </label>
      <p className="muted">
        {a.updatesExplained}{' '}
        <a href={`${REPO_URL}/blob/master/PRIVACY.md`} {...externalLink}>
          {a.privacyPolicy}
        </a>
      </p>
      <div className="about-check">
        <button className="btn" disabled={state.phase === 'checking'} onClick={checkNow}>
          <RefreshCw size={15} /> {a.checkNow}
        </button>
        <span className="muted" role="status">
          {state.phase === 'checking'
            ? a.checking
            : state.phase === 'latest'
              ? a.latest(APP_VERSION)
              : state.phase === 'found'
                ? a.found(state.version)
                : state.phase === 'error'
                  ? a.checkFailed(state.message)
                  : ''}
        </span>
      </div>
    </section>
  );
}
