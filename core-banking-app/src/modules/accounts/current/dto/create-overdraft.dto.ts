import { IsDateString, IsNumberString, IsOptional, IsUUID } from 'class-validator';

export class CreateOverdraftDto {
  @IsUUID()
  accountId: string;

  @IsNumberString()
  limit: string;

  @IsNumberString()
  interestRate: string;

  @IsDateString()
  @IsOptional()
  expiryDate?: string;
}
