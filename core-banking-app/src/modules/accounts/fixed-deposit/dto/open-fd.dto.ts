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

export class OpenFdDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  productId: string;

  @IsUUID()
  @IsOptional()
  branchId?: string;

  @IsUUID()
  sourceAccountId: string;

  @IsNumberString()
  principal: string;

  @IsNumberString()
  negotiatedRate: string;

  @IsInt()
  @Min(1)
  tenorDays: number;

  @IsEnum(InterestPaymentType)
  interestPaymentType: InterestPaymentType;

  @IsEnum(InterestPaymentFrequency)
  @IsOptional()
  interestPaymentFrequency?: InterestPaymentFrequency;

  @IsEnum(MaturityInstruction)
  maturityInstruction: MaturityInstruction;

  @IsUUID()
  @IsOptional()
  rolloverTargetAccountId?: string;
}
