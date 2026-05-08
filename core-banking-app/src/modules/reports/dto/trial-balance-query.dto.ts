import { IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TrialBalanceQueryDto {
  @ApiProperty({ example: '2024-12-31', description: 'Reporting date — trial balance is computed as at this date (ISO 8601)' })
  @IsDateString()
  asAt: string;
}
