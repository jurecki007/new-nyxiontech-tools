import type { MouseEvent } from 'react';
import { isDesktop } from '../lib/desktop';
import { languageHref, switchLanguage, useRoute } from '../lib/route';
import { LANG_NAMES, setStoredLang, UI_LANGS, useLang, useT, type UiLang } from '../i18n';
import { TOOL_SLUGS, type Lang } from '../utilities/routes';

/** Languages that have web addresses (see TOOL_SLUGS); the desktop app can use any UI language. */
const WEB_LANGS = Object.keys(Object.values(TOOL_SLUGS)[0]) as Lang[];

/**
 * EN / PL switch. On the web each option is a link to the same page in that language
 * (/merge-pdf, /pl/polacz-pdf); in the desktop app it switches the language and remembers it.
 */
export function LanguageSwitch() {
  const t = useT();
  const lang = useLang();
  useRoute(); // re-render on navigation, so the links point at the current page
  const langs: UiLang[] = isDesktop ? UI_LANGS : UI_LANGS.filter((l): l is Lang => (WEB_LANGS as string[]).includes(l));

  return (
    <div className="lang-switch" role="group" aria-label={t.language.label}>
      {langs.map((l) => {
        const props = {
          className: l === lang ? 'on' : '',
          lang: l,
          title: l === lang ? LANG_NAMES[l].name : t.language.switchTo(LANG_NAMES[l].name),
          'aria-label': LANG_NAMES[l].name,
          'aria-current': l === lang ? ('true' as const) : undefined,
        };
        if (isDesktop) {
          return (
            <button key={l} type="button" {...props} onClick={() => setStoredLang(l)}>
              {LANG_NAMES[l].short}
            </button>
          );
        }
        return (
          <a
            key={l}
            {...props}
            href={languageHref(l as Lang)}
            hrefLang={l}
            onClick={(e: MouseEvent<HTMLAnchorElement>) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              switchLanguage(l as Lang);
            }}
          >
            {LANG_NAMES[l].short}
          </a>
        );
      })}
    </div>
  );
}
