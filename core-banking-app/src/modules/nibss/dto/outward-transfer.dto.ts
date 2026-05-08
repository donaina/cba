import { IsString, IsOptional, IsNumberString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OutwardTransferDto {
  @ApiProperty({ description: 'NIBSS NIP session ID' })
  @IsString()
  sessionId: string;

  @ApiProperty({ example: '25000', description: 'Transfer amount as decimal string' })
  @IsString()
  amount: string;

  @ApiProperty({ example: '0123456789', description: '10-digit NUBAN beneficiary account number' })
  @IsString()
  beneficiaryAccount: string;

  @ApiProperty({ example: '058', description: '3-digit CBN beneficiary bank code' })
  @IsString()
  beneficiaryBank: string;

  @ApiPropertyOptional({ example: 'School fees', description: 'Transaction narration' })
  @IsOptional()
  @IsString()
  narration?: string;
}
