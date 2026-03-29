import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Fetch all notifications for a user scoped to a tenant (most recent first, limit 50). */
  async listForUser(userId: string, tenantId: string) {
    return this.prisma.notification.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markRead(userId: string, tenantId: string, notificationId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId, tenantId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string, tenantId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, tenantId, isRead: false },
      data: { isRead: true },
    });
  }

  async dismiss(userId: string, tenantId: string, notificationId: string) {
    return this.prisma.notification.deleteMany({
      where: { id: notificationId, userId, tenantId },
    });
  }

  /** Internal helper — write a notification for all ACTIVE members of a tenant. */
  async notifyTenant(
    tenantId: string,
    type: NotificationType,
    title: string,
    body: string,
    opts?: { entityType?: string; entityId?: string },
  ) {
    const memberships = await this.prisma.tenantMembership.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: { userId: true },
    });

    if (memberships.length === 0) return;

    await this.prisma.notification.createMany({
      data: memberships.map((m) => ({
        tenantId,
        userId: m.userId,
        type,
        title,
        body,
        entityType: opts?.entityType ?? null,
        entityId: opts?.entityId ?? null,
      })),
    });
  }
}
