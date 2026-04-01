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
import { PaymentsService } from './payments.service';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';

@Controller('payments')
@UseGuards(JwtAuthGuard, TenantGuard, FeatureFlagGuard)
@RequireFeature('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  submitPayment(@Req() req: RequestWithUser, @Body() body: SubmitPaymentDto) {
    return this.paymentsService.submitPayment(req.tenant!.id, body);
  }

  @Get()
  listPayments(
    @Req() req: RequestWithUser,
    @Query() pagination: PaginationDto,
    @Query('orderId') orderId?: string,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('method') method?: string,
    @Query('minCents') minCentsRaw?: string,
    @Query('maxCents') maxCentsRaw?: string,
    @Query('search') search?: string,
  ) {
    const branchId = req.headers['x-branch-id'] as string | undefined;
    const minCents = minCentsRaw ? parseInt(minCentsRaw, 10) : undefined;
    const maxCents = maxCentsRaw ? parseInt(maxCentsRaw, 10) : undefined;
    return this.paymentsService.listPayments(
      req.tenant!.id, pagination.page ?? 1, pagination.limit ?? 20,
      orderId, branchId, status, from, to, method, minCents, maxCents, search,
    );
  }

  @Get(':id')
  getPayment(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.getPayment(req.tenant!.id, id);
  }

  @Patch(':id/verify')
  verifyPayment(
    @Req() req: RequestWithUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(req.tenant!.id, id, body);
  }
}
