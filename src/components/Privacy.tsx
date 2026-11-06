import { useEffect, useState } from 'react';
import { ShieldCheck, WifiOff } from 'lucide-react';
import { REPO_URL } from '../config';
import { externalLink, isDesktop } from '../lib/desktop';
import { useT } from '../i18n';

/**
 * The connect-src directive of the Content-Security-Policy this build is served with:
 * nginx/security-headers.conf on the web, src-tauri/tauri.conf.json in the desktop app.
 * Read from those files at build time (vite.config.ts), so it can't drift from them.
 */
export const CONNECT_SRC = isDesktop ? __CSP_CONNECT_SRC__.desktop : __CSP_CONNECT_SRC__.web;

/** navigator.onLine, kept up to date. */
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

/** Sidebar line that says files stay local (and what works offline), and opens the explainer. */
export function PrivacyIndicator({ onOpen }: { onOpen: () => void }) {
  const online = useOnline();
  const p = useT().privacy;
  // What still works offline: the desktop app has every part installed. A web page loads each
  // tool's parts (pdf.js worker, fonts, OCR data, ...) the first time it is used; the browser
  // then caches them (see the Cache-Control in nginx/nginx.conf), so only tools used once work.
  const offline = isDesktop ? p.offlineShortDesktop : p.offlineShortWeb;
  return (
    <div className="nav-privacy" aria-live="polite">
      <button className={online ? '' : 'offline'} onClick={onOpen} aria-haspopup="dialog" title={p.indicatorTitle}>
        {online ? <ShieldCheck size={15} /> : <WifiOff size={15} />}
        {online ? (isDesktop ? p.staysOnComputer : p.staysOnDevice) : offline}
      </button>
    </div>
  );
}

/** The "Privacy" tab of the About dialog: what keeps files local, and how to check it yourself. */
export function PrivacyPanel() {
  const online = useOnline();
  const p = useT().privacy;
  const host = window.location.host;
  return (
    <div className="about-body privacy">
      <p className={`privacy-status${online ? '' : ' offline'}`} role="status">
        {online ? <ShieldCheck size={15} /> : <WifiOff size={15} />}
        {online ? (isDesktop ? p.onlineComputer : p.onlineDevice) : isDesktop ? p.offlineLongDesktop : p.offlineLongWeb}
      </p>

      <h4>{isDesktop ? p.runsOnComputer : p.runsInBrowser}</h4>
      <p>{isDesktop ? p.readIntoApp : p.readIntoPage}</p>

      <h4>{isDesktop ? p.enforcedByApp : p.enforcedByBrowser}</h4>
      <p>{isDesktop ? p.cspDesktop : p.cspWeb}</p>
      <code className="privacy-csp" data-testid="connect-src">
        connect-src {CONNECT_SRC}
      </code>
      {isDesktop ? (
        <p className="muted">{p.cspExplainedDesktop}</p>
      ) : (
        <p className="muted">
          {p.cspExplainedWeb(host)} {p.sourceIsPublicBefore}{' '}
          <a href={REPO_URL} {...externalLink}>
            {p.sourceCode}
          </a>{' '}
          {p.sourceIsPublicAfter}
        </p>
      )}

      {isDesktop ? (
        <>
          <h4>{p.worksOffline}</h4>
          <p>{p.worksOfflineText}</p>
        </>
      ) : (
        <>
          <h4>{p.tryOffline}</h4>
          <p>{p.tryOfflineText}</p>
          <p className="muted">{p.partsCached(host)}</p>

          <h4>{p.devtools}</h4>
          <ol>
            {p.devtoolsSteps(host).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
