import { IsDateString } from 'class-validator';

export class TrialBalanceQueryDto {
  @IsDateString()
  asAt: string;
}
