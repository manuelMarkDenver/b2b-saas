import { test, expect } from '@playwright/test';
import { gotoTenantPage } from './helpers';

test.describe('Dashboard', () => {
  test('dashboard page renders with heading', async ({ page }) => {
    await gotoTenantPage(page, '');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByText('Overview of your inventory, orders, and payments')).toBeVisible();
  });

  test('stat cards are visible', async ({ page }) => {
    await gotoTenantPage(page, '');
    await expect(page.locator('[class*="font-bold"][class*="tabular-nums"]').first()).toBeVisible({
      timeout: 8_000,
    });
  });

  test('date range picker is visible and functional', async ({ page }) => {
    await gotoTenantPage(page, '');
    const picker = page.getByRole('button', { name: /last 7 days|today|this month|last 30|last 3 months/i }).first();
    await expect(picker).toBeVisible({ timeout: 5_000 });

    await picker.click();
    await expect(page.getByRole('button', { name: /today/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /last 7 days/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /this month/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /custom/i })).toBeVisible();

    await page.getByRole('button', { name: /^today$/i }).click();
    await expect(page.getByRole('button', { name: /today/i }).first()).toBeVisible();
  });

  test('custom date range inputs appear when Custom is selected', async ({ page }) => {
    await gotoTenantPage(page, '');
    const picker = page.getByRole('button', { name: /last 7 days|today|this month|last 30|last 3 months/i }).first();
    await picker.click();
    await page.getByRole('button', { name: /^custom$/i }).click();
    await expect(page.getByLabel(/^from$/i)).toBeVisible();
    await expect(page.getByLabel(/^to$/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^apply$/i })).toBeVisible();
  });
});

test.describe('Dashboard — mobile', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('dashboard renders on mobile viewport', async ({ page }) => {
    await gotoTenantPage(page, '');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const header = page.locator('header').first();
    const box = await header.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(394);
    expect(box!.height).toBeLessThanOrEqual(80);
  });
});
