import { IsArray, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class POItemDto {
  @IsUUID()
  skuId: string;

  @IsInt()
  @Min(1)
  orderedQty: number;

  @IsInt()
  @Min(0)
  purchaseCostCents: number;
}

export class CreatePurchaseOrderDto {
  @IsUUID()
  supplierId: string;

  @IsISO8601()
  poDate: string;

  @IsOptional()
  @IsISO8601()
  expectedOn?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => POItemDto)
  items: POItemDto[];
}
