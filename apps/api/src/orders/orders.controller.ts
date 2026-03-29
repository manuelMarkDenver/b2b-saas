import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import { FeatureFlagGuard, RequireFeature } from '../common/auth/feature-flag.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureFlagGuard)
@RequireFeature('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(@Req() req: RequestWithUser, @Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(req.tenant!.id, body);
  }

  @Get()
  listOrders(@Req() req: RequestWithUser, @Query() pagination: PaginationDto) {
    return this.ordersService.listOrders(req.tenant!.id, pagination.page ?? 1, pagination.limit ?? 20);
  }

  @Get(':id')
  getOrder(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.getOrder(req.tenant!.id, id);
  }

  @Patch(':id')
  updateOrder(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderDto,
  ) {
    return this.ordersService.updateOrder(req.tenant!.id, id, body);
  }

  @Patch(':id/status')
  updateOrderStatus(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateOrderStatus(req.tenant!.id, id, body);
  }
}
