import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/auth/admin.guard';
import { CurrentUser } from '../common/auth/current-user.decorator';
import type { AuthUser } from '../common/auth/auth.types';

@Controller('tenants')
@UseGuards(JwtAuthGuard, AdminGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() body: CreateTenantDto, @CurrentUser() user: AuthUser) {
    return this.tenantsService.create(body.name, body.slug, user.id);
  }

  @Get()
  list() {
    return this.tenantsService.list();
  }
}
