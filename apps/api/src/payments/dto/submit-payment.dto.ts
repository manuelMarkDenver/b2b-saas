import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class SubmitPaymentDto {
  @IsUUID()
  orderId: string;

  @IsInt()
  @Min(1)
  amountCents: number;

  @IsOptional()
  @IsString()
  proofUrl?: string;
}
