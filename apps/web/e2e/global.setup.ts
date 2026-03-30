import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_DIR = path.join(__dirname, '.auth');
const AUTH_STATE_PATH = path.join(AUTH_DIR, 'user.json');

/**
 * Runs once before all test suites.
 * Logs in as peakOwner, saves cookie/localStorage state to disk.
 * All authenticated tests reuse this state — avoids hitting the rate limiter.
 */
export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  });
  const page = await context.newPage();

  await page.goto('/login');
  await page.getByLabel(/email/i).fill('owner@peak-hardware.test');
  await page.getByLabel(/password/i).fill('Password123!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/t\/.+/, { timeout: 15_000 });

  await context.storageState({ path: AUTH_STATE_PATH });
  await browser.close();
}
