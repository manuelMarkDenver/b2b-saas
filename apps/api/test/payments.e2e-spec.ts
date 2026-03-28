import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { createTestApp, loginAs } from './helpers/app.helper';

const prisma = new PrismaClient();

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let peakToken: string;
  let cornerToken: string;
  let orderId: string;

  beforeAll(async () => {
    app = await createTestApp();
    peakToken = await loginAs(app, 'owner@peak-hardware.test');
    cornerToken = await loginAs(app, 'owner@corner-general.test');

    // Create a fresh order to use for payment tests
    const skuRes = await request(app.getHttpServer())
      .get('/skus')
      .set('Authorization', `Bearer ${peakToken}`)
      .set('x-tenant-slug', 'peak-hardware');
    const skus = skuRes.body as Array<{ id: string; priceCents: number | null }>;
    const skuId = skus.find((s) => s.priceCents !== null)!.id;

    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', `Bearer ${peakToken}`)
      .set('x-tenant-slug', 'peak-hardware')
      .send({ items: [{ skuId, quantity: 1 }] });
    orderId = orderRes.body.id as string;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /payments', () => {
    it('submits a payment for an order', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ orderId, amountCents: 5000 });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.amountCents).toBe(5000);
      expect(res.body.orderId).toBe(orderId);
    });

    it('submits payment with optional proofUrl', async () => {
      const skuRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const skus = skuRes.body as Array<{ id: string; priceCents: number | null }>;
      const skuId = skus.find((s) => s.priceCents !== null)!.id;

      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: 1 }] });

      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({
          orderId: orderRes.body.id,
          amountCents: 8500,
          proofUrl: 'https://example.com/proof.jpg',
        });

      expect(res.status).toBe(201);
      expect(res.body.proofUrl).toBe('https://example.com/proof.jpg');
    });

    it('returns 400 for amountCents < 1', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ orderId, amountCents: 0 });

      expect(res.status).toBe(400);
    });

    it('returns 404 for order not belonging to tenant', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${cornerToken}`)
        .set('x-tenant-slug', 'corner-general')
        .send({ orderId, amountCents: 1000 });

      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/payments')
        .set('x-tenant-slug', 'peak-hardware')
        .send({ orderId, amountCents: 1000 });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /payments', () => {
    it('lists payments for the tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/payments')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('filters by orderId', async () => {
      const res = await request(app.getHttpServer())
        .get(`/payments?orderId=${orderId}`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      const payments = res.body as Array<{ orderId: string }>;
      expect(payments.every((p) => p.orderId === orderId)).toBe(true);
    });
  });

  describe('PATCH /payments/:id/verify', () => {
    let paymentId: string;

    beforeAll(async () => {
      const skuRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const skus = skuRes.body as Array<{ id: string; priceCents: number | null }>;
      const skuId = skus.find((s) => s.priceCents !== null)!.id;

      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: 1 }] });

      const paymentRes = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ orderId: orderRes.body.id, amountCents: 1000 });
      paymentId = paymentRes.body.id as string;
    });

    it('verifies a pending payment', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/payments/${paymentId}/verify`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ status: 'VERIFIED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('VERIFIED');
    });

    it('rejects re-verification of an already verified payment', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/payments/${paymentId}/verify`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ status: 'REJECTED' });

      expect(res.status).toBe(400);
    });

    it('rejects invalid status value (only VERIFIED/REJECTED allowed)', async () => {
      const skuRes = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const skus = skuRes.body as Array<{ id: string; priceCents: number | null }>;
      const skuId = skus.find((s) => s.priceCents !== null)!.id;

      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ items: [{ skuId, quantity: 1 }] });

      const payRes = await request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ orderId: orderRes.body.id, amountCents: 500 });

      const res = await request(app.getHttpServer())
        .patch(`/payments/${payRes.body.id}/verify`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ status: 'PENDING' });

      expect(res.status).toBe(400);
    });

    it('tenant isolation — cross-tenant access returns 403', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/payments/${paymentId}/verify`)
        .set('Authorization', `Bearer ${cornerToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ status: 'VERIFIED' });

      expect(res.status).toBe(403);
    });
  });
});
