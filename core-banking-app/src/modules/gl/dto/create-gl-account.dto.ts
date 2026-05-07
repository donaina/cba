import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsNotEmpty,
} from 'class-validator';
import {
  GlAccountType,
  GlAccountLevel,
  NormalBalance,
} from '@prisma/client';

export class CreateGlAccountDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(GlAccountType)
  type: GlAccountType;

  @IsEnum(GlAccountLevel)
  level: GlAccountLevel;

  @IsEnum(NormalBalance)
  normalBalance: NormalBalance;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isSystemAccount?: boolean = false;

  @IsOptional()
  @IsString()
  description?: string;
}
