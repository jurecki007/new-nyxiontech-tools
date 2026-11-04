import { useEffect, useState } from 'react';
import { ShieldCheck, WifiOff } from 'lucide-react';
import { REPO_URL } from '../config';
import { externalLink, isDesktop } from '../lib/desktop';

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

/**
 * What still works offline. The desktop app has every part installed. A web page loads each
 * tool's parts (pdf.js worker, fonts, OCR data, ...) the first time it is used; the browser
 * then caches them (see the Cache-Control in nginx/nginx.conf), so only tools used once work.
 */
const OFFLINE_SHORT = isDesktop ? 'Offline: everything still works' : "Offline: tools you've used still work";
const OFFLINE_LONG = isDesktop ? "You're offline right now, and every tool still works." : "You're offline right now. Tools you've already used keep working.";

/** Sidebar line that says files stay local (and what works offline), and opens the explainer. */
export function PrivacyIndicator({ onOpen }: { onOpen: () => void }) {
  const online = useOnline();
  return (
    <div className="nav-privacy" aria-live="polite">
      <button className={online ? '' : 'offline'} onClick={onOpen} aria-haspopup="dialog" title="How your files stay private, and how to check">
        {online ? <ShieldCheck size={15} /> : <WifiOff size={15} />}
        {online ? `Files stay on this ${isDesktop ? 'computer' : 'device'}` : OFFLINE_SHORT}
      </button>
    </div>
  );
}

/** The "Privacy" tab of the About dialog: what keeps files local, and how to check it yourself. */
export function PrivacyPanel() {
  const online = useOnline();
  const host = window.location.host;
  return (
    <div className="about-body privacy">
      <p className={`privacy-status${online ? '' : ' offline'}`} role="status">
        {online ? <ShieldCheck size={15} /> : <WifiOff size={15} />}
        {online ? `You're online. Your files still stay on this ${isDesktop ? 'computer' : 'device'}.` : OFFLINE_LONG}
      </p>

      <h4>Everything runs {isDesktop ? 'on your computer' : 'in your browser'}</h4>
      <p>
        When you choose a file, it is read into {isDesktop ? 'the app' : 'this page'} and processed right there, by code running on your device. There
        is no upload step, no server that processes files, no account and no tracking.
      </p>

      <h4>{isDesktop ? "The app's window enforces it" : 'Your browser enforces it'}</h4>
      <p>
        {isDesktop
          ? "The app's window has the same Content-Security-Policy as the website, which lets the page connect only to the app itself:"
          : 'This site is served with a Content-Security-Policy that lets the page connect only to the site it came from:'}
      </p>
      <code className="privacy-csp" data-testid="connect-src">
        connect-src {CONNECT_SRC}
      </code>
      {isDesktop ? (
        <p className="muted">
          'self' is the app's own installed files; ipc: and http://ipc.localhost are the channel to the app, used to save files; data: and blob: are
          files built in memory. A request to any other server is blocked before it is sent.
        </p>
      ) : (
        <p className="muted">
          'self' is {host}; data: and blob: are files the page builds in its own memory. A request to any other server is blocked by the browser
          before it is sent. {host} only serves the app's own files (code, fonts, OCR language data, the AI model) and has nothing that receives
          documents. The{' '}
          <a href={REPO_URL} {...externalLink}>
            source code
          </a>{' '}
          is public.
        </p>
      )}

      {isDesktop ? (
        <>
          <h4>It works offline</h4>
          <p>
            Everything the tools need is installed with the app, so they work without internet. The only thing the app fetches by itself is the update
            check from GitHub, which you can turn off under About.
          </p>
        </>
      ) : (
        <>
          <h4>Try it: go offline</h4>
          <p>
            Use a tool once, then disconnect from the internet or turn on airplane mode and use it again on another file. It keeps working, because
            nothing it does needs the network.
          </p>
          <p className="muted">
            Each tool loads its own parts from {host} (code, fonts, OCR language data, the AI model) the first time you use it, and your browser keeps
            them. Reloading the page needs the connection again.
          </p>

          <h4>Check it in DevTools</h4>
          <ol>
            <li>Press F12 (Cmd+Option+I on a Mac) and open the Network tab.</li>
            <li>Use any tool.</li>
            <li>
              Every request goes to {host}, or is a blob: or data: URL built in memory. None of them carries your file. Anything else would show up as
              blocked, with a Content-Security-Policy error in the Console.
            </li>
          </ol>
        </>
      )}
    </div>
  );
}
