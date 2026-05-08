import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { LoanClassification } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class LoanPortfolioQueryDto {
  @ApiPropertyOptional({ enum: LoanClassification, description: 'Filter by CBN DPD classification' })
  @IsOptional()
  @IsEnum(LoanClassification)
  classification?: LoanClassification;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'Portfolio snapshot date (ISO 8601, defaults to today)' })
  @IsOptional()
  @IsDateString()
  asAt?: string;
}
