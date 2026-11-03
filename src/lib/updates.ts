import { useEffect, useState } from 'react';
import { APP_VERSION } from '../config';
import { isDesktop } from './desktop';

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

/**
 * Returns the version deployed on this server when it is newer than the running one.
 * Only asks this origin (/version.json): on start, every 30 minutes and when the tab is shown again.
 */
export function useAvailableUpdate(): string | null {
  const [available, setAvailable] = useState<string | null>(null);

  useEffect(() => {
    // The desktop app carries its own build, so there is no newer one to load.
    if (isDesktop) return;
    let cancelled = false;
    const check = () =>
      void fetchDeployedVersion().then((v) => {
        if (!cancelled && v && isNewer(v, APP_VERSION)) setAvailable(v);
      });
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return available;
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
