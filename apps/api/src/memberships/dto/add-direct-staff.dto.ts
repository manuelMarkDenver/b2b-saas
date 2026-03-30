import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { TenantRole } from '@prisma/client';

export class AddDirectStaffDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  identifier: string; // email, phone, nickname — anything unique

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(TenantRole)
  @IsOptional()
  role?: TenantRole = TenantRole.STAFF;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  jobTitle?: string;
}
