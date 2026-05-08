import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransactionTypeDto {
  @ApiProperty({ example: 'NIP_TRANSFER', description: 'Unique transaction type code' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'NIP Inter-bank Transfer', description: 'Display name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'TRANSFER', description: 'Category (DEPOSIT, WITHDRAWAL, TRANSFER, etc.)' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ example: 10.75, description: 'Fixed fee amount (NGN)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  flatFee: number;

  @ApiProperty({ example: 0, description: 'Percentage fee (e.g. 0.01 = 1%)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  percentageFee: number;

  @ApiProperty({ example: 0, description: 'Minimum fee floor (NGN)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minFee: number;

  @ApiProperty({ example: 100, description: 'Maximum fee cap (NGN)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxFee: number;

  @ApiProperty({ example: true, description: 'Whether VAT (7.5%) applies to the fee' })
  @IsBoolean()
  vatApplicable: boolean;

  @ApiProperty({ example: false, description: 'Whether WHT applies' })
  @IsBoolean()
  whtApplicable: boolean;

  @ApiPropertyOptional({ example: 100000, description: 'Trigger maker-checker if amount exceeds this (NGN)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  requiresApprovalAbove?: number;

  @ApiProperty({ example: ['MOBILE', 'INTERNET'], description: 'Channels that require approval' })
  @IsArray()
  @IsString({ each: true })
  approvalChannels: string[];
}
