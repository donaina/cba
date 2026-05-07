import { IsString, IsOptional, Length } from 'class-validator';

export class InwardCreditDto {
  @IsString()
  sessionId: string;

  @IsString()
  amount: string;

  @IsString()
  @Length(10, 10)
  beneficiaryAccountNumber: string;

  @IsOptional()
  @IsString()
  senderAccount?: string;

  @IsOptional()
  @IsString()
  narration?: string;
}
