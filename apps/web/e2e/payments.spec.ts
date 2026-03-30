import { test, expect } from '@playwright/test';
import { gotoTenantPage, expectHorizontallyScrollable } from './helpers';

test.describe('Payments — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('payments page renders with heading', async ({ page }) => {
    await gotoTenantPage(page, '/payments');
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
  });

  test('Payables and Payments tabs are visible', async ({ page }) => {
    await gotoTenantPage(page, '/payments');
    await expect(page.getByRole('tab', { name: /payables/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('tab', { name: /payments/i })).toBeVisible();
  });

  test('payables tab shows orders table with column headers', async ({ page }) => {
    await gotoTenantPage(page, '/payments');
    // Payables tab is active by default
    await expect(page.getByText('ORDER').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('STATUS').first()).toBeVisible();
    await expect(page.getByText('TOTAL').first()).toBeVisible();
  });

  test('switching to payments tab shows payments table', async ({ page }) => {
    await gotoTenantPage(page, '/payments');
    await page.getByRole('tab', { name: /^payments$/i }).click();
    await expect(page.getByText('PAYMENT').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('AMOUNT').first()).toBeVisible();
    await expect(page.getByText('STATUS').first()).toBeVisible();
  });

  test('clicking an order in payables opens order detail sheet', async ({ page }) => {
    await gotoTenantPage(page, '/payments');
    const orderRow = page.locator('button[class*="grid-cols"]').first();
    if (await orderRow.count() > 0) {
      await orderRow.click();
      await expect(page.locator('[role="dialog"], [data-state="open"]').first()).toBeVisible({ timeout: 5_000 });
    }
  });
});

test.describe('Payments — mobile', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('payments page renders on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/payments');
    await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();
  });

  test('payables table is horizontally scrollable on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/payments');
    await expect(page.getByText('ORDER').first()).toBeVisible({ timeout: 8_000 });
    const card = page.locator('.overflow-x-auto.rounded-md').first();
    await expect(card).toBeVisible();
    const isScrollable = await expectHorizontallyScrollable(page, card);
    expect(isScrollable).toBe(true);
  });

  test('payments history table is horizontally scrollable on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/payments');
    await page.getByRole('tab', { name: /^payments$/i }).click();
    await expect(page.getByText('PAYMENT').first()).toBeVisible({ timeout: 8_000 });
    const cards = page.locator('.overflow-x-auto.rounded-md');
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
    const isScrollable = await expectHorizontallyScrollable(page, cards.first());
    expect(isScrollable).toBe(true);
  });
});
