import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ContactType } from '@prisma/client';

export class UpdateContactDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsEnum(ContactType)
  @IsOptional()
  type?: ContactType;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  address?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  creditLimitCents?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
