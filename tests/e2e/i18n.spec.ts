import { expect, test } from '@playwright/test';
import { en } from '../../src/i18n/en';
import { pl } from '../../src/i18n/pl';
import { TOOL_PAGES } from '../../src/seo/content';
import { TOOL_IDS } from '../../src/utilities/routes';
import { cspViolations, fixture } from './helpers';

// The interface language: Polish under /pl/, English elsewhere, and the EN / PL switch
// that opens the same page in the other language (see src/i18n and TRANSLATING.md).

/** Every string in a dictionary, with functions called on sample arguments. */
function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'function') return strings((value as (...a: unknown[]) => unknown)(2, 2, 2));
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

test.describe('Polish interface', () => {
  test('/pl/polacz-pdf shows Polish labels and merges in Polish', async ({ page }) => {
    const csp = cspViolations(page);
    await page.goto('/pl/polacz-pdf');
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
    await expect(page.getByRole('heading', { name: 'Połącz PDF', level: 1 })).toBeVisible();
    await expect(page.locator('.tool-page-head .muted')).toHaveText(pl.tools.merge.description);
    await expect(page.locator('.file-drop')).toContainText('Dodaj pliki PDF');
    await expect(page.locator('.run-bar .btn.primary')).toHaveText('Połącz PDF');
    await expect(page.locator('.nav-item').first()).toHaveText('Pulpit');
    await expect(page.getByPlaceholder('Szukaj narzędzi')).toBeVisible();
    await expect(page.locator('.nav-group').first()).toHaveText('Edycja i podpis');
    await expect(page).toHaveTitle(/^Połącz PDF/);

    await page.locator('.file-drop input').setInputFiles([fixture('invoice.pdf'), fixture('invoice-changed.pdf')]);
    await expect(page.locator('.file-list li').first().getByTitle('Przesuń niżej')).toBeVisible();
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.results-head')).toContainText('Gotowe: 1 plik');
    await expect(page.locator('.results-head')).toContainText('Otwórz w edytorze');
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('.results-head button', { hasText: 'Pobierz' }).click()]);
    expect(download.suggestedFilename()).toBe('invoice_merged.pdf');

    // Nothing on the page is left in English.
    const text = await page.locator('.shell').innerText();
    for (const english of ['Merge', 'Dashboard', 'Add PDF files', 'Download', 'Open in editor', 'Search tools', 'Done:', 'Move up']) {
      expect(text, english).not.toContain(english);
    }
    expect(csp).toEqual([]);
  });

  test('the language switch opens the same page in the other language', async ({ page }) => {
    await page.goto('/pl/polacz-pdf');
    const sw = page.locator('.lang-switch');
    await expect(sw.getByRole('link', { name: 'English' })).toHaveAttribute('href', '/merge-pdf');
    await expect(sw.getByRole('link', { name: 'Polski' })).toHaveAttribute('aria-current', 'true');

    await sw.getByRole('link', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/merge-pdf$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Merge PDF', level: 1 })).toBeVisible();
    await expect(page.locator('.run-bar .btn.primary')).toHaveText(/^Merge\s+files$/);
    await expect(page.locator('.nav-item').first()).toHaveText('Dashboard');
    await expect(sw.getByRole('link', { name: 'Polski' })).toHaveAttribute('href', '/pl/polacz-pdf');

    await sw.getByRole('link', { name: 'Polski' }).click();
    await expect(page).toHaveURL(/\/pl\/polacz-pdf$/);
    await expect(page.getByRole('heading', { name: 'Połącz PDF', level: 1 })).toBeVisible();

    // Back returns to the English page, in English.
    await page.goBack();
    await expect(page).toHaveURL(/\/merge-pdf$/);
    await expect(page.getByRole('heading', { name: 'Merge PDF', level: 1 })).toBeVisible();

    // From the dashboard the switch goes to the other dashboard.
    await page.locator('.nav-brand').click();
    await sw.getByRole('link', { name: 'Polski' }).click();
    await expect(page).toHaveURL(/\/pl\/$/);
    await expect(page.getByRole('heading', { name: 'Pulpit' })).toBeVisible();
    await expect(page.locator('.tool-card', { hasText: 'Anonimizuj PDF' })).toHaveAttribute('href', '/pl/anonimizuj-pdf');

    // All of this without reloading the page.
    expect(await page.evaluate(() => performance.getEntriesByType('navigation').length)).toBe(1);
  });

  test('errors, counts and the search work in Polish', async ({ page }) => {
    await page.goto('/pl/podziel-pdf');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await expect(page.locator('.single-file')).toContainText('2 strony');
    await page.getByRole('radio', { name: 'Według zakresów' }).click();
    await page.locator('.option input.text-field').fill('1-9');
    await page.locator('.run-bar .btn.primary').click();
    await expect(page.locator('.run-bar .error-text')).toHaveText('„1-9” wykracza poza strony 1–2.');

    // The search ignores Polish accents and also finds English names.
    const search = page.getByPlaceholder('Szukaj narzędzi');
    await search.fill('polacz');
    await expect(page.locator('.nav-item')).toHaveText(['Połącz PDF']);
    await search.fill('redact');
    await expect(page.locator('.nav-item')).toHaveText(['Anonimizuj PDF']);
    await search.fill('nic-takiego');
    await expect(page.getByText('Żadne narzędzie nie pasuje do „nic-takiego”.')).toBeVisible();
  });

  test('the editor is in Polish too', async ({ page }) => {
    await page.goto('/pl/anonimizuj-pdf');
    await expect(page.locator('.run-bar .btn.primary')).toHaveText('Anonimizuj i zapisz');
    await page.goto('/pl/edytuj-pdf');
    await page.locator('.file-drop input').setInputFiles(fixture('invoice.pdf'));
    await expect(page.getByRole('button', { name: 'Pobierz PDF' })).toBeVisible();
    await expect(page.locator('.tool-item', { hasText: 'Korektor' })).toBeVisible();
    await expect(page.locator('.pages-panel .panel-title')).toContainText('Strony');
    await expect(page.locator('.snippet', { hasText: 'Zatwierdzono do zapłaty' })).toBeVisible();
    await page.getByTitle('Wróć do pulpitu').click();
    await expect(page).toHaveURL(/\/pl\/$/);
    await expect(page.locator('.recent')).toContainText('Ostatnie dokumenty');
    await expect(page.locator('.recent .card')).toContainText('2 strony · 0 zmian');
  });
});

test.describe('language choice', () => {
  test.use({ locale: 'pl-PL' });

  test('on the web the address decides, not the browser language', async ({ page }) => {
    await page.goto('/merge-pdf');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { name: 'Merge PDF', level: 1 })).toBeVisible();
  });
});

test.describe('dictionaries', () => {
  test('every language has the same keys as English', () => {
    const shape = (v: unknown): unknown =>
      v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
    // TypeScript enforces this at build time; this also catches keys of the loosely typed maps.
    expect(shape(pl)).toEqual(shape(en));
  });

  test('Polish search pages quote button labels that exist in the Polish interface', () => {
    const labels = new Set(strings(pl));
    const quoted = TOOL_IDS.flatMap((id) => TOOL_PAGES[id].pl.steps.flatMap((s) => [...s.matchAll(/Kliknij „([^”]+)”/g)].map((m) => m[1])));
    expect(quoted.length).toBeGreaterThan(15);
    for (const label of quoted) expect(labels.has(label), label).toBe(true);
  });

  test('Polish strings use no em dashes, ellipses or arrows', () => {
    for (const s of strings(pl)) expect(s, s).not.toMatch(/[—…→←]| -- /);
  });
});
