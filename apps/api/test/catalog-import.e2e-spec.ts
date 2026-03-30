import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp, loginAs } from './helpers/app.helper';

const TENANT_SLUG = 'peak-hardware';
const OTHER_SLUG = 'metro-pizza-supply';

// Use a run-specific suffix so tests are idempotent across reruns
const RUN = Date.now().toString(36).slice(-4).toUpperCase();

const VALID_CSV = [
  'productName,categorySlug,skuCode,skuName,pricePhp,costPhp,lowStockThreshold',
  `Test Widget ${RUN},fasteners,TW-${RUN}-001,Test Widget Standard,99.00,45.00,5`,
  `Test Widget ${RUN},fasteners,TW-${RUN}-002,Test Widget Deluxe,149.00,70.00,3`,
].join('\n');

const MISSING_FIELD_CSV = [
  'productName,categorySlug,skuCode,skuName',
  'Broken Product,fasteners,,Missing SKU Name',
].join('\n');

const DUPLICATE_CODE_CSV = [
  'productName,categorySlug,skuCode,skuName,pricePhp',
  `Widget A,fasteners,DUP-${RUN},Widget A v1,50.00`,
  `Widget B,fasteners,DUP-${RUN},Widget B v1,60.00`,
].join('\n');

const BAD_CATEGORY_CSV = [
  'productName,categorySlug,skuCode,skuName,pricePhp',
  `Widget,nonexistent-category,NC-${RUN},Widget v1,50.00`,
].join('\n');

describe('POST /catalog/import (e2e)', () => {
  let app: INestApplication;
  let token: string;
  let otherToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    token = await loginAs(app, 'owner@peak-hardware.test');
    otherToken = await loginAs(app, 'owner@metro-pizza.test');
  });

  afterAll(async () => { await app.close(); });

  it('imports new SKUs from a valid CSV', async () => {
    const res = await request(app.getHttpServer())
      .post('/catalog/import')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-slug', TENANT_SLUG)
      .attach('file', Buffer.from(VALID_CSV), { filename: 'import.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    expect(res.body.imported).toBeGreaterThanOrEqual(1);
    expect(res.body.errors).toHaveLength(0);
  });

  it('updates existing SKUs on second import (idempotent upsert)', async () => {
    const updatedCsv = VALID_CSV.replace('99.00', '109.00');
    const res = await request(app.getHttpServer())
      .post('/catalog/import')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-slug', TENANT_SLUG)
      .attach('file', Buffer.from(updatedCsv), { filename: 'import.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    expect(res.body.updated).toBeGreaterThanOrEqual(1);
    expect(res.body.errors).toHaveLength(0);
  });

  it('returns errors for rows with missing required fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/catalog/import')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-slug', TENANT_SLUG)
      .attach('file', Buffer.from(MISSING_FIELD_CSV), { filename: 'import.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    expect(res.body.errors.length).toBeGreaterThan(0);
    expect(res.body.skipped).toBeGreaterThan(0);
  });

  it('returns error for duplicate SKU codes within the same file', async () => {
    const res = await request(app.getHttpServer())
      .post('/catalog/import')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-slug', TENANT_SLUG)
      .attach('file', Buffer.from(DUPLICATE_CODE_CSV), { filename: 'import.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    expect(res.body.errors.some((e: { reason: string }) => e.reason.includes('Duplicate'))).toBe(true);
  });

  it('returns error for unknown category slug', async () => {
    const res = await request(app.getHttpServer())
      .post('/catalog/import')
      .set('Authorization', `Bearer ${token}`)
      .set('x-tenant-slug', TENANT_SLUG)
      .attach('file', Buffer.from(BAD_CATEGORY_CSV), { filename: 'import.csv', contentType: 'text/csv' });

    expect(res.status).toBe(201);
    expect(res.body.errors.some((e: { reason: string }) => e.reason.includes('Unknown category'))).toBe(true);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app.getHttpServer())
      .post('/catalog/import')
      .set('x-tenant-slug', TENANT_SLUG)
      .attach('file', Buffer.from(VALID_CSV), { filename: 'import.csv', contentType: 'text/csv' });
    expect(res.status).toBe(401);
  });

  it('tenant isolation — cannot import into another tenant (403)', async () => {
    const res = await request(app.getHttpServer())
      .post('/catalog/import')
      .set('Authorization', `Bearer ${otherToken}`)
      .set('x-tenant-slug', TENANT_SLUG)
      .attach('file', Buffer.from(VALID_CSV), { filename: 'import.csv', contentType: 'text/csv' });
    expect(res.status).toBe(403);
  });
});
