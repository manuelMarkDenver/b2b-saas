import { IsEnum, IsInt, IsOptional, IsString, IsUUID } from 'class-validator';
import { MovementType, ReferenceType } from '@prisma/client';

export class LogMovementDto {
  @IsUUID()
  skuId!: string;

  @IsEnum(MovementType)
  type!: MovementType;

  // Must be positive for IN/OUT. For ADJUSTMENT, can be negative (stock correction).
  @IsInt()
  quantity!: number;

  @IsEnum(ReferenceType)
  referenceType!: ReferenceType;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
