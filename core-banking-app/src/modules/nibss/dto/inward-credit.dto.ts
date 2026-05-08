import { IsString, IsOptional, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InwardCreditDto {
  @ApiProperty({ description: 'NIBSS NIP session ID' })
  @IsString()
  sessionId: string;

  @ApiProperty({ example: '50000', description: 'Credit amount as decimal string' })
  @IsString()
  amount: string;

  @ApiProperty({ example: '0123456789', description: '10-digit NUBAN beneficiary account number' })
  @IsString()
  @Length(10, 10)
  beneficiaryAccountNumber: string;

  @ApiPropertyOptional({ description: "Sender's account number" })
  @IsOptional()
  @IsString()
  senderAccount?: string;

  @ApiPropertyOptional({ example: 'Salary payment', description: 'Transaction narration' })
  @IsOptional()
  @IsString()
  narration?: string;
}
