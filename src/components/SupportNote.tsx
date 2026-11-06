import { useEffect, useState } from 'react';
import { Coffee, Star, X } from 'lucide-react';
import { DONATE_URL, REPO_URL } from '../config';
import { externalLink } from '../lib/desktop';
import { loadUiPref, saveUiPref } from '../lib/storage';
import { FILE_SAVED_EVENT } from '../lib/zip';
import { useT } from '../i18n';

const SHOWN_THIS_SESSION = 'nyxiontech-pdf-tools:supportNote.shown';
const DISMISSED_AT = 'supportNote.dismissedAt';
const QUIET_AFTER_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function shownThisSession() {
  try {
    return sessionStorage.getItem(SHOWN_THIS_SESSION) !== null;
  } catch {
    return false;
  }
}

function markShown() {
  try {
    sessionStorage.setItem(SHOWN_THIS_SESSION, '1');
  } catch {
    // storage unavailable: the note may show again this session, nothing worse
  }
}

/** Whether the note may appear now: not yet this session, and not within a week of being dismissed. */
function mayShow() {
  if (shownThisSession()) return false;
  const dismissedAt = loadUiPref<number>(DISMISSED_AT, 0);
  return !(Date.now() - dismissedAt < QUIET_AFTER_DISMISS_MS);
}

/**
 * A small, dismissible note after a result has been saved: a GitHub star or a Ko-fi tip.
 * At most once per browser session, and not again for a week after it is dismissed.
 */
export function SupportNote() {
  const [visible, setVisible] = useState(false);
  const t = useT();

  useEffect(() => {
    let timer: number | undefined;
    const onSaved = () => {
      if (!mayShow()) return;
      markShown();
      // Let the browser's own download indicator appear first.
      timer = window.setTimeout(() => setVisible(true), 600);
    };
    window.addEventListener(FILE_SAVED_EVENT, onSaved);
    return () => {
      window.removeEventListener(FILE_SAVED_EVENT, onSaved);
      window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    saveUiPref(DISMISSED_AT, Date.now());
    setVisible(false);
  };

  return (
    <div className="support-note-region" role="status" aria-live="polite">
      {visible && (
        <div className="support-note">
          <span>{t.supportNote.savedTime}</span>
          <a href={REPO_URL} {...externalLink} onClick={dismiss}>
            <Star size={14} /> {t.supportNote.star}
          </a>
          {DONATE_URL && (
            <>
              <span className="muted" aria-hidden="true">
                ·
              </span>
              <a href={DONATE_URL} {...externalLink} onClick={dismiss}>
                <Coffee size={14} /> {t.supportNote.kofi}
              </a>
            </>
          )}
          <button className="icon-btn" aria-label={t.supportNote.dismiss} title={t.supportNote.dismiss} onClick={dismiss}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
