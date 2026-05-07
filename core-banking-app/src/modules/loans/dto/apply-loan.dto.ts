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

export class ApplyLoanDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  productId: string;

  @IsNumberString()
  requestedAmount: string;

  @IsInt()
  @Min(1)
  tenorDays: number;

  @IsEnum(RepaymentMethod)
  repaymentMethod: RepaymentMethod;

  @IsEnum(RepaymentFrequency)
  repaymentFrequency: RepaymentFrequency;

  @IsString()
  @IsOptional()
  purpose?: string;
}
