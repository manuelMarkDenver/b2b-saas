import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { createTestApp, loginAs } from './helpers/app.helper';

const prisma = new PrismaClient();

describe('Admin — Tenant Lifecycle + User Management (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let ownerToken: string;
  let peakTenantId: string;

  beforeAll(async () => {
    // Pre-clean any leftovers from a prior failed run
    const stale = await prisma.tenant.findMany({
      where: { slug: { in: ['e2e-new-tenant', 'e2e-new-tenant-2'] } },
      select: { id: true },
    });
    if (stale.length) {
      await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: stale.map((t) => t.id) } } });
      await prisma.tenant.deleteMany({ where: { id: { in: stale.map((t) => t.id) } } });
    }
    await prisma.user.deleteMany({ where: { email: 'new-owner@test.local' } });

    app = await createTestApp();
    adminToken = await loginAs(app, 'admin@local.test', 'ChangeMe123!');
    ownerToken = await loginAs(app, 'owner@peak-hardware.test');

    const tenant = await prisma.tenant.findUnique({
      where: { slug: 'peak-hardware' },
      select: { id: true },
    });
    peakTenantId = tenant!.id;
  });

  afterAll(async () => {
    // Restore peak-hardware status if suspended
    await prisma.tenant.update({
      where: { id: peakTenantId },
      data: { status: 'ACTIVE' },
    });
    // Clean up test-created tenants (memberships first due to FK)
    const testTenants = await prisma.tenant.findMany({
      where: { slug: { in: ['e2e-new-tenant', 'e2e-new-tenant-2'] } },
      select: { id: true },
    });
    const testTenantIds = testTenants.map((t) => t.id);
    await prisma.tenantMembership.deleteMany({ where: { tenantId: { in: testTenantIds } } });
    await prisma.tenant.deleteMany({ where: { id: { in: testTenantIds } } });
    await prisma.user.deleteMany({ where: { email: 'new-owner@test.local' } });
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /admin/tenants', () => {
    it('creates a tenant and OWNER membership for an existing user', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E New Tenant',
          slug: 'e2e-new-tenant',
          businessType: 'general_retail',
          ownerEmail: 'owner@peak-hardware.test',
        });

      expect(res.status).toBe(201);
      expect(res.body.slug).toBe('e2e-new-tenant');
      expect(res.body.status).toBe('ACTIVE');
    });

    it('creates a tenant and placeholder user for a new email', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E New Tenant 2',
          slug: 'e2e-new-tenant-2',
          ownerEmail: 'new-owner@test.local',
        });

      expect(res.status).toBe(201);
      expect(res.body.slug).toBe('e2e-new-tenant-2');
    });

    it('returns 409 for a duplicate slug', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Duplicate',
          slug: 'peak-hardware',
          ownerEmail: 'admin@local.test',
        });

      expect(res.status).toBe(409);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/tenants')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'No Slug' });

      expect(res.status).toBe(400);
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app.getHttpServer())
        .post('/admin/tenants')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Hack', slug: 'hack', ownerEmail: 'x@x.com' });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /admin/tenants/:id/status', () => {
    it('suspends a tenant', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/tenants/${peakTenantId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('SUSPENDED');
    });

    it('blocked tenant requests return 403 on tenant-scoped endpoints', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(403);
    });

    it('reactivates a suspended tenant', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/tenants/${peakTenantId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ACTIVE');
    });

    it('tenant-scoped endpoints work again after reactivation', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
    });

    it('returns 400 for an invalid status value', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/tenants/${peakTenantId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'DELETED' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown tenant id', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/tenants/00000000-0000-0000-0000-000000000000/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(404);
    });

    it('returns 403 for non-admin user', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/tenants/${peakTenantId}/status`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ status: 'SUSPENDED' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /admin/users + PATCH /admin/users/:id', () => {
    let staffUserId: string;

    beforeAll(async () => {
      const user = await prisma.user.findUnique({
        where: { email: 'staff@peak-hardware.test' },
        select: { id: true },
      });
      staffUserId = user!.id;
    });

    afterAll(async () => {
      // Remove platform admin from staff user
      await prisma.user.update({
        where: { id: staffUserId },
        data: { isPlatformAdmin: false },
      });
    });

    it('lists all users', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('email');
      expect(res.body[0]).toHaveProperty('isPlatformAdmin');
    });

    it('promotes a user to platform admin', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${staffUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPlatformAdmin: true });

      expect(res.status).toBe(200);
      expect(res.body.isPlatformAdmin).toBe(true);
    });

    it('demotes a platform admin', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${staffUserId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPlatformAdmin: false });

      expect(res.status).toBe(200);
      expect(res.body.isPlatformAdmin).toBe(false);
    });

    it('returns 404 for unknown user id', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/users/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isPlatformAdmin: true });

      expect(res.status).toBe(404);
    });

    it('returns 403 for non-admin', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/admin/users/${staffUserId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ isPlatformAdmin: true });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /skus/:id/archive + PATCH /products/:id/archive', () => {
    let skuId: string;
    let productId: string;

    beforeAll(async () => {
      const sku = await prisma.sku.findFirst({
        where: { tenant: { slug: 'peak-hardware' } },
        select: { id: true, productId: true },
      });
      skuId = sku!.id;
      productId = sku!.productId;
    });

    afterAll(async () => {
      // Restore archived records
      await prisma.sku.update({
        where: { id: skuId },
        data: { isArchived: false, isActive: true },
      });
      await prisma.product.update({
        where: { id: productId },
        data: { isArchived: false, isActive: true },
      });
      await prisma.sku.updateMany({
        where: { productId },
        data: { isArchived: false, isActive: true },
      });
    });

    it('OWNER can archive a SKU', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/skus/${skuId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      expect(res.body.isArchived).toBe(true);
      expect(res.body.isActive).toBe(false);
    });

    it('archived SKU no longer appears in the catalog list', async () => {
      const res = await request(app.getHttpServer())
        .get('/skus')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      const skuIds = (res.body.data as Array<{ id: string }>).map((s) => s.id);
      expect(skuIds).not.toContain(skuId);
    });

    it('OWNER can archive a product (cascades to its SKUs)', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/products/${productId}/archive`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      expect(res.body.isArchived).toBe(true);
    });

    it('returns 403 when STAFF tries to archive', async () => {
      const staffToken = await loginAs(app, 'staff@peak-hardware.test');
      const res = await request(app.getHttpServer())
        .patch(`/skus/${skuId}/archive`)
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(403);
    });

    it('returns 404 for unknown SKU id', async () => {
      const res = await request(app.getHttpServer())
        .patch('/skus/00000000-0000-0000-0000-000000000000/archive')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(404);
    });
  });
});
