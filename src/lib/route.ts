// Which dashboard page is open, and how links between them work.
//
// Web: every tool has a real address (/merge-pdf, /pl/polacz-pdf; see
// utilities/routes.ts) that the server answers with a static page for search
// engines. In-app links switch pages with history.pushState, so the address bar
// always shows a link that can be shared. Old #/tool/<id> links are rewritten to
// the clean address on load.
//
// Desktop app (Tauri): the window always loads the bundled index.html, so it keeps
// the #/tool/<id> routes it has always used.
import { useEffect, useState, type MouseEvent } from 'react';
import { isDesktop } from './desktop';
import { homePath, parsePath, TOOL_IDS, toolPath, type Lang, type ToolId } from '../utilities/routes';

export interface Route {
  tool: ToolId | null;
  /** Language of the page's address (the app itself is in English). */
  lang: Lang;
}

const CHANGE = 'nyx:route';
const isTool = (id: string | undefined): id is ToolId => !!id && (TOOL_IDS as string[]).includes(id);
const hashTool = (hash: string) => /^#\/tool\/([\w-]+)/.exec(hash)?.[1];

/** Reads the current route. On the web, rewrites a legacy #/ or #/tool/<id> address to the clean one first. */
export function currentRoute(): Route {
  const { pathname, hash, search } = window.location;
  if (isDesktop) {
    const id = hashTool(hash);
    return { tool: isTool(id) ? id : null, lang: 'en' };
  }
  const fromPath = parsePath(pathname) ?? { tool: null, lang: 'en' };
  if (hash.startsWith('#/')) {
    const id = hashTool(hash);
    const route: Route = { tool: isTool(id) ? id : null, lang: fromPath.lang };
    history.replaceState(history.state, '', `${pathOf(route)}${search}`);
    return route;
  }
  return fromPath;
}

const pathOf = (r: Route) => (r.tool ? toolPath(r.tool, r.lang) : homePath(r.lang));

/** Link target for a tool (null: the dashboard), in the language of the current address. */
export function hrefFor(tool: ToolId | null): string {
  if (isDesktop) return tool ? `#/tool/${tool}` : '#/';
  return pathOf({ tool, lang: parsePath(window.location.pathname)?.lang ?? 'en' });
}

/** Opens a tool (null: the dashboard) as if a link to it was clicked. */
export function navigate(tool: ToolId | null) {
  if (isDesktop) {
    window.location.hash = tool ? `#/tool/${tool}` : '#/';
    return;
  }
  const path = hrefFor(tool);
  if (path !== window.location.pathname || window.location.hash) history.pushState(null, '', path);
  window.dispatchEvent(new Event(CHANGE));
}

/**
 * Props for an in-app link: a real href (crawlable, opens in a new tab with Ctrl/middle
 * click) whose plain left click switches pages without reloading.
 */
export function linkTo(tool: ToolId | null, onClick?: () => void) {
  return {
    href: hrefFor(tool),
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.();
      if (isDesktop || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      navigate(tool);
    },
  };
}

/** The current route, updated on navigation, Back/Forward and hash changes. */
export function useRoute(): Route {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const update = () =>
      setRoute((old) => {
        const next = currentRoute();
        return old.tool === next.tool && old.lang === next.lang ? old : next;
      });
    for (const type of [CHANGE, 'popstate', 'hashchange']) window.addEventListener(type, update);
    return () => {
      for (const type of [CHANGE, 'popstate', 'hashchange']) window.removeEventListener(type, update);
    };
  }, []);
  return route;
}
