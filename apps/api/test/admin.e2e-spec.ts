import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { createTestApp, loginAs } from './helpers/app.helper';

const prisma = new PrismaClient();

describe('Admin + Feature Flags (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let tenantUserToken: string;
  let peakTenantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    adminToken = await loginAs(app, 'admin@local.test', 'ChangeMe123!');
    tenantUserToken = await loginAs(app, 'owner@peak-hardware.test');

    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'peak-hardware' },
      select: { id: true },
    });
    peakTenantId = tenant!.id;
  });

  afterAll(async () => {
    // Restore flags after tests
    await prisma.tenant.update({
      where: { id: peakTenantId },
      data: { features: { inventory: true, orders: true, payments: true, marketplace: false } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /admin/tenants', () => {
    it('returns tenant list for platform admin', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/tenants')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('features');
      expect(res.body[0]).toHaveProperty('businessType');
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/tenants')
        .set('Authorization', `Bearer ${tenantUserToken}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app.getHttpServer()).get('/admin/tenants');
      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /admin/tenants/:id/features', () => {
    it('disables the orders feature flag', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/tenants/${peakTenantId}/features`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orders: false });

      expect(res.status).toBe(200);
      expect((res.body.features as { orders: boolean }).orders).toBe(false);
    });

    it('blocks orders endpoint when orders flag is disabled', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${tenantUserToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(403);
    });

    it('re-enables orders flag and unblocks the endpoint', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/tenants/${peakTenantId}/features`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orders: true });

      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${tenantUserToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
    });

    it('blocks payments endpoint when payments flag is disabled', async () => {
      await request(app.getHttpServer())
        .patch(`/admin/tenants/${peakTenantId}/features`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payments: false });

      const res = await request(app.getHttpServer())
        .get('/payments')
        .set('Authorization', `Bearer ${tenantUserToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(403);

      // Restore
      await request(app.getHttpServer())
        .patch(`/admin/tenants/${peakTenantId}/features`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ payments: true });
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/tenants/${peakTenantId}/features`)
        .set('Authorization', `Bearer ${tenantUserToken}`)
        .send({ orders: false });

      expect(res.status).toBe(403);
    });

    it('returns 404 for unknown tenant id', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/tenants/00000000-0000-0000-0000-000000000000/features`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ orders: false });

      expect(res.status).toBe(404);
    });
  });
});
