import { IsNumberString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RepayLoanDto {
  @ApiProperty({ example: '50000', description: 'Repayment amount as decimal string (waterfall: penalty → interest → principal)' })
  @IsNumberString()
  amount: string;

  @ApiPropertyOptional({ example: 'CASH', description: 'Payment channel' })
  @IsString()
  @IsOptional()
  channel?: string;
}
