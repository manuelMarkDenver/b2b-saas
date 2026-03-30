import { test, expect } from '@playwright/test';
import { gotoTenantPage, USERS, login, expectHorizontallyScrollable } from './helpers';

test.describe('Inventory — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('inventory page renders with heading', async ({ page }) => {
    await gotoTenantPage(page, '/inventory');
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
    await expect(page.getByText('Track stock levels and movement history')).toBeVisible();
  });

  test('stock levels and movements tabs exist', async ({ page }) => {
    await gotoTenantPage(page, '/inventory');
    await expect(page.getByRole('tab', { name: /stock levels/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /movements/i })).toBeVisible();
  });

  test('stock levels tab shows SKU count and current stock card', async ({ page }) => {
    await gotoTenantPage(page, '/inventory');
    await expect(page.getByText(/current stock/i)).toBeVisible({ timeout: 8_000 });
    // Table header columns
    await expect(page.getByText('PRODUCT').first()).toBeVisible();
    await expect(page.getByText('SKU CODE').first()).toBeVisible();
    await expect(page.getByText('ON HAND').first()).toBeVisible();
  });

  test('movements tab shows movement log', async ({ page }) => {
    await gotoTenantPage(page, '/inventory');
    await page.getByRole('tab', { name: /movements/i }).click();
    await expect(page.getByText(/movement log/i)).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('SKU').first()).toBeVisible();
    await expect(page.getByText('TYPE').first()).toBeVisible();
    await expect(page.getByText('QTY').first()).toBeVisible();
  });

  test('"Log movement" button opens dialog', async ({ page }) => {
    await gotoTenantPage(page, '/inventory');
    await page.getByRole('button', { name: /log movement/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/log.*movement/i)).toBeVisible();
  });

  test('log movement dialog has required fields', async ({ page }) => {
    await gotoTenantPage(page, '/inventory');
    await page.getByRole('button', { name: /log movement/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Type selector and quantity input
    await expect(dialog.getByText(/type/i).first()).toBeVisible();
    await expect(dialog.getByRole('spinbutton').or(dialog.locator('input[type="number"]')).first()).toBeVisible();
  });
});

test.describe('Inventory — mobile', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('inventory page renders on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/inventory');
    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  });

  test('stock levels table card is horizontally scrollable on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/inventory');
    await expect(page.getByText(/current stock/i)).toBeVisible({ timeout: 8_000 });
    // The outer card should have overflow-x: auto
    const card = page.locator('.overflow-x-auto.rounded-xl').first();
    await expect(card).toBeVisible();
    const isScrollable = await expectHorizontallyScrollable(page, card);
    expect(isScrollable).toBe(true);
  });

  test('movements table card is horizontally scrollable on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/inventory');
    await page.getByRole('tab', { name: /movements/i }).click();
    await expect(page.getByText(/movement log/i)).toBeVisible({ timeout: 5_000 });
    const cards = page.locator('.overflow-x-auto.rounded-xl');
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(1);
    const isScrollable = await expectHorizontallyScrollable(page, cards.first());
    expect(isScrollable).toBe(true);
  });
});
