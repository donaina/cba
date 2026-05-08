import { IsString, IsOptional, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DepositDto {
  @ApiProperty({ description: 'Account UUID to credit' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ example: '50000', description: 'Deposit amount as decimal string' })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a valid decimal string' })
  amount: string;

  @ApiPropertyOptional({ example: 'Cash deposit at teller', description: 'Transaction narration' })
  @IsString()
  @IsOptional()
  narration?: string;

  @ApiPropertyOptional({ example: 'OTC', description: 'Transaction channel' })
  @IsString()
  @IsOptional()
  channel?: string;
}
