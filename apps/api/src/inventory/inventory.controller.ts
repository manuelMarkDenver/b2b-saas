import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { FeatureFlagGuard, RequireFeature } from '../common/auth/feature-flag.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { InventoryService } from './inventory.service';
import { LogMovementDto } from './dto/log-movement.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureFlagGuard)
@RequireFeature('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('movements')
  logMovement(@Req() req: RequestWithUser, @Body() body: LogMovementDto) {
    return this.inventoryService.logMovement(req.tenant!.id, body);
  }

  @Get('movements')
  listMovements(
    @Req() req: RequestWithUser,
    @Query() pagination: PaginationDto,
    @Query('skuId') skuId?: string,
  ) {
    return this.inventoryService.listMovements(req.tenant!.id, pagination.page ?? 1, pagination.limit ?? 20, skuId);
  }
}
