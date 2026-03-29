import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { TenantRole } from '@prisma/client';

export class UpdateMembershipDto {
  @IsEnum(TenantRole)
  @IsOptional()
  role?: TenantRole;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  jobTitle?: string;

  @IsOptional()
  deactivate?: boolean;
}
