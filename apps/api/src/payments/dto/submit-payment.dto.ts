import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class SubmitPaymentDto {
  @IsUUID()
  orderId: string;

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;

  @IsOptional()
  @IsString()
  proofUrl?: string;
}
