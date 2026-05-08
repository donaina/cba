import {
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';
import { RepaymentFrequency, RepaymentMethod } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyLoanDto {
  @ApiProperty({ description: 'Customer UUID' })
  @IsUUID()
  customerId: string;

  @ApiProperty({ description: 'Loan product UUID' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: '500000', description: 'Requested principal amount as decimal string' })
  @IsNumberString()
  requestedAmount: string;

  @ApiProperty({ example: 365, description: 'Loan tenor in days' })
  @IsInt()
  @Min(1)
  tenorDays: number;

  @ApiProperty({ enum: RepaymentMethod })
  @IsEnum(RepaymentMethod)
  repaymentMethod: RepaymentMethod;

  @ApiProperty({ enum: RepaymentFrequency })
  @IsEnum(RepaymentFrequency)
  repaymentFrequency: RepaymentFrequency;

  @ApiPropertyOptional({ example: 'Working capital', description: 'Loan purpose' })
  @IsString()
  @IsOptional()
  purpose?: string;
}
