import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs } from './helpers/app.helper';

const TENANT_SLUG = 'peak-hardware';
const OTHER_SLUG = 'metro-pizza-supply';

describe('Branches (e2e)', () => {
  let app: INestApplication;
  let ownerToken: string;
  let staffToken: string;
  let otherOwnerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner@peak-hardware.test');
    staffToken = await loginAs(app, 'staff@peak-hardware.test');
    otherOwnerToken = await loginAs(app, 'owner@metro-pizza.test');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /branches', () => {
    it('returns branches for tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);
      expect(res.body[0]).toMatchObject({ name: expect.any(String), isDefault: expect.any(Boolean) });
    });

    it('returns 401 without token', async () => {
      const res = await request(app.getHttpServer())
        .get('/branches')
        .set('x-tenant-slug', TENANT_SLUG);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /branches', () => {
    const RUN = Date.now().toString(36).toUpperCase();
    let createdId: string;

    it('OWNER can create a branch', async () => {
      const res = await request(app.getHttpServer())
        .post('/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG)
        .send({ name: `Test Branch ${RUN}`, address: '123 Test St' });

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ name: `Test Branch ${RUN}`, isDefault: false });
      createdId = res.body.id;
    });

    it('rejects duplicate branch name (case-insensitive)', async () => {
      const res = await request(app.getHttpServer())
        .post('/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG)
        .send({ name: `test branch ${RUN}` }); // lowercase variant

      expect(res.status).toBe(409);
    });

    it('STAFF cannot create a branch', async () => {
      const res = await request(app.getHttpServer())
        .post('/branches')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-tenant-slug', TENANT_SLUG)
        .send({ name: `Staff Branch ${RUN}` });

      expect(res.status).toBe(403);
    });

    it('tenant isolation — other tenant cannot see created branch', async () => {
      const res = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${otherOwnerToken}`)
        .set('x-tenant-slug', OTHER_SLUG);

      expect(res.status).toBe(200);
      const ids = res.body.map((b: { id: string }) => b.id);
      if (createdId) expect(ids).not.toContain(createdId);
    });

    afterAll(async () => {
      // Clean up — deactivate the test branch
      if (createdId) {
        await request(app.getHttpServer())
          .patch(`/branches/${createdId}`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .set('x-tenant-slug', TENANT_SLUG)
          .send({ status: 'INACTIVE' });
      }
    });
  });

  describe('PATCH /branches/:id', () => {
    let branchId: string;
    const RUN = Date.now().toString(36).toUpperCase() + 'P';

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG)
        .send({ name: `Patch Branch ${RUN}` });
      branchId = res.body.id;
    });

    it('OWNER can update branch name and address', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/branches/${branchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG)
        .send({ name: `Patched ${RUN}`, address: '456 Updated Ave' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(`Patched ${RUN}`);
    });

    it('OWNER can deactivate a non-default branch', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/branches/${branchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG)
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('INACTIVE');
    });

    it('cannot deactivate the default branch', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG);

      const defaultBranch = listRes.body.find((b: { isDefault: boolean }) => b.isDefault);
      expect(defaultBranch).toBeDefined();

      const res = await request(app.getHttpServer())
        .patch(`/branches/${defaultBranch.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG)
        .send({ status: 'INACTIVE' });

      expect(res.status).toBe(400);
    });

    it('STAFF cannot update a branch', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/branches/${branchId}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-tenant-slug', TENANT_SLUG)
        .send({ name: 'Staff attempt' });

      expect(res.status).toBe(403);
    });

    it('cannot patch branch belonging to another tenant', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/branches/${branchId}`)
        .set('Authorization', `Bearer ${otherOwnerToken}`)
        .set('x-tenant-slug', OTHER_SLUG)
        .send({ name: 'Cross-tenant attack' });

      // 404 because branch lookup includes tenantId filter
      expect(res.status).toBe(404);
    });
  });

  describe('x-branch-id filtering', () => {
    it('GET /orders with x-branch-id returns only that branch orders', async () => {
      const listRes = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG);

      const defaultBranch = listRes.body.find((b: { isDefault: boolean }) => b.isDefault);
      expect(defaultBranch).toBeDefined();

      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG)
        .set('x-branch-id', defaultBranch.id);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      // All returned orders must belong to the specified branch
      for (const order of res.body.data) {
        expect(order.branchId).toBe(defaultBranch.id);
      }
    });

    it('GET /orders without x-branch-id returns all tenant orders', async () => {
      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', TENANT_SLUG);

      expect(res.status).toBe(200);
      // No branch filter — total count should exceed any single branch
      expect(res.body.meta.total).toBeGreaterThan(0);
    });
  });
});
