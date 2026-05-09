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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ProductType {
  SAVINGS = 'SAVINGS',
  CURRENT = 'CURRENT',
  FIXED_DEPOSIT = 'FIXED_DEPOSIT',
  LOAN = 'LOAN',
}

export enum InterestRateType {
  FLAT_RATE = 'FLAT_RATE',
  REDUCING_BALANCE = 'REDUCING_BALANCE',
  FIXED = 'FIXED',
  VARIABLE = 'VARIABLE',
}

export enum AccrualFrequency {
  DAILY = 'DAILY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
  ANNUAL = 'ANNUAL',
  AT_MATURITY = 'AT_MATURITY',
}

export class CreateProductDto {
  @ApiProperty({ example: 'Regular Savings', description: 'Product name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'REG_SAV', description: 'Unique product code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ enum: ProductType })
  @IsEnum(ProductType)
  productType: ProductType;

  @ApiPropertyOptional({ description: 'Product description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 0, description: 'Minimum balance requirement' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minBalance?: number;

  @ApiPropertyOptional({ example: 300000, description: 'Maximum balance cap (KYC tier limit)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxBalance?: number;

  @ApiPropertyOptional({ example: 0.04, description: 'Default annual interest rate (e.g. 0.04 = 4%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  interestRate?: number;

  @ApiPropertyOptional({ enum: InterestRateType, default: InterestRateType.FLAT_RATE, description: 'How interest is calculated (loan products)' })
  @IsOptional()
  @IsEnum(InterestRateType)
  interestRateType?: InterestRateType;

  @ApiPropertyOptional({ enum: AccrualFrequency, default: AccrualFrequency.MONTHLY, description: 'How often interest accrues/pays — maps to amortization periodsPerYear' })
  @IsOptional()
  @IsEnum(AccrualFrequency)
  accrualFrequency?: AccrualFrequency;

  @ApiPropertyOptional({ example: 30, description: 'Minimum tenor in days (FD/loan products)' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  minTenorDays?: number;

  @ApiPropertyOptional({ example: 365, description: 'Maximum tenor in days (FD/loan products)' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  maxTenorDays?: number;

  @ApiPropertyOptional({ description: 'GL control account UUID for this product' })
  @IsOptional()
  @IsString()
  glAccountId?: string;
}
