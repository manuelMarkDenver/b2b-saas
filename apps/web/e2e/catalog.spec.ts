import { test, expect } from '@playwright/test';
import { gotoTenantPage } from './helpers';

test.describe('Catalog — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('catalog page renders with heading', async ({ page }) => {
    await gotoTenantPage(page, '/catalog');
    await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
    await expect(page.getByText('Manage products and SKUs')).toBeVisible();
  });

  test('products list section is visible', async ({ page }) => {
    await gotoTenantPage(page, '/catalog');
    // Wait for categories/products to load
    await expect(page.getByText(/products/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('SKUs section is visible', async ({ page }) => {
    await gotoTenantPage(page, '/catalog');
    await expect(page.getByText(/SKUs/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('create product form has name input and category selector', async ({ page }) => {
    await gotoTenantPage(page, '/catalog');
    // Wait for the catalog panel to load
    await expect(page.locator('select').first()).toBeVisible({ timeout: 8_000 });
    await expect(page.locator('input[placeholder*="product" i]').or(page.locator('input[type="text"]')).first()).toBeVisible();
  });

  test('CSV import section is visible', async ({ page }) => {
    await gotoTenantPage(page, '/catalog');
    await expect(page.getByText(/import/i).first()).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('button', { name: /template/i })).toBeVisible();
  });

  test('download CSV template button is present', async ({ page }) => {
    await gotoTenantPage(page, '/catalog');
    await expect(page.getByRole('button', { name: /template/i })).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Catalog — mobile', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('catalog page renders on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/catalog');
    await expect(page.getByRole('heading', { name: 'Catalog' })).toBeVisible();
  });

  test('catalog panel sections are visible on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/catalog');
    await expect(page.getByText(/SKUs/i).first()).toBeVisible({ timeout: 8_000 });
  });
});
