import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TenantRole } from '@prisma/client';

export class InviteStaffDto {
  @IsEmail()
  email: string;

  @IsEnum(TenantRole)
  @IsOptional()
  role?: TenantRole = TenantRole.STAFF;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  jobTitle?: string;
}
