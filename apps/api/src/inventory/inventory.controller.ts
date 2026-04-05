import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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

  @Get('branch-stock')
  async getBranchStock(@Req() req: RequestWithUser, @Query('branchId') queryBranchId?: string) {
    const headerBranchId = req.headers['x-branch-id'] as string | undefined;
    const effectiveBranchId = queryBranchId || headerBranchId;
    const stockMap = await this.inventoryService.getBranchStock(req.tenant!.id, effectiveBranchId);
    if (!effectiveBranchId) return {};
    const skuMap = stockMap.get(effectiveBranchId) ?? new Map<string, number>();
    return Object.fromEntries(skuMap);
  }

  @Post('movements')
  logMovement(@Req() req: RequestWithUser, @Body() body: LogMovementDto) {
    const branchId = req.headers['x-branch-id'] as string | undefined;
    return this.inventoryService.logMovement(
      req.tenant!.id,
      { ...body, actorId: req.user!.id },
      branchId,
      req.membership?.role,
    );
  }

  @Get('movements')
  listMovements(
    @Req() req: RequestWithUser,
    @Query() pagination: PaginationDto,
    @Query('skuId') skuId?: string,
    @Query('approvalStatus') approvalStatus?: string,
    @Query('skuSearch') skuSearch?: string,
  ) {
    const branchId = req.headers['x-branch-id'] as string | undefined;
    return this.inventoryService.listMovements(
      req.tenant!.id,
      pagination.page ?? 1,
      pagination.limit ?? 20,
      skuId,
      branchId,
      approvalStatus,
      skuSearch,
    );
  }

  @Patch('movements/:id/approve')
  approveMovement(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.inventoryService.approveMovement(req.tenant!.id, id, req.membership!.role);
  }

  @Patch('movements/:id/reject')
  rejectMovement(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.inventoryService.rejectMovement(req.tenant!.id, id, req.membership!.role);
  }
}
