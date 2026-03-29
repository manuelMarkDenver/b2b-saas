import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestWithUser } from './auth.types';

const TENANT_HEADER = 'x-tenant-slug';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const tenantSlug = request.header(TENANT_HEADER);

    if (!tenantSlug) {
      throw new BadRequestException('Tenant slug required');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { slug: tenantSlug.toLowerCase() },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (tenant.status === 'SUSPENDED') {
      throw new ForbiddenException('Tenant is suspended');
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: tenant.id,
          userId: request.user.id,
        },
      },
    });

    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('No access to tenant');
    }

    request.tenant = tenant;
    request.membership = membership;
    return true;
  }
}
