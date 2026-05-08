import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveTransactionDto {
  @ApiPropertyOptional({ description: 'Transaction UUID (use this or makerCheckerRequestId)' })
  @IsString()
  @IsOptional()
  transactionId?: string;

  @ApiPropertyOptional({ description: 'Maker-checker request UUID (use this or transactionId)' })
  @IsString()
  @IsOptional()
  makerCheckerRequestId?: string;
}
