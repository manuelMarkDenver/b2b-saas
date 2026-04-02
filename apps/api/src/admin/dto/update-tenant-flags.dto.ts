import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateTenantFlagsDto {
  @IsOptional()
  @IsBoolean()
  inventory?: boolean;

  @IsOptional()
  @IsBoolean()
  orders?: boolean;

  @IsOptional()
  @IsBoolean()
  payments?: boolean;

  @IsOptional()
  @IsBoolean()
  marketplace?: boolean;

  @IsOptional()
  @IsBoolean()
  reports?: boolean;

  @IsOptional()
  @IsBoolean()
  stockTransfers?: boolean;

  @IsOptional()
  @IsBoolean()
  paymentTerms?: boolean;
}
