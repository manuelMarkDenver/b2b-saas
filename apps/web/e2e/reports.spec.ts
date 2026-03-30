import { test, expect } from '@playwright/test';
import { gotoTenantPage, expectHorizontallyScrollable } from './helpers';

test.describe('Reports — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('reports page renders with heading', async ({ page }) => {
    await gotoTenantPage(page, '/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
    await expect(page.getByText('View and export your order data')).toBeVisible();
  });

  test('date range picker is visible', async ({ page }) => {
    await gotoTenantPage(page, '/reports');
    const picker = page.getByRole('button', { name: /last 7 days|today|this month|last 30|last 3 months/i }).first();
    await expect(picker).toBeVisible({ timeout: 5_000 });
  });

  test('export CSV button is visible', async ({ page }) => {
    await gotoTenantPage(page, '/reports');
    await expect(page.getByRole('button', { name: /export csv/i })).toBeVisible();
  });

  test('orders table shows column headers', async ({ page }) => {
    await gotoTenantPage(page, '/reports');
    await expect(page.getByText('ORDER').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText('DATE').first()).toBeVisible();
    await expect(page.getByText('STATUS').first()).toBeVisible();
    await expect(page.getByText('TOTAL').first()).toBeVisible();
  });

  test('date range picker changes selection', async ({ page }) => {
    await gotoTenantPage(page, '/reports');
    const picker = page.getByRole('button', { name: /last 7 days|today|this month|last 30|last 3 months/i }).first();
    await picker.click();
    await expect(page.getByRole('button', { name: /last 7 days/i })).toBeVisible();
    await page.getByRole('button', { name: /last 7 days/i }).click();
    await expect(picker).toBeVisible();
  });
});

test.describe('Reports — mobile', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('reports page renders on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible();
  });

  test('orders table is horizontally scrollable on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/reports');
    await expect(page.getByText('ORDER').first()).toBeVisible({ timeout: 8_000 });
    const card = page.locator('.overflow-x-auto.rounded-md').first();
    await expect(card).toBeVisible();
    const isScrollable = await expectHorizontallyScrollable(page, card);
    expect(isScrollable).toBe(true);
  });
});
