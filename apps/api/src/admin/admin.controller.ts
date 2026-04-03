import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/auth/admin.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth.types';
import { AdminService } from './admin.service';
import { UpdateTenantFlagsDto } from './dto/update-tenant-flags.dto';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --- Tenants ---

  @Get('tenants')
  listTenants() {
    return this.adminService.listTenants();
  }

  @Get('tenants/:id')
  getTenant(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getTenant(id);
  }

  @Post('tenants')
  createTenant(@CurrentUser() user: AuthUser, @Body() body: CreateTenantDto) {
    return this.adminService.createTenant({
      name: body.name,
      slug: body.slug,
      businessType: body.businessType,
      ownerEmail: body.ownerEmail,
      createdByUserId: user.id,
    });
  }

  @Patch('tenants/:id/features')
  updateFeatureFlags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTenantFlagsDto,
  ) {
    return this.adminService.updateFeatureFlags(id, body);
  }

  @Patch('tenants/:id/limits')
  updateTenantLimits(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { maxBranches: number },
  ) {
    const max = Math.max(1, Math.floor(body.maxBranches ?? 1));
    return this.adminService.updateTenantLimits(id, max);
  }

  @Patch('tenants/:id/status')
  updateTenantStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTenantStatusDto,
  ) {
    return this.adminService.updateTenantStatus(id, body.status);
  }

  // --- Users ---

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Patch('users/:id')
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateAdminUserDto,
  ) {
    return this.adminService.updateUser(id, body);
  }
}
