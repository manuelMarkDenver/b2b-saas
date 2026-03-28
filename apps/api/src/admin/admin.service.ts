import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateTenantFlagsDto } from './dto/update-tenant-flags.dto';

type TenantFeatures = {
  inventory: boolean;
  orders: boolean;
  payments: boolean;
  marketplace: boolean;
};

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listTenants() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        businessType: true,
        features: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        businessType: true,
        features: true,
        createdAt: true,
        _count: { select: { memberships: true } },
      },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async updateFeatureFlags(tenantId: string, dto: UpdateTenantFlagsDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { features: true },
    });

    if (!tenant) throw new NotFoundException('Tenant not found');

    const current = (tenant.features ?? {}) as TenantFeatures;
    const updated: TenantFeatures = {
      inventory: dto.inventory ?? current.inventory ?? true,
      orders: dto.orders ?? current.orders ?? true,
      payments: dto.payments ?? current.payments ?? true,
      marketplace: dto.marketplace ?? current.marketplace ?? false,
    };

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { features: updated },
      select: {
        id: true,
        name: true,
        slug: true,
        businessType: true,
        features: true,
      },
    });
  }
}
