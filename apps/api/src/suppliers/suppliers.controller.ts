import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { FeatureFlagGuard, RequireFeature } from '../common/auth/feature-flag.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { SuppliersService } from './suppliers.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureFlagGuard)
@RequireFeature('inventory')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

  @Get()
  list(
    @Req() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    const active = isActive === undefined ? undefined : isActive !== 'false';
    return this.suppliers.list(req.tenant!.id, +page, +limit, search, active);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreateSupplierDto) {
    if (req.membership!.role !== 'OWNER' && req.membership!.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can manage suppliers');
    }
    return this.suppliers.create(req.tenant!.id, req.membership!.role, dto);
  }

  @Patch(':id')
  update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: UpdateSupplierDto) {
    if (req.membership!.role !== 'OWNER' && req.membership!.role !== 'ADMIN') {
      throw new ForbiddenException('Only OWNER or ADMIN can manage suppliers');
    }
    return this.suppliers.update(req.tenant!.id, req.membership!.role, id, dto);
  }
}
