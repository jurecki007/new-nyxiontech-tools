// The app's interface language. See TRANSLATING.md for adding a language.
//
// Web: the language is the one of the address (/pl/... is Polish, everything else
// English), so a shared link always opens in the same language, and the language
// switch goes to the equivalent address (src/lib/route.ts).
// Desktop app: the address is always #/tool/<id>, so the language follows the
// system (navigator.languages) unless the user picked one with the switch, which is
// remembered.
//
// Components read the strings with `useT()`, which also re-renders them when the
// language changes; plain functions (error messages, defaults) use `tr()`.
import { useSyncExternalStore } from 'react';
import { isDesktop } from '../lib/desktop';
import { parsePath, type Lang } from '../utilities/routes';
import { en, type Messages } from './en';
import { pl } from './pl';

export type { Messages } from './en';
export { plural } from './plural';

/** Every interface language. Each one must have every key of `en` (TypeScript checks it). */
export const MESSAGES = { en, pl } satisfies Record<Lang, Messages> & Record<string, Messages>;

export type UiLang = keyof typeof MESSAGES;
export const UI_LANGS = Object.keys(MESSAGES) as UiLang[];

/** How each language names itself, for the language switch. */
export const LANG_NAMES: Record<UiLang, { short: string; name: string }> = {
  en: { short: 'EN', name: 'English' },
  pl: { short: 'PL', name: 'Polski' },
};

const isUiLang = (l: string | null | undefined): l is UiLang => !!l && (UI_LANGS as string[]).includes(l);

/** Desktop app only: the language the user picked with the switch. */
const LANG_KEY = 'nyxiontech-pdf-tools:lang';

function storedLang(): UiLang | null {
  try {
    const l = localStorage.getItem(LANG_KEY);
    return isUiLang(l) ? l : null;
  } catch {
    return null;
  }
}

/** The first of the system's preferred languages that the app has, else English. */
export function systemLang(): UiLang {
  const prefs = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const p of prefs) {
    const base = p?.toLowerCase().split('-')[0];
    if (isUiLang(base)) return base;
  }
  return 'en';
}

/**
 * Development server only: `?lang=de` shows a language that has no web addresses yet,
 * for the rest of the tab's session (see TRANSLATING.md). Ignored in production builds.
 */
function devLang(): UiLang | null {
  if (!import.meta.env.DEV) return null;
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q !== null) sessionStorage.setItem(LANG_KEY, q);
    const l = sessionStorage.getItem(LANG_KEY);
    return isUiLang(l) ? l : null;
  } catch {
    return null;
  }
}

/** The language for the current address (web) or settings (desktop app). */
export function detectLang(): UiLang {
  if (typeof window === 'undefined') return 'en';
  if (isDesktop) return storedLang() ?? systemLang();
  return devLang() ?? parsePath(window.location.pathname)?.lang ?? 'en';
}

let current: UiLang = detectLang();
const listeners = new Set<() => void>();

function apply(lang: UiLang) {
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
  if (lang === current) return;
  current = lang;
  for (const l of listeners) l();
}

if (typeof window !== 'undefined') {
  apply(current);
  // Web: follow the address. In-app links fire 'nyx:route' (src/lib/route.ts).
  if (!isDesktop) for (const type of ['nyx:route', 'popstate']) window.addEventListener(type, () => apply(detectLang()));
}

export const getLang = (): UiLang => current;

/** Desktop app: switches the language and remembers the choice. On the web, change the address instead (switchLanguage in route.ts). */
export function setStoredLang(lang: UiLang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // storage unavailable: the choice lasts until the app is closed
  }
  apply(lang);
}

/** The strings of the current language, for code outside components. */
export const tr = (): Messages => MESSAGES[current];

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};

/** The current language; the component re-renders when it changes. */
export const useLang = (): UiLang => useSyncExternalStore(subscribe, getLang, getLang);

/** The strings of the current language; the component re-renders when it changes. */
export const useT = (): Messages => MESSAGES[useLang()];

/** Text for searching: lower case, without diacritics ("Połącz" matches "polacz"). */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Where the user's documents live, for UI text: "in this browser" or "on this computer". */
export const storedIn = (t: Messages) => (isDesktop ? t.common.onThisComputer : t.common.inThisBrowser);
export const storedFrom = (t: Messages) => (isDesktop ? t.common.fromThisComputer : t.common.fromThisBrowser);
