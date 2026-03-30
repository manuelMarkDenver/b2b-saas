import { type Page } from '@playwright/test';

export const USERS = {
  peakOwner: { email: 'owner@peak-hardware.test', password: 'Password123!' },
  cornerOwner: { email: 'owner@corner-general.test', password: 'Password123!' },
  peakStaff: { email: 'staff@peak-hardware.test', password: 'Password123!' },
};

// Known slug for the primary test tenant (peak-hardware seed data)
export const PEAK_SLUG = 'peak-hardware';

/**
 * Log in as a user via the login form. Returns the tenant slug extracted from the redirect URL.
 * Only used in auth.spec.ts — all other tests use storageState from global.setup.ts.
 */
export async function login(page: Page, email: string, password: string): Promise<string> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/t\/.+/, { timeout: 10_000 });
  return page.url().match(/\/t\/([^/]+)/)?.[1] ?? '';
}

/**
 * Navigate to a tenant page. Auth state is pre-loaded via storageState — no login needed.
 */
export async function gotoTenantPage(page: Page, path: string): Promise<string> {
  await page.goto(`/t/${PEAK_SLUG}${path}`);
  return PEAK_SLUG;
}

/**
 * Check that a table container has overflow-x: auto (horizontally scrollable).
 */
export async function expectHorizontallyScrollable(page: Page, locator: ReturnType<Page['locator']>) {
  await locator.waitFor({ state: 'visible' });
  const overflow = await locator.evaluate((el) =>
    window.getComputedStyle(el).overflowX
  );
  return overflow === 'auto' || overflow === 'scroll';
}
