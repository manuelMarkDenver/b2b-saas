import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, loginAs } from './helpers/app.helper';

describe('Reports (e2e)', () => {
  let app: INestApplication<App>;
  let peakToken: string;
  let cornerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    peakToken = await loginAs(app, 'owner@peak-hardware.test');
    cornerToken = await loginAs(app, 'owner@corner-general.test');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /reports/orders', () => {
    it('returns orders report with data and meta', async () => {
      const res = await request(app.getHttpServer())
        .get('/reports/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.meta).toMatchObject({
        from: expect.any(String),
        to: expect.any(String),
      });
    });

    it('each row has expected fields', async () => {
      const res = await request(app.getHttpServer())
        .get('/reports/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      if (res.body.data.length > 0) {
        const row = res.body.data[0];
        expect(row).toHaveProperty('id');
        expect(row).toHaveProperty('createdAt');
        expect(row).toHaveProperty('totalCents');
        expect(row).toHaveProperty('status');
        expect(row).toHaveProperty('itemCount');
        expect(row).toHaveProperty('branchName');
      }
    });

    it('filters by date range', async () => {
      const from = '2020-01-01';
      const to = '2020-12-31';

      const res = await request(app.getHttpServer())
        .get(`/reports/orders?from=${from}&to=${to}`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('returns CSV when format=csv', async () => {
      const res = await request(app.getHttpServer())
        .get('/reports/orders?format=csv')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.headers['content-disposition']).toMatch(/attachment.*\.csv/);
      // CSV starts with header row
      expect(res.text).toMatch(/Order ID.*Date.*Customer Ref/);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app.getHttpServer())
        .get('/reports/orders')
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(401);
    });

    it('tenant isolation — corner token cannot see peak-hardware orders', async () => {
      // Get peak orders count
      const peakRes = await request(app.getHttpServer())
        .get('/reports/orders')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      // corner token against peak tenant should be rejected by TenantGuard
      const cornerRes = await request(app.getHttpServer())
        .get('/reports/orders')
        .set('Authorization', `Bearer ${cornerToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(peakRes.status).toBe(200);
      expect(cornerRes.status).toBe(403);
    });

    it('x-branch-id filters report to that branch', async () => {
      const branchRes = await request(app.getHttpServer())
        .get('/branches')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      expect(branchRes.body.length).toBeGreaterThanOrEqual(2);

      const [branchA, branchB] = branchRes.body as Array<{ id: string }>;

      const [resA, resB, resAll] = await Promise.all([
        request(app.getHttpServer())
          .get('/reports/orders')
          .set('Authorization', `Bearer ${peakToken}`)
          .set('x-tenant-slug', 'peak-hardware')
          .set('x-branch-id', branchA.id),
        request(app.getHttpServer())
          .get('/reports/orders')
          .set('Authorization', `Bearer ${peakToken}`)
          .set('x-tenant-slug', 'peak-hardware')
          .set('x-branch-id', branchB.id),
        request(app.getHttpServer())
          .get('/reports/orders')
          .set('Authorization', `Bearer ${peakToken}`)
          .set('x-tenant-slug', 'peak-hardware'),
      ]);

      expect(resA.status).toBe(200);
      expect(resB.status).toBe(200);
      expect(resAll.status).toBe(200);

      expect(resA.body.data.length).toBeLessThanOrEqual(resAll.body.data.length);
      expect(resB.body.data.length).toBeLessThanOrEqual(resAll.body.data.length);
      expect(resA.body.data.length + resB.body.data.length).toBeLessThanOrEqual(resAll.body.data.length);
    });
  });
});
