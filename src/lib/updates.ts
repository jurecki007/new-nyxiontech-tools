import { useCallback, useEffect, useState } from 'react';
import { APP_VERSION } from '../config';
import { isDesktop } from './desktop';
import { loadUiPref, saveUiPref } from './storage';

const CHECK_EVERY_MS = 30 * 60 * 1000;

/** Numeric compare of "1.2.3" versions; a pre-release suffix is ignored. */
export function isNewer(candidate: string, current: string) {
  const parts = (v: string) => v.split('-')[0].split('.').map((n) => Number.parseInt(n, 10) || 0);
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return false;
}

async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch('/version.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === 'string' ? data.version : null;
  } catch {
    return null; // offline, or served without version.json
  }
}

export type InstallState = { phase: 'idle' } | { phase: 'downloading'; percent: number | null } | { phase: 'installing' } | { phase: 'error'; message: string };

export interface AvailableUpdate {
  version: string;
  /**
   * Desktop app: downloads the signed installer, installs it and restarts.
   * Absent in the browser, where a reload loads the new version.
   */
  install?: (onState: (state: InstallState) => void) => Promise<void>;
}

/**
 * Desktop app: asks GitHub Releases (through the app, not the page) for a newer signed version.
 * Throws when GitHub can't be reached.
 */
async function checkDesktopUpdate(): Promise<AvailableUpdate | null> {
  const { check } = await import('@tauri-apps/plugin-updater');
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    install: async (onState) => {
      let total: number | null = null;
      let received = 0;
      try {
        onState({ phase: 'downloading', percent: null });
        // The signature is checked against the public key built into the app before anything runs.
        await update.downloadAndInstall((e) => {
          if (e.event === 'Started') total = e.data.contentLength ?? null;
          else if (e.event === 'Progress') {
            received += e.data.chunkLength;
            onState({ phase: 'downloading', percent: total ? Math.min(100, Math.round((received / total) * 100)) : null });
          } else onState({ phase: 'installing' });
        });
        // On Windows the installer closes the app itself; elsewhere restart into the new version.
        const { relaunch } = await import('@tauri-apps/plugin-process');
        await relaunch();
      } catch (e) {
        onState({ phase: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    },
  };
}

async function checkWebUpdate(): Promise<AvailableUpdate | null> {
  const v = await fetchDeployedVersion();
  return v && isNewer(v, APP_VERSION) ? { version: v } : null;
}

const AUTO_CHECK_PREF = 'updates.autoCheck';

export interface Updates {
  /** A newer version, once a check has found one. */
  available: AvailableUpdate | null;
  /**
   * Desktop app: whether to check GitHub Releases on its own. When off, the app
   * contacts GitHub only when the user clicks "Check now". Always true in the browser.
   */
  autoCheck: boolean;
  setAutoCheck: (on: boolean) => void;
  /** Checks right away; resolves to the newer version or null, and rejects when the check fails. */
  checkNow: () => Promise<AvailableUpdate | null>;
}

/**
 * Looks for a newer version: in the browser, the version deployed on this server
 * (/version.json, same origin); in the desktop app, the latest signed GitHub release.
 * Automatic checks run on start, every 30 minutes and when the window is shown again.
 */
export function useUpdates(): Updates {
  const [available, setAvailable] = useState<AvailableUpdate | null>(null);
  const [autoCheck, setAutoCheckState] = useState<boolean>(() => !isDesktop || loadUiPref(AUTO_CHECK_PREF, true));

  const setAutoCheck = useCallback((on: boolean) => {
    if (!isDesktop) return;
    saveUiPref(AUTO_CHECK_PREF, on);
    setAutoCheckState(on);
  }, []);

  const checkNow = useCallback(async () => {
    const u = await (isDesktop ? checkDesktopUpdate() : checkWebUpdate());
    if (u) setAvailable((prev) => (prev?.version === u.version ? prev : u));
    return u;
  }, []);

  useEffect(() => {
    if (!autoCheck) return;
    const check = () => void checkNow().catch(() => {}); // offline, or no release published yet
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [autoCheck, checkNow]);

  return { available, autoCheck, setAutoCheck, checkNow };
}

export interface ChangelogRelease {
  version: string;
  date: string;
  sections: { title: string; items: string[] }[];
}

/** Parses the "## [x.y.z] - date / ### Section / - item" subset of Keep a Changelog, without "Unreleased". */
export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const release = /^##\s+\[?([^\]\s]+)\]?(?:\s+-\s+(.+))?/.exec(line);
    if (release) {
      releases.push({ version: release[1], date: release[2]?.trim() ?? '', sections: [] });
      continue;
    }
    const current = releases[releases.length - 1];
    if (!current) continue;
    const section = /^###\s+(.+)/.exec(line);
    if (section) {
      current.sections.push({ title: section[1].trim(), items: [] });
      continue;
    }
    const item = /^[-*]\s+(.+)/.exec(line);
    if (item) {
      if (!current.sections.length) current.sections.push({ title: '', items: [] });
      current.sections[current.sections.length - 1].items.push(item[1].trim());
    }
  }
  // Changes not released yet are not part of the running version.
  return releases.filter((r) => r.version.toLowerCase() !== 'unreleased');
}
