import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(userId: string) {
    return this.prisma.tenantMembership.findMany({
      where: { userId },
      include: {
        tenant: { select: { id: true, name: true, slug: true, features: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async ensureActiveMembership(userId: string, tenantSlug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug.toLowerCase() },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId,
        },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('No access to tenant');
    }

    return { tenant, membership };
  }

  listTeamMembers(tenantId: string) {
    return this.prisma.tenantMembership.findMany({
      where: { tenantId, status: 'ACTIVE' },
      select: {
        id: true,
        role: true,
        status: true,
        isOwner: true,
        user: { select: { email: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
