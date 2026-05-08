import {
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';
import {
  InterestPaymentFrequency,
  InterestPaymentType,
  MaturityInstruction,
} from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OpenFdDto {
  @ApiProperty({ description: 'Customer UUID' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'FD product UUID' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ description: 'Branch UUID' })
  @IsUUID()
  @IsOptional()
  branchId?: string;

  @ApiProperty({ description: 'Savings/current account to debit for principal' })
  @IsUUID()
  sourceAccountId: string;

  @ApiProperty({ example: '1000000', description: 'Principal amount as decimal string' })
  @IsNumberString()
  principal: string;

  @ApiProperty({ example: '0.12', description: 'Negotiated annual interest rate (e.g. 0.12 = 12%)' })
  @IsNumberString()
  negotiatedRate: string;

  @ApiProperty({ example: 180, description: 'Fixed deposit tenor in days' })
  @IsInt()
  @Min(1)
  tenorDays: number;

  @ApiProperty({ enum: InterestPaymentType })
  @IsEnum(InterestPaymentType)
  interestPaymentType: InterestPaymentType;

  @ApiPropertyOptional({ enum: InterestPaymentFrequency })
  @IsEnum(InterestPaymentFrequency)
  @IsOptional()
  interestPaymentFrequency?: InterestPaymentFrequency;

  @ApiProperty({ enum: MaturityInstruction })
  @IsEnum(MaturityInstruction)
  maturityInstruction: MaturityInstruction;

  @ApiPropertyOptional({ description: 'Target account for rollover principal (required when maturityInstruction = ROLLOVER)' })
  @IsUUID()
  @IsOptional()
  rolloverTargetAccountId?: string;
}
