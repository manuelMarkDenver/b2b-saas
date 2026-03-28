import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { createTestApp, loginAs } from './helpers/app.helper';

const prisma = new PrismaClient();

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  let peakToken: string;
  let cornerToken: string;
  let skuId: string;

  beforeAll(async () => {
    app = await createTestApp();
    peakToken = await loginAs(app, 'owner@peak-hardware.test');
    cornerToken = await loginAs(app, 'owner@corner-general.test');

    // Get a SKU from peak-hardware that has a price
    const skuRes = await request(app.getHttpServer())
      .get('/skus')
      .set('Authorization', `Bearer ${peakToken}`)
      .set('x-tenant-slug', 'peak-hardware');
    const skus = skuRes.body as Array<{ id: string; priceCents: number | null }>;
    skuId = skus.find((s) => s.priceCents !== null)!.id;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /orders', () => {
    it('creates an order with items and returns PENDING status', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: 2 }] });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].quantity).toBe(2);
      expect(res.body.items[0].priceAtTime).toBeGreaterThan(0);
      expect(res.body.totalCents).toBeGreaterThan(0);
    });

    it('returns 400 for empty items array', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [] });

      expect(res.status).toBe(400);
    });

    it('returns 400 for quantity < 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: 0 }] });

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: 1 }] });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /orders', () => {
    it('lists orders for the tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /orders/:id', () => {
    let orderId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: 1 }] });
      orderId = res.body.id as string;
    });

    it('returns the order by id', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(orderId);
    });

    it('returns 403 for cross-tenant access (tenant isolation)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/orders/${orderId}`)
        .set('Authorization', `Bearer ${cornerToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /orders/:id/status', () => {
    let orderId: string;
    let stockBefore: number;

    beforeAll(async () => {
      // Record stock before
      const skusRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const skus = skusRes.body as Array<{ id: string; stockOnHand: number }>;
      stockBefore = skus.find((s) => s.id === skuId)!.stockOnHand;

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: 3 }] });
      orderId = res.body.id as string;
    });

    it('confirms order and deducts stock', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');

      // Verify stock decreased by quantity ordered
      const skusRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const skus = skusRes.body as Array<{ id: string; stockOnHand: number }>;
      const stockAfter = skus.find((s) => s.id === skuId)!.stockOnHand;
      expect(stockAfter).toBe(stockBefore - 3);
    });

    it('rejects invalid transition (PENDING -> COMPLETED)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: 1 }] });

      const res = await request(app.getHttpServer())
        .patch(`/orders/${createRes.body.id}/status`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(400);
    });

    it('cancels a PENDING order', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: 1 }] });

      const res = await request(app.getHttpServer())
        .patch(`/orders/${createRes.body.id}/status`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ status: 'CANCELLED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('restores stock when cancelling a CONFIRMED order', async () => {
      // Record stock before
      const skusRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const stockBefore = (skusRes.body as Array<{ id: string; stockOnHand: number }>)
        .find((s) => s.id === skuId)!.stockOnHand;

      // Create + confirm order (deducts stock)
      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: 2 }] });
      const orderId = createRes.body.id as string;

      await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ status: 'CONFIRMED' });

      // Cancel (should restore stock)
      const cancelRes = await request(app.getHttpServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ status: 'CANCELLED' });

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.status).toBe('CANCELLED');

      // Verify stock is back to original
      const skusAfterRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const stockAfter = (skusAfterRes.body as Array<{ id: string; stockOnHand: number }>)
        .find((s) => s.id === skuId)!.stockOnHand;

      expect(stockAfter).toBe(stockBefore);
    });

    it('returns 400 when confirming order with insufficient stock', async () => {
      // Read current stock so we order exactly one more than available
      const skusRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const currentStock = (skusRes.body as Array<{ id: string; stockOnHand: number }>)
        .find((s) => s.id === skuId)!.stockOnHand;

      const createRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: currentStock + 1 }] });
      expect(createRes.status).toBe(201);

      const res = await request(app.getHttpServer())
        .patch(`/orders/${createRes.body.id}/status`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/insufficient stock/i);
    });
  });
});
