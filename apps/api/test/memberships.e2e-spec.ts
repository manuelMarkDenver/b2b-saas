import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { createTestApp, loginAs } from './helpers/app.helper';

const prisma = new PrismaClient();

describe('Memberships — Invite & Accept (e2e)', () => {
  let app: INestApplication<App>;
  let ownerToken: string;
  let staffToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    ownerToken = await loginAs(app, 'owner@peak-hardware.test');
    staffToken = await loginAs(app, 'staff@peak-hardware.test');
  });

  afterAll(async () => {
    const emails = [
      'invite-new@test.local',
      'invite-accept@test.local',
      'invite-expired@test.local',
    ];
    await prisma.tenantMembership.deleteMany({
      where: { user: { email: { in: emails } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /memberships/invite', () => {
    it('OWNER can invite a new email as STAFF', async () => {
      const res = await request(app.getHttpServer())
        .post('/memberships/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ email: 'invite-new@test.local', role: 'STAFF' });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('invite-new@test.local');
      expect(res.body.message).toBeDefined();
    });

    it('returns 400 when inviting an already-active member', async () => {
      const res = await request(app.getHttpServer())
        .post('/memberships/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ email: 'staff@peak-hardware.test', role: 'STAFF' });

      expect(res.status).toBe(400);
    });

    it('returns 403 when a STAFF member tries to invite', async () => {
      const res = await request(app.getHttpServer())
        .post('/memberships/invite')
        .set('Authorization', `Bearer ${staffToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ email: 'someone-else@test.local', role: 'STAFF' });

      expect(res.status).toBe(403);
    });

    it('returns 400 for an invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/memberships/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .set('x-tenant-slug', 'peak-hardware')
        .send({ email: 'not-an-email', role: 'STAFF' });

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app.getHttpServer())
        .post('/memberships/invite')
        .set('x-tenant-slug', 'peak-hardware')
        .send({ email: 'anyone@test.local', role: 'STAFF' });

      expect(res.status).toBe(401);
    });
  });

  describe('POST /memberships/accept-invite', () => {
    const VALID_TOKEN = 'e2e-invite-valid-token-00000001';
    const INVITE_EMAIL = 'invite-accept@test.local';

    beforeAll(async () => {
      const user = await prisma.user.upsert({
        where: { email: INVITE_EMAIL },
        create: { email: INVITE_EMAIL, passwordHash: '', status: 'ACTIVE' },
        update: { passwordHash: '', status: 'ACTIVE' },
      });

      const tenant = await prisma.tenant.findUnique({
        where: { slug: 'peak-hardware' },
        select: { id: true },
      });

      await prisma.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: tenant!.id, userId: user.id } },
        create: {
          tenantId: tenant!.id,
          userId: user.id,
          role: 'STAFF',
          status: 'INVITED',
          inviteToken: VALID_TOKEN,
          inviteExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
        update: {
          status: 'INVITED',
          inviteToken: VALID_TOKEN,
          inviteExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        },
      });
    });

    it('accepts a valid invite, sets password, and activates membership', async () => {
      const res = await request(app.getHttpServer())
        .post('/memberships/accept-invite')
        .send({ token: VALID_TOKEN, password: 'NewPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.tenantSlug).toBe('peak-hardware');
    });

    it('returns 400 when the same token is used again (already consumed)', async () => {
      const res = await request(app.getHttpServer())
        .post('/memberships/accept-invite')
        .send({ token: VALID_TOKEN, password: 'NewPassword123!' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for an unknown token', async () => {
      const res = await request(app.getHttpServer())
        .post('/memberships/accept-invite')
        .send({ token: 'completely-unknown-token', password: 'NewPassword123!' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for an expired invite token', async () => {
      const EXPIRED_TOKEN = 'e2e-invite-expired-token-00000002';
      const EXPIRED_EMAIL = 'invite-expired@test.local';

      const user = await prisma.user.upsert({
        where: { email: EXPIRED_EMAIL },
        create: { email: EXPIRED_EMAIL, passwordHash: '', status: 'ACTIVE' },
        update: {},
      });
      const tenant = await prisma.tenant.findUnique({
        where: { slug: 'peak-hardware' },
        select: { id: true },
      });
      await prisma.tenantMembership.upsert({
        where: { tenantId_userId: { tenantId: tenant!.id, userId: user.id } },
        create: {
          tenantId: tenant!.id,
          userId: user.id,
          role: 'STAFF',
          status: 'INVITED',
          inviteToken: EXPIRED_TOKEN,
          inviteExpiresAt: new Date(Date.now() - 1000),
        },
        update: {
          status: 'INVITED',
          inviteToken: EXPIRED_TOKEN,
          inviteExpiresAt: new Date(Date.now() - 1000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/memberships/accept-invite')
        .send({ token: EXPIRED_TOKEN, password: 'NewPassword123!' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for a password shorter than 8 characters', async () => {
      const res = await request(app.getHttpServer())
        .post('/memberships/accept-invite')
        .send({ token: 'some-token', password: 'short' });

      expect(res.status).toBe(400);
    });
  });
});
