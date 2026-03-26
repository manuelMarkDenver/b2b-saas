import { IsString, MinLength, Matches } from 'class-validator';

export class SwitchTenantDto {
  @IsString()
  @MinLength(2)
  @Matches(/^[a-z0-9-]+$/)
  tenantSlug!: string;
}
