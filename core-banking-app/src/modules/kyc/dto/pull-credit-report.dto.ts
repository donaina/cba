import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class PullCreditReportDto {
  @IsString()
  @IsNotEmpty()
  customerId: string;

  @IsOptional()
  @IsString()
  loanApplicationId?: string;

  @IsOptional()
  @IsString()
  bureau?: string = 'CRC';
}
