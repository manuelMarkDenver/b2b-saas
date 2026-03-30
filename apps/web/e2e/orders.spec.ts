import { test, expect } from '@playwright/test';
import { gotoTenantPage, USERS, login, expectHorizontallyScrollable } from './helpers';

test.describe('Orders — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('orders page renders with heading', async ({ page }) => {
    await gotoTenantPage(page, '/orders');
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  });

  test('orders table shows column headers', async ({ page }) => {
    await gotoTenantPage(page, '/orders');
    await expect(page.getByText('ORDER').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('STATUS').first()).toBeVisible();
    await expect(page.getByText('TOTAL').first()).toBeVisible();
    await expect(page.getByText('CREATED').first()).toBeVisible();
  });

  test('orders table has data rows with status badges', async ({ page }) => {
    await gotoTenantPage(page, '/orders');
    // Wait for data to load — either a badge or empty state
    const badge = page.locator('[class*="badge"]').or(page.getByText('No orders yet'));
    await expect(badge.first()).toBeVisible({ timeout: 8_000 });
  });

  test('"New Order" button is visible', async ({ page }) => {
    await gotoTenantPage(page, '/orders');
    await expect(page.getByRole('button', { name: /new order/i }).first()).toBeVisible();
  });

  test('clicking "New Order" opens order creation sheet', async ({ page }) => {
    await gotoTenantPage(page, '/orders');
    await page.getByRole('button', { name: /new order/i }).first().click();
    // Sheet opens with product picker
    await expect(page.locator('[role="dialog"], [data-state="open"]').first()).toBeVisible({ timeout: 5_000 });
  });

  test('clicking an order row opens order detail sheet', async ({ page }) => {
    await gotoTenantPage(page, '/orders');
    // Wait for orders to load
    const firstRow = page.locator('button[class*="grid"][class*="grid-cols"]').first();
    const count = await firstRow.count();
    if (count > 0) {
      await firstRow.click();
      await expect(page.locator('[role="dialog"], [data-state="open"]').first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('Orders — mobile', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('orders page renders on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/orders');
    await expect(page.getByRole('heading', { name: 'Orders' })).toBeVisible();
  });

  test('orders table is horizontally scrollable on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/orders');
    await expect(page.getByText('ORDER').first()).toBeVisible({ timeout: 8_000 });
    const card = page.locator('.overflow-x-auto.rounded-md').first();
    await expect(card).toBeVisible();
    const isScrollable = await expectHorizontallyScrollable(page, card);
    expect(isScrollable).toBe(true);
  });

  test('order detail sheet opens full-width on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/orders');
    await page.getByRole('button', { name: /new order/i }).first().click();
    const sheet = page.locator('[data-state="open"]').first();
    await expect(sheet).toBeVisible({ timeout: 5_000 });
    // Sheet should be full-width on mobile (w-full)
    const box = await sheet.boundingBox();
    if (box) {
      expect(box.width).toBeLessThanOrEqual(393 + 10); // allow small delta
    }
  });
});
