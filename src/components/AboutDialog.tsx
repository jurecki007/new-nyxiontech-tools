import { useEffect, useMemo, useState } from 'react';
import { Bug, ExternalLink, Github, Globe, Heart, X } from 'lucide-react';
import changelog from '../../CHANGELOG.md?raw';
import { APP_NAME, APP_VERSION, COMPANY_NAME, COMPANY_URL, DONATE_URL, ISSUES_URL, REPO_URL } from '../config';
import { parseChangelog } from '../lib/updates';

export type AboutTab = 'about' | 'changes';

/** "About" and "What's new" in one dialog. */
export function AboutDialog({ initialTab, onClose }: { initialTab: AboutTab; onClose: () => void }) {
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
              Free, open-source PDF and image tools that run entirely in your browser. Files are never uploaded: there is no server-side processing, no
              account and no tracking.
            </p>
            <p className="muted">
              Made by{' '}
              <a href={COMPANY_URL} target="_blank" rel="noopener noreferrer">
                {COMPANY_NAME}
              </a>
              . Licensed under the{' '}
              <a href={`${REPO_URL}/blob/master/LICENSE`} target="_blank" rel="noopener noreferrer">
                GNU Affero General Public License v3.0
              </a>
              . Built on open-source libraries and fonts:{' '}
              <a href="/THIRD-PARTY-NOTICES.txt" target="_blank" rel="noopener">
                third-party licences
              </a>
              .
            </p>
            <div className="about-links">
              <a className="btn" href={COMPANY_URL} target="_blank" rel="noopener noreferrer">
                <Globe size={15} /> nyxiontech.com
              </a>
              <a className="btn" href={REPO_URL} target="_blank" rel="noopener noreferrer">
                <Github size={15} /> Source code
              </a>
              <a className="btn" href={ISSUES_URL} target="_blank" rel="noopener noreferrer">
                <Bug size={15} /> Report a problem
              </a>
              {DONATE_URL && (
                <a className="btn primary" href={DONATE_URL} target="_blank" rel="noopener noreferrer">
                  <Heart size={15} /> Support the project
                </a>
              )}
            </div>
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
            <a className="muted changelog-full" href={`${REPO_URL}/blob/master/CHANGELOG.md`} target="_blank" rel="noopener noreferrer">
              Full changelog on GitHub <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
