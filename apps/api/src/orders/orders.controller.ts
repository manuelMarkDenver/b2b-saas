import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../common/auth/tenant.guard';
import type { RequestWithUser } from '../common/auth/auth.types';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

@Controller('orders')
@UseGuards(JwtAuthGuard, TenantGuard)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  createOrder(@Req() req: RequestWithUser, @Body() body: CreateOrderDto) {
    return this.ordersService.createOrder(req.tenant!.id, body);
  }

  @Get()
  listOrders(@Req() req: RequestWithUser) {
    return this.ordersService.listOrders(req.tenant!.id);
  }

  @Get(':id')
  getOrder(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.getOrder(req.tenant!.id, id);
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
