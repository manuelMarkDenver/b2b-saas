import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReceivePOItemDto {
  @IsUUID()
  skuId: string;

  @IsInt()
  @Min(0)
  receivedQty: number;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePOItemDto)
  items: ReceivePOItemDto[];
}
