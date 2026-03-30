import { IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(2)
  email!: string; // accepts email or any username/phone identifier

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsOptional()
  tenantSlug?: string; // required when identifier is not an email (direct-add staff)
}
