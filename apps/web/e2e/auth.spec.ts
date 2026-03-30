import { test, expect } from '@playwright/test';

/**
 * Auth flow tests — verifies login UI, redirects, and session handling.
 * Full API must be running for login tests.
 */

test.describe('Auth', () => {
  test('unauthenticated visit to /login shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('invalid credentials shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('nobody@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should show an error, not redirect
    await expect(page.getByRole('alert').or(page.locator('[class*="destructive"]'))).toBeVisible({
      timeout: 5_000,
    });
    expect(page.url()).toContain('/login');
  });

  test('successful login redirects to tenant dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('owner@peak-hardware.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Should redirect to a tenant dashboard
    await page.waitForURL(/\/t\/.+/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/t\/.+/);
  });

  test('authenticated user visiting /login is redirected', async ({ page, context }) => {
    // Login first
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('owner@peak-hardware.test');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL(/\/t\/.+/, { timeout: 10_000 });

    // Now visit /login again — should redirect away
    await page.goto('/login');
    await page.waitForURL(/\/t\/.+/, { timeout: 5_000 });
    expect(page.url()).not.toContain('/login');
  });
});
