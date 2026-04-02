import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

export class TransferItemDto {
  @IsUUID()
  skuId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateTransferDto {
  @IsUUID()
  @IsOptional()
  fromBranchId?: string;

  @IsUUID()
  toBranchId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TransferItemDto)
  items: TransferItemDto[];

  @IsString()
  @IsOptional()
  note?: string;
}
