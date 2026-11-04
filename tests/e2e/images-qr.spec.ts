import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { alphaStats, cspViolations, expectRedBlue, imageHalves, makePng, openTool, runAndDownload, staticFixture } from './helpers';

test.describe('images', () => {
  test('convert PNG to WebP', async ({ page }) => {
    await openTool(page, 'image-converter');
    await page.locator('.file-drop input').setInputFiles(await makePng(page, 'photo.png', 'subject'));
    await page.getByRole('radio', { name: 'WebP' }).click();
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('photo.webp');
    expect(bytes.subarray(0, 4).toString('latin1')).toBe('RIFF');
    expect(bytes.subarray(8, 12).toString('latin1')).toBe('WEBP');
    await expect(page.locator('.results-note')).toContainText('EXIF');
  });

  test('resize limits the image size', async ({ page }) => {
    await openTool(page, 'image-converter');
    await page.locator('.file-drop input').setInputFiles(await makePng(page, 'photo.png', 'subject'));
    await page.getByRole('radio', { name: 'PNG' }).click();
    await page.getByText('Shrink images larger than').click();
    await page.locator('.field', { hasText: 'Max width' }).locator('input').fill('300');
    const { bytes } = await runAndDownload(page);
    const size = await page.evaluate(async (b64) => {
      const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      return [bmp.width, bmp.height];
    }, bytes.toString('base64'));
    expect(size).toEqual([300, 200]);
  });

  test('HEIC to JPG decodes an iPhone photo under the Content-Security-Policy', async ({ page }) => {
    const csp = cspViolations(page);
    await openTool(page, 'heic-to-jpg');
    // 320×160 px, left half red, right half blue (see tests/fixtures/README.md).
    await page.locator('.file-drop input').setInputFiles({ name: 'IMG_0001.HEIC', mimeType: 'image/heic', buffer: fs.readFileSync(staticFixture('sample.heic')) });
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('IMG_0001.jpg');
    expect([...bytes.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff]);
    const halves = await imageHalves(page, bytes);
    expect([halves.width, halves.height]).toEqual([320, 160]);
    expectRedBlue(halves);
    expect(csp).toEqual([]);
  });

  test('remove a plain background colour', async ({ page }) => {
    await openTool(page, 'remove-background');
    await page.locator('.file-drop input').setInputFiles(await makePng(page, 'logo.png', 'logo'));
    await page.getByRole('radio', { name: /Plain colour/ }).click();
    const { name, bytes } = await runAndDownload(page);
    expect(name).toBe('logo_cutout.png');
    // The logo block covers a quarter of the image; everything else becomes transparent.
    const { transparent, opaque } = await alphaStats(page, bytes);
    expect(transparent).toBeGreaterThan(0.7);
    expect(opaque).toBeGreaterThan(0.2);
    expect(opaque).toBeLessThan(0.3);
  });

  test('remove background with the on-device AI model', async ({ page }) => {
    await openTool(page, 'remove-background');
    await page.locator('.file-drop input').setInputFiles(await makePng(page, 'photo.png', 'subject'));
    const { bytes } = await runAndDownload(page);
    // The disc is about 19% of the picture.
    const { transparent, opaque } = await alphaStats(page, bytes);
    expect(transparent).toBeGreaterThan(0.6);
    expect(opaque).toBeGreaterThan(0.12);
    expect(opaque).toBeLessThan(0.3);
  });
});

test.describe('QR code generator', () => {
  test('renders a link and downloads PNG and SVG', async ({ page }) => {
    await openTool(page, 'qr');
    await expect(page.locator('.qr-image svg')).toBeVisible();
    await page.locator('.option', { hasText: 'Link' }).locator('input').fill('https://example.com/faktura');

    const [png] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download PNG' }).click()]);
    expect(png.suggestedFilename()).toBe('qr-code.png');
    const [svg] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download SVG' }).click()]);
    expect(svg.suggestedFilename()).toBe('qr-code.svg');
  });

  test('Wi-Fi form shows its own fields and an empty form shows no code', async ({ page }) => {
    await openTool(page, 'qr');
    await page.getByRole('radio', { name: 'Wi-Fi' }).click();
    await expect(page.locator('.option-label', { hasText: 'Network name' })).toBeVisible();
    await expect(page.getByText('Fill in the form')).toBeVisible();
    await page.locator('.option', { hasText: 'Network name' }).locator('input').fill('Office-Guest');
    await expect(page.locator('.qr-image svg')).toBeVisible();
  });
});
