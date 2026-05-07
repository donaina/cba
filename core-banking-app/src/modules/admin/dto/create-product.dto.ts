import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsPositive,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum ProductType {
  SAVINGS = 'SAVINGS',
  CURRENT = 'CURRENT',
  FIXED_DEPOSIT = 'FIXED_DEPOSIT',
  LOAN = 'LOAN',
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsEnum(ProductType)
  productType: ProductType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minBalance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxBalance?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  interestRate?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  minTenorDays?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  maxTenorDays?: number;

  @IsOptional()
  @IsString()
  glAccountId?: string;
}
