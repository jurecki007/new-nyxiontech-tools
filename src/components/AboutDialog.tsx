import { useEffect, useMemo, useState } from 'react';
import { Bug, ExternalLink, Globe, Heart, RefreshCw, X } from 'lucide-react';
import { GithubIcon } from './GithubIcon';
import changelog from '../../CHANGELOG.md?raw';
import { APP_NAME, APP_VERSION, COMPANY_NAME, COMPANY_URL, DONATE_URL, ISSUES_URL, REPO_URL, SPONSORS_URL } from '../config';
import { externalLink, isDesktop } from '../lib/desktop';
import { parseChangelog, type Updates } from '../lib/updates';

export type AboutTab = 'about' | 'changes';

/** "About" and "What's new" in one dialog. */
export function AboutDialog({ initialTab, updates, onClose }: { initialTab: AboutTab; updates: Updates; onClose: () => void }) {
  const [tab, setTab] = useState<AboutTab>(initialTab);
  const releases = useMemo(() => parseChangelog(changelog), []);

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
      <div className="modal about" role="dialog" aria-label={tab === 'about' ? `About ${APP_NAME}` : "What's new"}>
        <header className="modal-head">
          <b>{APP_NAME}</b>
          <span className="version-pill">v{APP_VERSION}</span>
          <button className="icon-btn" title="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="segmented">
          <button className={tab === 'about' ? 'on' : ''} onClick={() => setTab('about')}>
            About
          </button>
          <button className={tab === 'changes' ? 'on' : ''} onClick={() => setTab('changes')}>
            What's new
          </button>
        </div>

        {tab === 'about' ? (
          <div className="about-body">
            <p>
              Free, open-source PDF and image tools that run entirely {isDesktop ? 'on your computer' : 'in your browser'}. Files are never uploaded:
              there is no server-side processing, no account and no tracking.
            </p>
            <p className="muted">
              Made by{' '}
              <a href={COMPANY_URL} {...externalLink}>
                {COMPANY_NAME}
              </a>
              . Licensed under the{' '}
              <a href={`${REPO_URL}/blob/master/LICENSE`} {...externalLink}>
                GNU Affero General Public License v3.0
              </a>
              . Built on open-source libraries and fonts:{' '}
              <a href={isDesktop ? `${REPO_URL}/blob/master/public/THIRD-PARTY-NOTICES.txt` : '/THIRD-PARTY-NOTICES.txt'} {...externalLink}>
                third-party licences
              </a>
              .
            </p>
            <div className="about-links">
              <a className="btn" href={COMPANY_URL} {...externalLink}>
                <Globe size={15} /> nyxiontech.com
              </a>
              <a className="btn" href={REPO_URL} {...externalLink}>
                <GithubIcon size={15} /> Source code
              </a>
              <a className="btn" href={ISSUES_URL} {...externalLink}>
                <Bug size={15} /> Report a problem
              </a>
              {DONATE_URL && (
                <a className="btn primary" href={DONATE_URL} {...externalLink}>
                  <Heart size={15} /> Support the project
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
            {releases.map((r) => (
              <section key={r.version}>
                <h4>
                  {r.version} {r.version === APP_VERSION && <span className="version-pill">current</span>}
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
              Full changelog on GitHub <ExternalLink size={12} />
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
  const checkNow = () => {
    setState({ phase: 'checking' });
    updates.checkNow().then(
      (u) => setState(u ? { phase: 'found', version: u.version } : { phase: 'latest' }),
      (e: unknown) => setState({ phase: 'error', message: e instanceof Error ? e.message : String(e) }),
    );
  };
  return (
    <section className="about-updates">
      <h4>Updates</h4>
      <label className="check">
        <input type="checkbox" checked={updates.autoCheck} onChange={(e) => updates.setAutoCheck(e.target.checked)} />
        Check for updates automatically
      </label>
      <p className="muted">
        The app asks GitHub Releases for the latest version number; nothing about you or your documents is sent. When this is off, the app only
        contacts GitHub when you click "Check now". <a href={`${REPO_URL}/blob/master/PRIVACY.md`} {...externalLink}>Privacy policy</a>
      </p>
      <div className="about-check">
        <button className="btn" disabled={state.phase === 'checking'} onClick={checkNow}>
          <RefreshCw size={15} /> Check now
        </button>
        <span className="muted" role="status">
          {state.phase === 'checking'
            ? 'Checking…'
            : state.phase === 'latest'
              ? `You have the latest version (${APP_VERSION}).`
              : state.phase === 'found'
                ? `Version ${state.version} is available: see the banner to install it.`
                : state.phase === 'error'
                  ? `Could not check for updates: ${state.message}`
                  : ''}
        </span>
      </div>
    </section>
  );
}
