import { IsNumberString, IsOptional, IsString } from 'class-validator';

export class RepayLoanDto {
  @IsNumberString()
  amount: string;

  @IsString()
  @IsOptional()
  channel?: string;
}
