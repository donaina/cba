import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { LoanClassification } from '@prisma/client';

export class LoanPortfolioQueryDto {
  @IsOptional()
  @IsEnum(LoanClassification)
  classification?: LoanClassification;

  @IsOptional()
  @IsDateString()
  asAt?: string;
}
