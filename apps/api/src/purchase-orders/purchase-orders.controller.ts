import { Body, Controller, ForbiddenException, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { FeatureFlagGuard, RequireFeature } from '../common/auth/feature-flag.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { PurchaseOrdersService } from './purchase-orders.service';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { UpdatePurchaseOrderDto } from './dto/update-po.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-po.dto';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureFlagGuard)
@RequireFeature('inventory')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrders: PurchaseOrdersService) {}

  @Get()
  list(
    @Req() req: RequestWithUser,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('supplierId') supplierId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.purchaseOrders.list(req.tenant!.id, {
      role: req.membership!.role,
      branchIds: req.membership!.branchIds,
    }, +page, +limit, status, search, supplierId, branchId);
  }

  @Get(':id')
  detail(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.purchaseOrders.detail(req.tenant!.id, {
      role: req.membership!.role,
      branchIds: req.membership!.branchIds,
    }, id);
  }

  @Post()
  create(@Req() req: RequestWithUser, @Body() dto: CreatePurchaseOrderDto) {
    const branchId = req.headers['x-branch-id'] as string | undefined;
    if (!branchId) throw new ForbiddenException('Branch is required');

    return this.purchaseOrders.create(req.tenant!.id, branchId, req.user!.id, {
      role: req.membership!.role,
      branchIds: req.membership!.branchIds,
    }, dto);
  }

  @Patch(':id')
  update(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: UpdatePurchaseOrderDto) {
    const branchId = req.headers['x-branch-id'] as string | undefined;
    if (!branchId) throw new ForbiddenException('Branch is required');

    return this.purchaseOrders.update(req.tenant!.id, branchId, req.user!.id, {
      role: req.membership!.role,
      branchIds: req.membership!.branchIds,
    }, id, dto);
  }

  @Post(':id/order')
  order(@Req() req: RequestWithUser, @Param('id') id: string) {
    const branchId = req.headers['x-branch-id'] as string | undefined;
    if (!branchId) throw new ForbiddenException('Branch is required');

    return this.purchaseOrders.order(req.tenant!.id, branchId, req.user!.id, {
      role: req.membership!.role,
      branchIds: req.membership!.branchIds,
    }, id);
  }

  @Post(':id/receive')
  receive(@Req() req: RequestWithUser, @Param('id') id: string, @Body() dto: ReceivePurchaseOrderDto) {
    const branchId = req.headers['x-branch-id'] as string | undefined;
    if (!branchId) throw new ForbiddenException('Branch is required');

    return this.purchaseOrders.receive(req.tenant!.id, branchId, req.user!.id, {
      role: req.membership!.role,
      branchIds: req.membership!.branchIds,
    }, id, dto);
  }

  @Post(':id/close')
  close(@Req() req: RequestWithUser, @Param('id') id: string) {
    const branchId = req.headers['x-branch-id'] as string | undefined;
    if (!branchId) throw new ForbiddenException('Branch is required');

    return this.purchaseOrders.close(req.tenant!.id, branchId, req.user!.id, {
      role: req.membership!.role,
      branchIds: req.membership!.branchIds,
    }, id);
  }
}
