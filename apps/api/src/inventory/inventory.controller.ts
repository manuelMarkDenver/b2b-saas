import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { InventoryService } from './inventory.service';
import { LogMovementDto } from './dto/log-movement.dto';

@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post('movements')
  @UseGuards(TenantGuard)
  logMovement(@Req() req: RequestWithUser, @Body() body: LogMovementDto) {
    return this.inventoryService.logMovement(req.tenant!.id, body);
  }

  @Get('movements')
  @UseGuards(TenantGuard)
  listMovements(@Req() req: RequestWithUser, @Query('skuId') skuId?: string) {
    return this.inventoryService.listMovements(req.tenant!.id, skuId);
  }
}
