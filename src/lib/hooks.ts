import { useEffect, useState } from 'react';
import type { PageInfo, PageRef, Source } from '../types';
import { getPageInfo } from './pdfjs';

export const pageKey = (p: Pick<PageRef, 'sourceId' | 'index'>) => `${p.sourceId}:${p.index}`;

/** Loads size/rotation info for every page, keyed by `pageKey`. */
export function usePageInfos(sources: Source[], pages: PageRef[]): Record<string, PageInfo> {
  const [infos, setInfos] = useState<Record<string, PageInfo>>({});

  useEffect(() => {
    let alive = true;
    const missing = pages.filter((p) => !infos[pageKey(p)]);
    if (!missing.length) return;
    void Promise.all(
      missing.map(async (p) => {
        const source = sources.find((s) => s.id === p.sourceId);
        if (!source) return null;
        try {
          return [pageKey(p), await getPageInfo(source, p.index)] as const;
        } catch {
          return null;
        }
      }),
    ).then((entries) => {
      if (!alive) return;
      const found = entries.filter((e) => e !== null);
      if (found.length) setInfos((prev) => ({ ...prev, ...Object.fromEntries(found) }));
    });
    return () => {
      alive = false;
    };
    // `infos` is deliberately left out: it only grows, and is read to skip known pages.
  }, [sources, pages]);

  return infos;
}
