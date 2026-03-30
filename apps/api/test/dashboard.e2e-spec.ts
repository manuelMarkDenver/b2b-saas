import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs } from './helpers/app.helper';

const TENANT_SLUG = 'peak-hardware';
const OTHER_SLUG = 'metro-pizza-supply';

describe('Dashboard (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let otherOwnerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner@peak-hardware.test');
    otherOwnerToken = await loginAs(app, 'owner@metro-pizza.test');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /dashboard', () => {
    it('returns summary and charts for authenticated owner', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG);

      expect(res.status).toBe(200);
      expect(res.body.summary).toMatchObject({
        ordersToday: expect.any(Number),
        pendingPayments: expect.any(Number),
        lowStockSkus: expect.any(Number),
        revenueRangeCents: expect.any(Number),
      });
      expect(res.body.charts).toMatchObject({
        ordersByStatus: expect.any(Object),
        ordersPerDay: expect.any(Array),
        revenuePerDay: expect.any(Array),
        topLowStock: expect.any(Array),
      });
    });

    it('returns 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard')
        .set('x-tenant-slug', TENANT_SLUG);
      expect(res.status).toBe(401);
    });

    it('respects ?from and ?to date filters', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard?from=2020-01-01&to=2020-01-31')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG);

      expect(res.status).toBe(200);
      // No orders in 2020 — all counts should be 0
      expect(res.body.summary.revenueRangeCents).toBe(0);
      expect(res.body.charts.ordersPerDay).toHaveLength(0);
      expect(res.body.charts.revenuePerDay).toHaveLength(0);
    });

    it('tenant isolation — data belongs to the correct tenant', async () => {
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .get('/dashboard')
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-tenant-slug', TENANT_SLUG),
        request(app.getHttpServer())
          .get('/dashboard')
          .set('Authorization', `Bearer ${otherOwnerToken}`)
          .set('x-tenant-slug', OTHER_SLUG),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);

      // Low stock SKUs from tenant A should not appear in tenant B's topLowStock
      const aIds = resA.body.charts.topLowStock.map((s: { id: string }) => s.id);
      const bIds = resB.body.charts.topLowStock.map((s: { id: string }) => s.id);
      const overlap = aIds.filter((id: string) => bIds.includes(id));
      expect(overlap).toHaveLength(0);
    });

    it('filters by x-branch-id', async () => {
      // Get a branch id first
      const branchRes = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG);

      const branch = branchRes.body[0];
      expect(branch).toBeDefined();

      const res = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG)
        .set('x-branch-id', branch.id);

      expect(res.status).toBe(200);
      expect(res.body.summary).toBeDefined();
    });

  });

  describe('GET /dashboard/branches', () => {
    it('returns per-branch breakdown with totals', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG);

      expect(res.status).toBe(200);
      expect(res.body.totals).toMatchObject({
        ordersInRange: expect.any(Number),
        ordersToday: expect.any(Number),
        pendingPayments: expect.any(Number),
        revenueRangeCents: expect.any(Number),
      });
      expect(Array.isArray(res.body.branches)).toBe(true);
      expect(res.body.branches.length).toBeGreaterThanOrEqual(1);
      for (const row of res.body.branches) {
        expect(row).toMatchObject({
          id: expect.any(String),
          name: expect.any(String),
          isDefault: expect.any(Boolean),
          ordersInRange: expect.any(Number),
          ordersToday: expect.any(Number),
          pendingPayments: expect.any(Number),
          revenueRangeCents: expect.any(Number),
        });
      }
    });

    it('totals match tenant-wide summary data', async () => {
      const [breakdownRes, summaryRes] = await Promise.all([
        request(app.getHttpServer())
          .get('/dashboard/branches')
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-tenant-slug', TENANT_SLUG),
        request(app.getHttpServer())
          .get('/dashboard')
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-tenant-slug', TENANT_SLUG),
      ]);

      expect(breakdownRes.status).toBe(200);
      expect(summaryRes.status).toBe(200);

      // Totals row must match summary card values exactly
      expect(breakdownRes.body.totals.ordersToday).toBe(summaryRes.body.summary.ordersToday);
      expect(breakdownRes.body.totals.pendingPayments).toBe(summaryRes.body.summary.pendingPayments);
      expect(breakdownRes.body.totals.revenueRangeCents).toBe(summaryRes.body.summary.revenueRangeCents);
    });

    it('tenant isolation — other tenant gets their own branches', async () => {
      const [resA, resB] = await Promise.all([
        request(app.getHttpServer())
          .get('/dashboard/branches')
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-tenant-slug', TENANT_SLUG),
        request(app.getHttpServer())
          .get('/dashboard/branches')
          .set('Authorization', `Bearer ${otherOwnerToken}`)
          .set('x-tenant-slug', OTHER_SLUG),
      ]);

      const aIds = resA.body.branches.map((r: { id: string }) => r.id);
      const bIds = resB.body.branches.map((r: { id: string }) => r.id);
      expect(aIds.filter((id: string) => bIds.includes(id))).toHaveLength(0);
    });

    it('returns 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard/branches')
        .set('x-tenant-slug', TENANT_SLUG);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /dashboard', () => {
    it('topLowStock items have required fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG);

      for (const sku of res.body.charts.topLowStock) {
        expect(sku).toMatchObject({
          id: expect.any(String),
          code: expect.any(String),
          name: expect.any(String),
          stockOnHand: expect.any(Number),
          lowStockThreshold: expect.any(Number),
        });
      }
    });
  });
});
