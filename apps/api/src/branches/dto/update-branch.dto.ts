import { IsString, IsOptional, MaxLength, MinLength, IsEnum } from 'class-validator';
import { BranchStatus } from '@prisma/client';

export class UpdateBranchDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  address?: string;

  @IsEnum(BranchStatus)
  @IsOptional()
  status?: BranchStatus;
}
