import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { TenantRole } from '@prisma/client';

export class InviteStaffDto {
  @IsEmail()
  email: string;

  @IsEnum(TenantRole)
  @IsOptional()
  role?: TenantRole = TenantRole.STAFF;
}
