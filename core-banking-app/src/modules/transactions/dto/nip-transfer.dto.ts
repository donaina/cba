import { IsString, IsOptional, Matches, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NipTransferDto {
  @ApiProperty({ description: 'Source account UUID' })
  @IsString()
  @IsNotEmpty()
  fromAccountId: string;

  @ApiProperty({ example: '0123456789', description: '10-digit NUBAN beneficiary account number (NUBAN-validated)' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'beneficiaryAccountNumber must be exactly 10 digits' })
  beneficiaryAccountNumber: string;

  @ApiProperty({ example: '058', description: '3-digit CBN bank code' })
  @IsString()
  @Matches(/^\d{3}$/, { message: 'beneficiaryBankCode must be exactly 3 digits' })
  beneficiaryBankCode: string;

  @ApiProperty({ example: '25000', description: 'Transfer amount as decimal string (NIP fee tier applied automatically)' })
  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a valid decimal string' })
  amount: string;

  @ApiPropertyOptional({ example: 'School fees', description: 'Transaction narration' })
  @IsString()
  @IsOptional()
  narration?: string;
}
