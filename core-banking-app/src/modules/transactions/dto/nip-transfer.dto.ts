import { IsString, IsOptional, Matches, IsNotEmpty, Length } from 'class-validator';

export class NipTransferDto {
  @IsString()
  @IsNotEmpty()
  fromAccountId: string;

  @IsString()
  @Matches(/^\d{10}$/, { message: 'beneficiaryAccountNumber must be exactly 10 digits' })
  beneficiaryAccountNumber: string;

  @IsString()
  @Matches(/^\d{3}$/, { message: 'beneficiaryBankCode must be exactly 3 digits' })
  beneficiaryBankCode: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a valid decimal string' })
  amount: string;

  @IsString()
  @IsOptional()
  narration?: string;
}
