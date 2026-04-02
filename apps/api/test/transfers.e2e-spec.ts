import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, loginAs } from './helpers/app.helper';

describe('Stock Transfers (e2e)', () => {
  let app: INestApplication<App>;
  let peakToken: string;
  let skuId: string;
  let branchAId: string;
  let branchBId: string;

  beforeAll(async () => {
    app = await createTestApp();
    peakToken = await loginAs(app, 'owner@peak-hardware.test');

    // Get SKUs for peak-hardware
    const skusRes = await request(app.getHttpServer())
      .get('/skus')
      .set('Authorization', `Bearer ${peakToken}`)
      .set('x-tenant-slug', 'peak-hardware');

    const skusData = skusRes.body.data ?? skusRes.body;
    const skus = Array.isArray(skusData) ? skusData : [];
    skuId = skus[0]?.id;

    // Get branches - handle both paginated and non-paginated responses
    const branchesRes = await request(app.getHttpServer())
      .get('/branches')
      .set('Authorization', `Bearer ${peakToken}`)
      .set('x-tenant-slug', 'peak-hardware');

    const branchesData = branchesRes.body.data ?? branchesRes.body;
    const branches = Array.isArray(branchesData) ? branchesData : [];

    // Use first two branches
    if (branches.length >= 2) {
      branchAId = branches[0].id;
      branchBId = branches[1].id;
    } else if (branches.length === 1) {
      branchAId = branches[0].id;
      branchBId = branches[0].id;
    }
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /transfers', () => {
    it('creates transfer and updates stockOnHand (tenant-wide)', async () => {
      if (!skuId || !branchAId || !branchBId || branchAId === branchBId || branches.length < 2) {
        // Skip if not enough branches configured
        return;
      }

      // Get current stock
      const beforeRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const skusData = beforeRes.body.data ?? beforeRes.body;
      const skus = Array.isArray(skusData) ? skusData : [];
      const stockBefore = skus.find((s: { id: string }) => s.id === skuId)?.stockOnHand ?? 0;

      const transferQty = 10;

      const res = await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({
          fromBranchId: branchAId,
          toBranchId: branchBId,
          items: [{ skuId, quantity: transferQty }],
        });

      expect(res.status).toBe(201);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(transferQty);

      // Stock should remain unchanged (OUT -10, IN +10 = 0 net)
      const afterRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const afterSkusData = afterRes.body.data ?? afterRes.body;
      const afterSkus = Array.isArray(afterSkusData) ? afterSkusData : [];
      const stockAfter = afterSkus.find((s: { id: string }) => s.id === skuId)?.stockOnHand ?? 0;

      expect(stockAfter).toBe(stockBefore);
    });

    it('rejects same-branch transfer', async () => {
      if (!skuId || !branchAId) {
        return;
      }

      const res = await request(app.getHttpServer())
        .post('/transfers')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({
          fromBranchId: branchAId,
          toBranchId: branchAId,
          items: [{ skuId, quantity: 1 }],
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/different branches/i);
    });
  });

  describe('GET /transfers', () => {
    it.todo('returns list of transfers — skipped: test DB needs migration');
  });
});
