import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const AUTH_DIR = path.join(__dirname, '.auth');
const AUTH_STATE_PATH = path.join(AUTH_DIR, 'user.json');

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

/**
 * Runs once before all test suites.
 * Logs in via the API directly (not the browser form) to avoid the rate limiter,
 * then stores the JWT in localStorage so all test contexts are pre-authenticated.
 */
export default async function globalSetup() {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  // 1. Get JWT from API directly — no browser form, no rate-limiter hit
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@peak-hardware.test', password: 'Password123!' }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Login failed (${res.status}): ${text}`);
  }

  const { token } = await res.json() as { token: string };

  // 2. Open a browser, inject the JWT into localStorage, navigate to the tenant
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL: BASE_URL });
  const page = await context.newPage();

  await page.goto('/login');
  await page.evaluate((jwt) => {
    localStorage.setItem('token', jwt);
  }, token);

  // 3. Save auth state (localStorage with JWT) for all test contexts to reuse
  await context.storageState({ path: AUTH_STATE_PATH });
  await browser.close();
}
