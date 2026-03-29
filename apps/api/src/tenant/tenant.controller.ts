import { Body, Controller, ForbiddenException, Get, Patch, UseGuards } from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { Req } from '@nestjs/common';
import { RequirePermissions } from '../common/auth/require-permissions.decorator';
import { Permission } from '../common/auth/permissions';
import { PermissionsGuard } from '../common/auth/permissions.guard';
import { PrismaService } from '../common/prisma/prisma.service';

class UpdateLogoDto {
  @IsOptional()
  @IsString()
  logoUrl?: string | null;
}

@Controller('tenant')
@UseGuards(JwtAuthGuard, TenantGuard)
export class TenantController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('context')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.MEMBERSHIPS_READ)
  context(@Req() req: RequestWithUser) {
    return {
      tenant: req.tenant,
      membership: req.membership,
      user: req.user,
    };
  }

  @Patch('logo')
  async updateLogo(@Req() req: RequestWithUser, @Body() dto: UpdateLogoDto) {
    const role = req.membership?.role;
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can update the tenant logo');
    }
    return this.prisma.tenant.update({
      where: { id: req.tenant!.id },
      data: { logoUrl: dto.logoUrl ?? null },
      select: { id: true, name: true, slug: true, logoUrl: true },
    });
  }

  @Get('memberships')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission.MEMBERSHIPS_MANAGE)
  async listTenantMemberships(@Req() req: RequestWithUser) {
    return this.prisma.tenantMembership.findMany({
      where: { tenantId: req.tenant!.id },
      include: {
        user: { select: { id: true, email: true, status: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }
}
