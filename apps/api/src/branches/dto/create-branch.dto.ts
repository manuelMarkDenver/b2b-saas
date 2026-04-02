import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { BranchType } from '@prisma/client';

export class CreateBranchDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  address?: string;

  @IsEnum(BranchType)
  @IsOptional()
  type?: BranchType;
}
