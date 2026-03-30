import { test, expect } from '@playwright/test';

/**
 * PWA smoke tests — no auth required.
 * These verify the static infrastructure: manifest, offline page, login screen.
 */

test.describe('PWA — static assets', () => {
  test('manifest.json is accessible and valid', async ({ request }) => {
    const res = await request.get('/manifest.json');
    expect(res.status()).toBe(200);

    const manifest = await res.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe('standalone');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);
  });

  test('icon files are accessible', async ({ request }) => {
    const icon192 = await request.get('/icons/icon-192.png');
    expect(icon192.status()).toBe(200);
    expect(icon192.headers()['content-type']).toContain('image/png');

    const icon512 = await request.get('/icons/icon-512.png');
    expect(icon512.status()).toBe(200);
    expect(icon512.headers()['content-type']).toContain('image/png');
  });

  test('offline page renders', async ({ page }) => {
    await page.goto('/offline');
    await expect(page.getByRole('heading')).toContainText('offline');
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible();
  });

  test('login page has correct title', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveTitle(/B2B Platform/i);
  });

  test('manifest link tag is in HTML head', async ({ page }) => {
    await page.goto('/login');
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toHaveAttribute('href', '/manifest.json');
  });

  test('viewport meta tag is present', async ({ page }) => {
    await page.goto('/login');
    const viewportMeta = page.locator('meta[name="viewport"]');
    const content = await viewportMeta.getAttribute('content');
    expect(content).toContain('width=device-width');
    expect(content).toContain('initial-scale=1');
  });
});
