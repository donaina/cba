import { IsDateString, IsNumberString, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateOverdraftDto {
  @ApiProperty({ description: 'UUID of the current account' })
  @IsUUID()
  accountId: string;

  @ApiProperty({ example: '500000', description: 'Overdraft limit as decimal string' })
  @IsNumberString()
  limit: string;

  @ApiProperty({ example: '0.24', description: 'Annual interest rate as decimal (e.g. 0.24 = 24%)' })
  @IsNumberString()
  interestRate: string;

  @ApiPropertyOptional({ example: '2027-12-31', description: 'Expiry date ISO 8601' })
  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}
