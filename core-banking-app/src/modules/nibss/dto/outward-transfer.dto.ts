import { IsString, IsOptional, IsNumberString } from 'class-validator';

export class OutwardTransferDto {
  @IsString()
  sessionId: string;

  @IsString()
  amount: string;

  @IsString()
  beneficiaryAccount: string;

  @IsString()
  beneficiaryBank: string;

  @IsOptional()
  @IsString()
  narration?: string;
}
