import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BusinessType, TenantStatus, UserStatus } from '@prisma/client';
import { hash } from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateTenantFlagsDto } from './dto/update-tenant-flags.dto';

type TenantFeatures = {
  inventory: boolean;
  orders: boolean;
  payments: boolean;
  marketplace: boolean;
  reports: boolean;
  stockTransfers: boolean;
  paymentTerms: boolean;
  multipleBranches: boolean;
};

const TENANT_SELECT = {
  id: true,
  name: true,
  slug: true,
  status: true,
  businessType: true,
  features: true,
  maxBranches: true,
  isSystem: true,
  createdAt: true,
  _count: { select: { memberships: true, branches: true } },
} as const;

const DEFAULT_FEATURES: TenantFeatures = {
  inventory: true,
  orders: true,
  payments: true,
  marketplace: false,
  reports: false,
  stockTransfers: false,
  paymentTerms: false,
  multipleBranches: false,
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listTenants() {
    return this.prisma.tenant.findMany({
      where: { isSystem: false },
      select: TENANT_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: TENANT_SELECT,
    });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async createTenant(data: {
    name: string;
    slug?: string;
    businessType?: BusinessType;
    ownerEmail: string;
    ownerPassword?: string;
    createdByUserId: string;
  }) {
    const slug = (data.slug ?? slugify(data.name)).trim().toLowerCase();
    const normalizedEmail = data.ownerEmail.trim().toLowerCase();

    return this.prisma.$transaction(async (tx) => {
      // 1. Slug collision check (inside transaction to prevent races)
      const existing = await tx.tenant.findUnique({ where: { slug } });
      if (existing) throw new ConflictException('Tenant slug already exists');

      // 2. Find or create owner user
      let ownerUser = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, email: true },
      });

      let isNewUser = false;
      if (!ownerUser) {
        const passwordHash = data.ownerPassword
          ? await hash(data.ownerPassword, 12)
          : '';
        ownerUser = await tx.user.create({
          data: {
            email: normalizedEmail,
            passwordHash,
            status: 'ACTIVE',
          },
          select: { id: true, email: true },
        });
        isNewUser = true;
      }

      // 3. Create tenant + membership + default branch atomically
      const tenant = await tx.tenant.create({
        data: {
          name: data.name.trim(),
          slug,
          businessType: data.businessType ?? 'general_retail',
          features: DEFAULT_FEATURES,
          createdByUserId: data.createdByUserId,
          memberships: {
            create: {
              userId: ownerUser.id,
              role: 'OWNER',
              isOwner: true,
              status: 'ACTIVE',
            },
          },
          branches: {
            create: {
              name: data.name.trim(),
              isDefault: true,
              type: 'STANDARD',
              status: 'ACTIVE',
            },
          },
        },
        select: {
          ...TENANT_SELECT,
          branches: { select: { id: true, name: true, isDefault: true } },
        },
      });

      return {
        tenant,
        owner: { id: ownerUser.id, email: ownerUser.email },
        isNewUser,
      };
    });
  }

  async updateTenantStatus(tenantId: string, status: TenantStatus) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException('Tenant not found');

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { status },
      select: TENANT_SELECT,
    });
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
      reports: dto.reports ?? current.reports ?? false,
      stockTransfers: dto.stockTransfers ?? current.stockTransfers ?? false,
      paymentTerms: dto.paymentTerms ?? current.paymentTerms ?? false,
      multipleBranches: dto.multipleBranches ?? current.multipleBranches ?? false,
    };

    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { features: updated },
      select: TENANT_SELECT,
    });
  }

  async updateTenantLimits(tenantId: string, maxBranches: number) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { maxBranches },
      select: TENANT_SELECT,
    });
  }

  listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        status: true,
        isPlatformAdmin: true,
        createdAt: true,
        memberships: {
          where: { tenant: { isSystem: false } },
          select: {
            role: true,
            isOwner: true,
            status: true,
            tenant: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                maxBranches: true,
                _count: { select: { branches: true, memberships: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateUserStatus(userId: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
      select: { id: true, email: true, status: true },
    });
  }

  async updateUser(userId: string, data: { isPlatformAdmin: boolean }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { isPlatformAdmin: data.isPlatformAdmin },
      select: {
        id: true,
        email: true,
        status: true,
        isPlatformAdmin: true,
        createdAt: true,
      },
    });
  }
}
