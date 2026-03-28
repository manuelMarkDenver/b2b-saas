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
    @Query('orderId') orderId?: string,
  ) {
    return this.paymentsService.listPayments(req.tenant!.id, orderId);
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
