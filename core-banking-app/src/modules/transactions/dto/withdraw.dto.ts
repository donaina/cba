import { IsString, IsOptional, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WithdrawDto {
  @ApiProperty({ description: 'Account UUID to debit' })
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ example: '20000', description: 'Withdrawal amount as decimal string' })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a valid decimal string' })
  amount: string;

  @ApiPropertyOptional({ example: 'Cash withdrawal', description: 'Transaction narration' })
  @IsString()
  @IsOptional()
  narration?: string;

  @ApiPropertyOptional({ example: 'OTC', description: 'Transaction channel' })
  @IsString()
  @IsOptional()
  channel?: string;
}
