import { IsEnum } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

const ALLOWED = [PaymentStatus.VERIFIED, PaymentStatus.REJECTED] as const;

export class VerifyPaymentDto {
  @IsEnum(ALLOWED)
  status: (typeof ALLOWED)[number];
}
