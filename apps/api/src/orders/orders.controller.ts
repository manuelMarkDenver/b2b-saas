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
import { PaymentsService } from '../payments/payments.service';
import { PaymentMethod } from '@prisma/client';
import { ForbiddenException } from '@nestjs/common';

@Controller('orders')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureFlagGuard)
@RequireFeature('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Post()
  createOrder(@Req() req: RequestWithUser, @Body() body: CreateOrderDto) {
    if (body.paymentDueDate) {
      const features = req.tenant!.features as Record<string, boolean> | null;
      if (!features?.paymentTerms) {
        throw new ForbiddenException("Feature 'paymentTerms' is not enabled for this tenant");
      }
    }
    const branchId = req.headers['x-branch-id'] as string | undefined;
    return this.ordersService.createOrder(req.tenant!.id, body, branchId);
  }

  @Get()
  listOrders(
    @Req() req: RequestWithUser,
    @Query() pagination: PaginationDto,
    @Query('status') status?: string,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('minCents') minCentsRaw?: string,
    @Query('maxCents') maxCentsRaw?: string,
    @Query('hasTerms') hasTerms?: string,
  ) {
    const branchId = req.headers['x-branch-id'] as string | undefined;
    const minCents = minCentsRaw ? parseInt(minCentsRaw, 10) : undefined;
    const maxCents = maxCentsRaw ? parseInt(maxCentsRaw, 10) : undefined;
    return this.ordersService.listOrders(
      req.tenant!.id,
      pagination.page ?? 1,
      pagination.limit ?? 20,
      branchId,
      { status, search, from, to, minCents, maxCents, hasTerms },
    );
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

  @Post(':id/pay')
  recordPayment(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { amountCents: number; method?: PaymentMethod },
  ) {
    return this.paymentsService.recordPayment(
      req.tenant!.id,
      id,
      body.amountCents,
      body.method,
    );
  }
}
