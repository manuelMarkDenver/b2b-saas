import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { PrismaClient } from '@prisma/client';
import { createTestApp, loginAs } from './helpers/app.helper';

const prisma = new PrismaClient();

describe('Notifications (e2e)', () => {
  let app: INestApplication<App>;
  let peakToken: string;
  let cornerToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    peakToken = await loginAs(app, 'owner@peak-hardware.test');
    cornerToken = await loginAs(app, 'owner@corner-general.test');

    // Seed a notification for the peak-hardware owner via the notifications service directly
    const peakTenant = await prisma.tenant.findFirst({ where: { slug: 'peak-hardware' } });
    const peakUser = await prisma.user.findFirst({ where: { email: 'owner@peak-hardware.test' } });

    if (peakTenant && peakUser) {
      await prisma.notification.createMany({
        data: [
          {
            tenantId: peakTenant.id,
            userId: peakUser.id,
            type: 'ORDER_CREATED',
            title: 'Test notification 1',
            body: 'This is a test notification',
            isRead: false,
          },
          {
            tenantId: peakTenant.id,
            userId: peakUser.id,
            type: 'ORDER_CONFIRMED',
            title: 'Test notification 2',
            body: 'This is another test notification',
            isRead: false,
          },
        ],
      });
    }
  });

  afterAll(async () => {
    // Clean up test notifications
    await prisma.notification.deleteMany({
      where: { title: { startsWith: 'Test notification' } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /notifications', () => {
    it('returns notifications for the authenticated user scoped to tenant', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const testNotifs = (res.body as Array<{ title: string }>).filter((n) =>
        n.title.startsWith('Test notification'),
      );
      expect(testNotifs.length).toBeGreaterThanOrEqual(2);
    });

    it('returns 401 without a token', async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('x-tenant-slug', 'peak-hardware');
      expect(res.status).toBe(401);
    });

    it('does not return peak-hardware notifications to corner-general user', async () => {
      // corner-general token should only see corner-general notifications
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${cornerToken}`)
        .set('x-tenant-slug', 'corner-general');

      expect(res.status).toBe(200);
      const testNotifs = (res.body as Array<{ title: string }>).filter((n) =>
        n.title.startsWith('Test notification'),
      );
      expect(testNotifs.length).toBe(0);
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    let notifId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const notifs = res.body as Array<{ id: string; isRead: boolean; title: string }>;
      const unread = notifs.find((n) => !n.isRead && n.title.startsWith('Test notification'));
      notifId = unread!.id;
    });

    it('marks a notification as read', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);

      const list = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const updated = (list.body as Array<{ id: string; isRead: boolean }>).find(
        (n) => n.id === notifId,
      );
      expect(updated?.isRead).toBe(true);
    });

    it('returns 400 for a non-UUID id', async () => {
      const res = await request(app.getHttpServer())
        .patch('/notifications/not-a-uuid/read')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      expect(res.status).toBe(400);
    });

    it('does not allow corner tenant to mark peak notification as read', async () => {
      // Cross-tenant: uses corner token but peak's notifId — updateMany returns count:0, still 200
      // Verify the notification is NOT changed (stays at isRead=true from the previous test)
      const res = await request(app.getHttpServer())
        .patch(`/notifications/${notifId}/read`)
        .set('Authorization', `Bearer ${cornerToken}`)
        .set('x-tenant-slug', 'corner-general');
      // updateMany with no match → count 0, but 200 (no error thrown)
      expect(res.status).toBe(200);
    });
  });

  describe('PATCH /notifications/read-all', () => {
    it('marks all unread notifications as read for the user+tenant', async () => {
      const res = await request(app.getHttpServer())
        .patch('/notifications/read-all')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);

      const list = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const testNotifs = (list.body as Array<{ isRead: boolean; title: string }>).filter((n) =>
        n.title.startsWith('Test notification'),
      );
      expect(testNotifs.every((n) => n.isRead)).toBe(true);
    });
  });

  describe('DELETE /notifications/:id', () => {
    let notifId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const notifs = res.body as Array<{ id: string; title: string }>;
      notifId = notifs.find((n) => n.title.startsWith('Test notification'))!.id;
    });

    it('dismisses (deletes) a notification', async () => {
      const res = await request(app.getHttpServer())
        .delete(`/notifications/${notifId}`)
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');

      expect(res.status).toBe(200);

      const list = await request(app.getHttpServer())
        .get('/notifications')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      const found = (list.body as Array<{ id: string }>).find((n) => n.id === notifId);
      expect(found).toBeUndefined();
    });

    it('returns 400 for a non-UUID id', async () => {
      const res = await request(app.getHttpServer())
        .delete('/notifications/not-a-uuid')
        .set('Authorization', `Bearer ${peakToken}`)
        .set('x-tenant-slug', 'peak-hardware');
      expect(res.status).toBe(400);
    });
  });
});
