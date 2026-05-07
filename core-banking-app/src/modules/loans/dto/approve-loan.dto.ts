import { IsInt, IsNumberString, IsOptional, Min } from 'class-validator';

export class ApproveLoanDto {
  @IsNumberString()
  approvedAmount: string;

  @IsNumberString()
  approvedRate: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  approvedTenor?: number;
}
