import { expect, test, type APIRequestContext } from '@playwright/test';
import { HOME_PL, TOOL_PAGES } from '../../src/seo/content';
import { homePath, TOOL_IDS, toolPath, type Lang } from '../../src/utilities/routes';
import { cspViolations } from './helpers';

// Clean tool addresses (/merge-pdf, /pl/polacz-pdf): the static pages search engines
// read, and the app's path routing on top of them. `vite preview` answers like
// Cloudflare Pages here (see cleanUrls in vite.config.ts).

const SITE = 'https://tools.nyxiontech.com';
const LANGS: Lang[] = ['en', 'pl'];
const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const first = (html: string, re: RegExp) => unescape(re.exec(html)?.[1] ?? '');

/** The raw HTML of a page, as a crawler without JavaScript gets it (no redirects followed). */
async function raw(request: APIRequestContext, path: string) {
  const res = await request.get(path, { maxRedirects: 0 });
  expect(res.status(), path).toBe(200);
  expect(res.headers()['content-type']).toContain('text/html');
  return res.text();
}

test.describe('static tool pages', () => {
  test('every tool page in both languages has its own title, canonical, h1 and structured data', async ({ request }) => {
    for (const id of TOOL_IDS) {
      for (const lang of LANGS) {
        const path = toolPath(id, lang);
        const copy = TOOL_PAGES[id][lang];
        const html = await raw(request, path);
        expect(first(html, /<html lang="([^"]+)">/), path).toBe(lang);
        expect(first(html, /<title>([^<]*)<\/title>/), path).toBe(copy.title);
        expect(first(html, /<meta name="description" content="([^"]*)"/), path).toBe(copy.description);
        expect(first(html, /<link rel="canonical" href="([^"]*)"/), path).toBe(SITE + path);
        expect(first(html, /<meta property="og:url" content="([^"]*)"/), path).toBe(SITE + path);
        expect(first(html, /<h1>([^<]*)<\/h1>/), path).toBe(copy.h1);
        expect(first(html, /hreflang="en" href="([^"]*)"/), path).toBe(SITE + toolPath(id, 'en'));
        expect(first(html, /hreflang="pl" href="([^"]*)"/), path).toBe(SITE + toolPath(id, 'pl'));
        expect(first(html, /hreflang="x-default" href="([^"]*)"/), path).toBe(SITE + toolPath(id, 'en'));
        // Links to related tools stay in the page's language.
        for (const r of TOOL_PAGES[id].related) expect(html, path).toContain(`href="${toolPath(r, lang)}"`);

        const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
        expect(blocks, path).toHaveLength(1);
        const graph = JSON.parse(blocks[0][1])['@graph'] as { '@type': string }[];
        expect(graph.map((n) => n['@type']), path).toEqual(expect.arrayContaining(['WebPage', 'WebApplication', 'BreadcrumbList', 'FAQPage']));
        // The app itself is loaded too.
        expect(html, path).toMatch(/<script type="module" crossorigin src="\/assets\/index-[\w-]+\.js"><\/script>/);
      }
    }
  });

  test('the home pages link to every tool page', async ({ request }) => {
    const en = await raw(request, '/');
    for (const id of TOOL_IDS) expect(en).toContain(`href="${toolPath(id, 'en')}"`);
    expect(en).toContain('href="/pl/"');
    expect(first(en, /hreflang="pl" href="([^"]*)"/)).toBe(`${SITE}/pl/`);

    const pl = await raw(request, '/pl/');
    expect(first(pl, /<html lang="([^"]+)">/)).toBe('pl');
    expect(first(pl, /<title>([^<]*)<\/title>/)).toBe(HOME_PL.title);
    expect(first(pl, /<link rel="canonical" href="([^"]*)"/)).toBe(`${SITE}/pl/`);
    for (const id of TOOL_IDS) expect(pl).toContain(`href="${toolPath(id, 'pl')}"`);
  });

  test('sitemap lists every page with its language alternates', async ({ request }) => {
    const res = await request.get('/sitemap.xml');
    expect(res.status()).toBe(200);
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    const expected = [homePath('en'), homePath('pl'), ...TOOL_IDS.flatMap((id) => LANGS.map((l) => toolPath(id, l))), '/llms.txt'].map((p) => SITE + p);
    expect(locs.sort()).toEqual(expected.sort());
    for (const id of TOOL_IDS) expect(xml).toContain(`<xhtml:link rel="alternate" hreflang="pl" href="${SITE}${toolPath(id, 'pl')}" />`);
  });

  test('llms.txt links every tool page', async ({ request }) => {
    const text = await (await request.get('/llms.txt')).text();
    for (const id of TOOL_IDS) for (const lang of LANGS) expect(text).toContain(`(${SITE}${toolPath(id, lang)})`);
  });

  test('unknown addresses are a real 404; a trailing slash redirects to the page', async ({ request }) => {
    const res = await request.get('/no-such-tool', { maxRedirects: 0 });
    expect(res.status()).toBe(404);
    expect(await res.text()).toContain('Page not found');
    expect((await request.get('/pl/no-such-tool', { maxRedirects: 0 })).status()).toBe(404);

    const slash = await request.get('/merge-pdf/', { maxRedirects: 0 });
    expect(slash.status()).toBe(308);
    expect(slash.headers()['location']).toBe('/merge-pdf');
    // Files the app needs are still served.
    expect((await request.get('/version.json')).status()).toBe(200);
    expect((await request.get('/favicon.svg')).status()).toBe(200);
  });
});

