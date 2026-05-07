import { IsString, IsOptional, Matches, IsNotEmpty } from 'class-validator';

export class DepositDto {
  @IsString()
  @IsNotEmpty()
  accountId: string;

  @IsString()
  @Matches(/^\d+(\.\d+)?$/, { message: 'amount must be a valid decimal string' })
  amount: string;

  @IsString()
  @IsOptional()
  narration?: string;

  @IsString()
  @IsOptional()
  channel?: string;
}
