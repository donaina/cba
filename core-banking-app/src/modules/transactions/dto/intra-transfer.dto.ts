import { IsString, IsOptional, Matches, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class IntraTransferDto {
  @ApiProperty({ description: 'Source account UUID' })
  @IsString()
  @IsNotEmpty()
  fromAccountId: string;

  @ApiProperty({ description: 'Destination account UUID' })
  @IsString()
  @IsNotEmpty()
  toAccountId: string;

  @ApiProperty({ example: '10000', description: 'Transfer amount as decimal string' })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a valid decimal string' })
  amount: string;

  @ApiPropertyOptional({ example: 'Rent payment', description: 'Transaction narration' })
  @IsString()
  @IsOptional()
  narration?: string;

  @ApiPropertyOptional({ example: 'MOBILE', description: 'Transaction channel' })
  @IsString()
  @IsOptional()
  channel?: string;
}
