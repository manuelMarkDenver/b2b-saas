import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/auth/admin.guard';
import { AdminService } from './admin.service';
import { UpdateTenantFlagsDto } from './dto/update-tenant-flags.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tenants')
  listTenants() {
    return this.adminService.listTenants();
  }

  @Get('tenants/:id')
  getTenant(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getTenant(id);
  }

  @Patch('tenants/:id/features')
  updateFeatureFlags(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateTenantFlagsDto,
  ) {
    return this.adminService.updateFeatureFlags(id, body);
  }
}
