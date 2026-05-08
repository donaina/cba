import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PullCreditReportDto {
  @ApiProperty({ description: 'Customer UUID' })
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @ApiPropertyOptional({ description: 'Loan application UUID to link the report to' })
  @IsOptional()
  @IsString()
  loanApplicationId?: string;

  @ApiPropertyOptional({ example: 'CRC', description: 'Credit bureau to query (default: CRC)' })
  @IsOptional()
  @IsString()
  bureau?: string = 'CRC';
}
