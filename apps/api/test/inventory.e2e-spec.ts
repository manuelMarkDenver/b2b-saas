import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { createTestApp, loginAs } from './helpers/app.helper';

const prisma = new PrismaClient();

describe('Inventory hardening (e2e)', () => {
  let app: INestApplication<App>;
  let peakToken: string;
  let skuId: string;
  let skuWithLowStock: string;

  beforeAll(async () => {
    app = await createTestApp();
    peakToken = await loginAs(app, 'owner@peak-hardware.test');

    // Get SKUs for peak-hardware
    const skusRes = await request(app.getHttpServer())
      .get('/skus')
      .set('Authorization', `Bearer ${peakToken}`)
      .set('x-tenant-slug', 'peak-hardware');

    const skus = skusRes.body.data as Array<{ id: string; stockOnHand: number; code: string }>;
    skuId = skus[0].id;

    // Find or create a low-stock SKU for negative-stock tests
    // Reset a SKU's stock to a known low value via direct DB manipulation
    const lowStockSku = skus[0];
    skuWithLowStock = lowStockSku.id;

    // Set stockOnHand to 5 so we can test exceeding it
    await prisma.sku.update({
      where: { id: skuWithLowStock },
      data: { stockOnHand: 5 },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /inventory/movements (pagination)', () => {
    it('returns paginated list with meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/movements?page=1&limit=5')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        page: 1,
        limit: 5,
        total: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });

    it('page 2 returns different results than page 1', async () => {
      // Log several movements so pagination has something to split
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/inventory/movements')
          .set('Authorization', `Bearer ${peakToken}`)
          .set('x-tenant-slug', 'peak-hardware')
          .send({
            skuId,
            type: 'IN',
            quantity: 1,
            referenceType: 'MANUAL',
            note: `pagination-test-${i}`,
          });
      }

      const page1 = await request(app.getHttpServer())
        .get('/inventory/movements?page=1&limit=2')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      const page2 = await request(app.getHttpServer())
        .get('/inventory/movements?page=2&limit=2')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(page1.status).toBe(200);
      expect(page2.status).toBe(200);

      const ids1 = (page1.body.data as Array<{ id: string }>).map((m) => m.id);
      const ids2 = (page2.body.data as Array<{ id: string }>).map((m) => m.id);
      // No overlap between pages
      expect(ids1.some((id) => ids2.includes(id))).toBe(false);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/inventory/movements')
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /inventory/movements — IN', () => {
    it('logs an IN movement and increases stockOnHand', async () => {
      const beforeRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const stockBefore = (beforeRes.body.data as Array<{ id: string; stockOnHand: number }>)
        .find((s) => s.id === skuId)!.stockOnHand;

      const res = await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({
          skuId,
          type: 'IN',
          quantity: 10,
          referenceType: 'MANUAL',
          note: 'Received from supplier',
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('IN');
      expect(res.body.quantity).toBe(10);

      const afterRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const stockAfter = (afterRes.body.data as Array<{ id: string; stockOnHand: number }>)
        .find((s) => s.id === skuId)!.stockOnHand;

      expect(stockAfter).toBe(stockBefore + 10);
    });
  });

  describe('POST /inventory/movements — OUT (negative stock prevention)', () => {
    it('rejects OUT movement exceeding stockOnHand', async () => {
      // stockOnHand was set to 5 in beforeAll
      const res = await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({
          skuId: skuWithLowStock,
          type: 'OUT',
          quantity: 9999,
          referenceType: 'MANUAL',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/insufficient stock/i);
    });

    it('allows OUT movement within available stock and decreases stockOnHand', async () => {
      const beforeRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const stockBefore = (beforeRes.body.data as Array<{ id: string; stockOnHand: number }>)
        .find((s) => s.id === skuWithLowStock)!.stockOnHand;

      const qty = Math.min(stockBefore, 2); // move at most 2 (stock was set to 5)

      const res = await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({
          skuId: skuWithLowStock,
          type: 'OUT',
          quantity: qty,
          referenceType: 'MANUAL',
        });

      expect(res.status).toBe(201);

      const afterRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const stockAfter = (afterRes.body.data as Array<{ id: string; stockOnHand: number }>)
        .find((s) => s.id === skuWithLowStock)!.stockOnHand;

      expect(stockAfter).toBe(stockBefore - qty);
    });

    it('rejects OUT with quantity = 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({
          skuId,
          type: 'OUT',
          quantity: 0,
          referenceType: 'MANUAL',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /inventory/movements — ADJUSTMENT', () => {
    it('applies a positive adjustment and increases stockOnHand', async () => {
      const beforeRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const stockBefore = (beforeRes.body.data as Array<{ id: string; stockOnHand: number }>)
        .find((s) => s.id === skuId)!.stockOnHand;

      const res = await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({
          skuId,
          type: 'ADJUSTMENT',
          quantity: 5,
          referenceType: 'MANUAL',
          note: 'Cycle count correction',
        });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('ADJUSTMENT');

      const afterRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const stockAfter = (afterRes.body.data as Array<{ id: string; stockOnHand: number }>)
        .find((s) => s.id === skuId)!.stockOnHand;

      expect(stockAfter).toBe(stockBefore + 5);
    });

    it('x-branch-id filters movements to that branch only', async () => {
      const branchRes = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      expect(branchRes.body.length).toBeGreaterThanOrEqual(2);

      const [branchA, branchB] = branchRes.body as Array<{ id: string }>;

      const [resA, resB, resAll] = await Promise.all([
        request(app.getHttpServer())
          .get('/inventory/movements')
          .set('Authorization', `Bearer ${peakToken}`)
          .set('x-tenant-slug', 'peak-hardware')
          .set('x-branch-id', branchA.id),
        request(app.getHttpServer())
          .get('/inventory/movements')
          .set('Authorization', `Bearer ${peakToken}`)
          .set('x-tenant-slug', 'peak-hardware')
          .set('x-branch-id', branchB.id),
        request(app.getHttpServer())
          .get('/inventory/movements')
          .set('Authorization', `Bearer ${peakToken}`)
          .set('x-tenant-slug', 'peak-hardware'),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resAll.status).toBe(200);

      // Branch totals must not exceed tenant total
      expect(resA.body.meta.total).toBeLessThanOrEqual(resAll.body.meta.total);
      expect(resB.body.meta.total).toBeLessThanOrEqual(resAll.body.meta.total);
      // Sum of two branches cannot exceed tenant total
      expect(resA.body.meta.total + resB.body.meta.total).toBeLessThanOrEqual(resAll.body.meta.total);
    });

    it('rejects ADJUSTMENT with quantity = 0', async () => {
      const res = await request(app.getHttpServer())
        .post('/inventory/movements')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({
          skuId,
          type: 'ADJUSTMENT',
          quantity: 0,
          referenceType: 'MANUAL',
        });

      expect(res.status).toBe(400);
    });
  });
});
