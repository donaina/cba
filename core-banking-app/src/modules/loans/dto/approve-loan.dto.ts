import { IsInt, IsNumberString, IsOptional, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveLoanDto {
  @ApiProperty({ example: '500000', description: 'Approved principal amount as decimal string' })
  @IsNumberString()
  approvedAmount: string;

  @ApiProperty({ example: '0.18', description: 'Approved annual interest rate (e.g. 0.18 = 18%)' })
  @IsNumberString()
  approvedRate: string;

  @ApiPropertyOptional({ example: 365, description: 'Override tenor in days (defaults to applied tenor)' })
  @IsInt()
  @Min(1)
  @IsOptional()
  approvedTenor?: number;
}
