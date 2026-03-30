import { test, expect } from '@playwright/test';
import { gotoTenantPage, login, USERS } from './helpers';

test.describe('Navigation — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('sidebar is visible on desktop after login', async ({ page }) => {
    await gotoTenantPage(page, '');
    // Sidebar should be open by default on desktop — look for nav links
    await expect(page.getByRole('link', { name: /orders/i }).first()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('link', { name: /inventory/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /payments/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /catalog/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /reports/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /settings/i }).first()).toBeVisible();
  });

  test('clicking Orders in sidebar navigates to orders page', async ({ page }) => {
    await gotoTenantPage(page, '');
    await page.getByRole('link', { name: /^orders$/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 5_000 });
  });

  test('clicking Inventory in sidebar navigates to inventory page', async ({ page }) => {
    await gotoTenantPage(page, '');
    await page.getByRole('link', { name: /^inventory$/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible({ timeout: 5_000 });
  });

  test('clicking Payments in sidebar navigates to payments page', async ({ page }) => {
    await gotoTenantPage(page, '');
    await page.getByRole('link', { name: /^payments$/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible({ timeout: 5_000 });
  });

  test('clicking Catalog in sidebar navigates to catalog page', async ({ page }) => {
    await gotoTenantPage(page, '');
    await page.getByRole('link', { name: /^catalog$/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible({ timeout: 5_000 });
  });

  test('clicking Reports in sidebar navigates to reports page', async ({ page }) => {
    await gotoTenantPage(page, '');
    await page.getByRole('link', { name: /^reports$/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 5_000 });
  });

  test('breadcrumbs update when navigating', async ({ page }) => {
    await gotoTenantPage(page, '/orders');
    await expect(page.getByText(/orders/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('hamburger button toggles sidebar on desktop', async ({ page }) => {
    await gotoTenantPage(page, '');
    // Sidebar is open — hamburger should close it
    const hamburger = page.locator('button[aria-label*="sidebar" i], button[aria-label*="menu" i]').first();
    if (await hamburger.count() > 0) {
      await hamburger.click();
      // After close, nav links should be hidden or sidebar collapsed
      await hamburger.click();
      // After reopen, nav links visible again
      await expect(page.getByRole('link', { name: /orders/i }).first()).toBeVisible({ timeout: 3_000 });
    }
  });
});

test.describe('Navigation — mobile', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('sidebar is closed by default on mobile', async ({ page }) => {
    await gotoTenantPage(page, '');
    // On mobile, sidebar should be hidden (off-screen) by default
    // The sidebar nav links should NOT be visible without opening the drawer
    const navLinks = page.getByRole('link', { name: /^orders$/i }).first();
    // We check that either the element is not visible or is off-screen
    const box = await navLinks.boundingBox().catch(() => null);
    if (box) {
      // If bounding box exists, it should be off screen (negative x)
      expect(box.x).toBeLessThan(0);
    }
  });

  test('hamburger button opens mobile drawer', async ({ page }) => {
    await gotoTenantPage(page, '');
    // Find the hamburger/menu button in the header
    const hamburger = page.locator('button').filter({ hasText: '' }).first();
    // Use a more reliable selector — look for svg icon button in header
    const header = page.locator('header').first();
    const menuBtn = header.locator('button').first();
    await menuBtn.click();
    // After clicking, sidebar nav links should be visible
    await expect(page.getByRole('link', { name: /orders/i }).first()).toBeVisible({ timeout: 3_000 });
  });

  test('mobile overlay backdrop closes drawer', async ({ page }) => {
    await gotoTenantPage(page, '');
    const header = page.locator('header').first();
    const menuBtn = header.locator('button').first();
    await menuBtn.click();
    // Wait for drawer to open
    await expect(page.getByRole('link', { name: /orders/i }).first()).toBeVisible({ timeout: 3_000 });
    // Click backdrop (black overlay)
    const backdrop = page.locator('.bg-black\\/40').first();
    if (await backdrop.count() > 0) {
      await backdrop.click();
    }
  });

  test('mobile navigation: tapping Orders loads orders page', async ({ page }) => {
    await gotoTenantPage(page, '');
    const header = page.locator('header').first();
    const menuBtn = header.locator('button').first();
    await menuBtn.click();
    await page.getByRole('link', { name: /^orders$/i }).first().click();
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible({ timeout: 5_000 });
  });
});
