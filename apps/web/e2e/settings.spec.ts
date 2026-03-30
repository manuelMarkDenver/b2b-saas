import { test, expect } from '@playwright/test';
import { gotoTenantPage } from './helpers';

test.describe('Settings — desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('settings redirects to profile page', async ({ page }) => {
    await gotoTenantPage(page, '/settings');
    await page.waitForURL(/\/settings\/profile/, { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('profile settings page renders workspace profile section', async ({ page }) => {
    await gotoTenantPage(page, '/settings/profile');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText(/workspace profile/i)).toBeVisible({ timeout: 8_000 });
  });

  test('settings nav links are visible on desktop', async ({ page }) => {
    await gotoTenantPage(page, '/settings/profile');
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('link', { name: /team/i })).toBeVisible();
  });

  test('clicking team nav link navigates to team page', async ({ page }) => {
    await gotoTenantPage(page, '/settings/profile');
    await page.getByRole('link', { name: /team/i }).click();
    await page.waitForURL(/\/settings\/team/, { timeout: 5_000 });
    await expect(page.getByRole('heading', { name: /team/i })).toBeVisible();
  });

  test('team settings page shows members section', async ({ page }) => {
    await gotoTenantPage(page, '/settings/team');
    await expect(page.getByRole('heading', { name: /team/i })).toBeVisible();
    await expect(page.getByText(/members/i).first()).toBeVisible({ timeout: 8_000 });
  });

  test('team settings page shows add/invite member controls', async ({ page }) => {
    await gotoTenantPage(page, '/settings/team');
    // Owner should see add/invite button
    await expect(
      page.getByRole('button', { name: /invite|add member/i }).first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('branches settings page renders', async ({ page }) => {
    await gotoTenantPage(page, '/settings/branches');
    await expect(page.getByText(/branch/i).first()).toBeVisible({ timeout: 8_000 });
  });
});

test.describe('Settings — mobile', () => {
  test.use({ viewport: { width: 393, height: 851 } });

  test('settings profile page renders on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/settings/profile');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('settings nav is horizontal (pill-style) on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/settings/profile');
    await expect(page.getByRole('link', { name: /profile/i })).toBeVisible({ timeout: 5_000 });
    // On mobile the nav is flex-row — both links should be visible without scrolling
    await expect(page.getByRole('link', { name: /team/i })).toBeVisible();
    const profileLink = page.getByRole('link', { name: /profile/i }).first();
    const teamLink = page.getByRole('link', { name: /team/i }).first();
    const profileBox = await profileLink.boundingBox();
    const teamBox = await teamLink.boundingBox();
    // On mobile they should be on the same row (within a few px of same y)
    if (profileBox && teamBox) {
      expect(Math.abs(profileBox.y - teamBox.y)).toBeLessThan(20);
    }
  });

  test('team settings page renders on mobile', async ({ page }) => {
    await gotoTenantPage(page, '/settings/team');
    await expect(page.getByRole('heading', { name: /team/i })).toBeVisible();
  });
});
