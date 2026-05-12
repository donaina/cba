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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGlAccountDto {
  @ApiProperty({ example: 'SAVINGS_CONTROL', description: 'Unique symbolic GL code used by PostingEngine' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: '2001', description: 'Numeric GL account number for chart of accounts (1xxx=Assets, 2xxx=Liabilities, 3xxx=Equity, 4xxx=Income, 5xxx=Expense)' })
  @IsOptional()
  @IsString()
  accountNumber?: string;

  @ApiProperty({ example: 'Savings Control Account', description: 'Human-readable account name' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: GlAccountType })
  @IsEnum(GlAccountType)
  type: GlAccountType;

  @ApiProperty({ enum: GlAccountLevel })
  @IsEnum(GlAccountLevel)
  level: GlAccountLevel;

  @ApiProperty({ enum: NormalBalance, description: 'DEBIT increases assets/expenses; CREDIT increases liabilities/equity/income' })
  @IsEnum(NormalBalance)
  normalBalance: NormalBalance;

  @ApiPropertyOptional({ description: 'Parent GL account UUID (for sub-ledger hierarchy)' })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiPropertyOptional({ default: false, description: 'Whether this is a reserved system account (used by PostingEngine)' })
  @IsOptional()
  @IsBoolean()
  isSystemAccount?: boolean = false;

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  description?: string;
}
