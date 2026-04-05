import { IsArray, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { POItemDto } from './create-po.dto';

export class UpdatePurchaseOrderDto {
  @IsUUID()
  @IsOptional()
  supplierId?: string;

  @IsOptional()
  @IsISO8601()
  poDate?: string;

  @IsOptional()
  @IsISO8601()
  expectedOn?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => POItemDto)
  items?: POItemDto[];
}
