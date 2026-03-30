import { test, expect, type Page } from '@playwright/test';

/**
 * Mobile responsive tests — verifies layout behaviour on narrow viewports.
 * Uses the Pixel 5 device profile (393×851) by default.
 */

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/t\/.+/, { timeout: 10_000 });
}

test.describe('Mobile responsive — sidebar', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('sidebar is hidden on mobile by default', async ({ page }) => {
    await loginAs(page, 'owner@peak-hardware.test', 'password123');

    // Sidebar element should be off-screen (translated left)
    const sidebarWrapper = page.locator('.fixed.inset-y-0.left-0').first();
    await expect(sidebarWrapper).toHaveCSS('transform', /matrix\(-1/);
  });

  test('hamburger button is visible on mobile', async ({ page }) => {
    await loginAs(page, 'owner@peak-hardware.test', 'password123');
    await expect(page.getByRole('button', { name: /toggle sidebar/i })).toBeVisible();
  });

  test('clicking hamburger opens sidebar drawer', async ({ page }) => {
    await loginAs(page, 'owner@peak-hardware.test', 'password123');

    const hamburger = page.getByRole('button', { name: /toggle sidebar/i });
    await hamburger.click();

    // Backdrop should appear
    await expect(page.locator('.fixed.inset-0.bg-black\\/40')).toBeVisible();

    // Sidebar should be on screen
    const sidebarWrapper = page.locator('.fixed.inset-y-0.left-0').first();
    await expect(sidebarWrapper).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  });

  test('clicking backdrop closes sidebar drawer', async ({ page }) => {
    await loginAs(page, 'owner@peak-hardware.test', 'password123');

    // Open sidebar
    await page.getByRole('button', { name: /toggle sidebar/i }).click();
    const backdrop = page.locator('.fixed.inset-0.bg-black\\/40');
    await expect(backdrop).toBeVisible();

    // Click backdrop to close
    await backdrop.click();
    await expect(backdrop).not.toBeVisible();
  });

  test('tenant switcher is hidden on mobile', async ({ page }) => {
    await loginAs(page, 'owner@peak-hardware.test', 'password123');
    // TenantSwitcher is in a hidden md:flex wrapper — not visible on mobile
    const tenantSwitcher = page.locator('[data-testid="tenant-switcher"]').or(
      page.locator('.hidden.md\\:flex').first()
    );
    // The wrapper div is hidden, so its children are not visible
    await expect(page.locator('.hidden.md\\:flex').first()).toBeHidden();
  });
});

test.describe('Mobile responsive — tables', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('orders table container is horizontally scrollable', async ({ page }) => {
    await loginAs(page, 'owner@peak-hardware.test', 'password123');
    await page.goto(page.url().replace(/\/$/, '') + '/orders');

    // The outer card should have overflow-x: auto
    const tableCard = page.locator('.overflow-x-auto.rounded-md').first();
    await expect(tableCard).toBeVisible();
    await expect(tableCard).toHaveCSS('overflow-x', 'auto');
  });

  test('header does not overflow at 393px viewport', async ({ page }) => {
    await loginAs(page, 'owner@peak-hardware.test', 'password123');

    const header = page.locator('header').first();
    const headerBox = await header.boundingBox();
    const viewportSize = page.viewportSize();

    expect(headerBox).not.toBeNull();
    // Header height should be reasonable (not taller than ~80px due to wrapping)
    expect(headerBox!.height).toBeLessThanOrEqual(80);
    // Header should not overflow viewport width
    expect(headerBox!.width).toBeLessThanOrEqual(viewportSize!.width + 1);
  });
});

test.describe('Desktop layout — sidebar', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('sidebar is visible by default on desktop', async ({ page }) => {
    await loginAs(page, 'owner@peak-hardware.test', 'password123');

    // On desktop, sidebar should be open (w-56 inline)
    const sidebarWrapper = page.locator('nav').filter({ hasText: 'Dashboard' }).first();
    await expect(sidebarWrapper).toBeVisible();
  });

  test('hamburger toggles sidebar inline on desktop', async ({ page }) => {
    await loginAs(page, 'owner@peak-hardware.test', 'password123');

    // Sidebar should start open on desktop
    const nav = page.locator('nav').filter({ hasText: 'Dashboard' }).first();
    await expect(nav).toBeVisible();

    // Click hamburger to close
    await page.getByRole('button', { name: /toggle sidebar/i }).click();
    // Nav still exists in DOM but sidebar wrapper collapses to w-0
    // The backdrop should NOT appear on desktop
    await expect(page.locator('.md\\:hidden.fixed.inset-0')).not.toBeVisible();
  });
});