test.describe('path routing in the app', () => {
  test('a tool address opens the tool', async ({ page }) => {
    const csp = cspViolations(page);
    await page.goto('/merge-pdf');
    await expect(page.getByRole('heading', { name: 'Merge PDF', level: 1 })).toBeVisible();
    await expect(page.locator('.nav-item.on')).toHaveText(/Merge PDF/);
    await expect(page).toHaveTitle(/Merge PDF/);
    expect(csp).toEqual([]);
  });

  test('every sidebar link is a clean tool address', async ({ page }) => {
    await page.goto('/');
    const hrefs = await page.locator('.nav-item').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(hrefs).toEqual(['/', ...TOOL_IDS.map((id) => toolPath(id, 'en'))]);
  });

  test('navigation updates the address, and Back and Forward work', async ({ page }) => {
    const csp = cspViolations(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.locator('.nav-item', { hasText: 'Split PDF' }).click();
    await expect(page).toHaveURL(/\/split-pdf$/);
    await expect(page.getByRole('heading', { name: 'Split PDF', level: 1 })).toBeVisible();
    await page.locator('.nav-item', { hasText: 'Merge PDF' }).click();
    await expect(page).toHaveURL(/\/merge-pdf$/);
    await expect(page.getByRole('heading', { name: 'Merge PDF', level: 1 })).toBeVisible();

    await page.goBack();
    await expect(page).toHaveURL(/\/split-pdf$/);
    await expect(page.getByRole('heading', { name: 'Split PDF', level: 1 })).toBeVisible();
    await page.goBack();
    await expect(page).toHaveURL(/:\d+\/$/);
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole('heading', { name: 'Split PDF', level: 1 })).toBeVisible();

    // The in-app switch didn't reload the page: the same document is still loaded.
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);
    await page.locator('.nav-brand').click();
    await expect(page).toHaveURL(/:\d+\/$/);
    expect(csp).toEqual([]);
  });

  test('old #/tool/<id> and #/ links still work and become clean addresses', async ({ page }) => {
    await page.goto('/#/tool/merge');
    await expect(page.getByRole('heading', { name: 'Merge PDF', level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/merge-pdf$/);

    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect(page).toHaveURL(/:\d+\/$/);

    // A hash link followed inside the running app (e.g. from Fill PDF form).
    await page.evaluate(() => (location.hash = '#/tool/rotate'));
    await expect(page.getByRole('heading', { name: 'Rotate PDF', level: 1 })).toBeVisible();
    await expect(page).toHaveURL(/\/rotate-pdf$/);
  });

  test('a Polish page opens the same tool and keeps Polish addresses', async ({ page }) => {
    const csp = cspViolations(page);
    await page.goto('/pl/polacz-pdf');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page.getByRole('heading', { name: 'Merge PDF', level: 1 })).toBeVisible();
    await expect(page.locator('.nav-item', { hasText: 'Split PDF' })).toHaveAttribute('href', '/pl/podziel-pdf');
    await page.locator('.nav-item', { hasText: 'Split PDF' }).click();
    await expect(page).toHaveURL(/\/pl\/podziel-pdf$/);
    await expect(page.getByRole('heading', { name: 'Split PDF', level: 1 })).toBeVisible();
    await page.locator('.nav-item', { hasText: 'Dashboard' }).click();
    await expect(page).toHaveURL(/\/pl\/$/);

    await page.goto('/pl/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    expect(csp).toEqual([]);
  });

  test('the tool page survives a reload', async ({ page }) => {
    await page.goto('/qr-code-generator');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'QR code generator', level: 1 })).toBeVisible();
  });
});
