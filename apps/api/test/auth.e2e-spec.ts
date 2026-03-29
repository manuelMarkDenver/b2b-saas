import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { createTestApp } from './helpers/app.helper';

const prisma = new PrismaClient();

describe('Auth — Password Reset (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('POST /auth/forgot-password', () => {
    afterAll(async () => {
      await prisma.user.update({
        where: { email: 'staff@peak-hardware.test' },
        data: { resetToken: null, resetTokenExpiresAt: null },
      });
    });

    it('returns 200 for a known email', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'staff@peak-hardware.test' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
    });

    it('returns 200 for an unknown email (no enumeration)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'nobody@nowhere.test' });

      expect(res.status).toBe(200);
    });

    it('returns 400 for an invalid email format', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/forgot-password')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /auth/reset-password', () => {
    const VALID_TOKEN = 'e2e-reset-valid-token-00000001';
    const TEST_EMAIL = 'staff@peak-hardware.test';
    const ORIGINAL_PASSWORD = 'Password123!';

    beforeAll(async () => {
      await prisma.user.update({
        where: { email: TEST_EMAIL },
        data: {
          resetToken: VALID_TOKEN,
          resetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
    });

    afterAll(async () => {
      const passwordHash = await hash(ORIGINAL_PASSWORD, 12);
      await prisma.user.update({
        where: { email: TEST_EMAIL },
        data: { passwordHash, resetToken: null, resetTokenExpiresAt: null },
      });
    });

    it('resets the password with a valid token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: VALID_TOKEN, password: 'NewPassword123!' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBeDefined();
    });

    it('returns 400 when the same token is used again (already consumed)', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: VALID_TOKEN, password: 'NewPassword123!' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for an unknown token', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: 'completely-unknown-token', password: 'NewPassword123!' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for an expired token', async () => {
      const EXPIRED_TOKEN = 'e2e-reset-expired-token-00000002';
      await prisma.user.update({
        where: { email: TEST_EMAIL },
        data: {
          resetToken: EXPIRED_TOKEN,
          resetTokenExpiresAt: new Date(Date.now() - 1000),
        },
      });

      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: EXPIRED_TOKEN, password: 'NewPassword123!' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for a password shorter than 8 characters', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/reset-password')
        .send({ token: VALID_TOKEN, password: 'short' });

      expect(res.status).toBe(400);
    });
  });
});
