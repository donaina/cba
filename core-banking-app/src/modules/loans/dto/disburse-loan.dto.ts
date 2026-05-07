import { IsEnum, IsString } from 'class-validator';
import { DisbursementMode } from '@prisma/client';

export class DisburseLoanDto {
  @IsString()
  targetAccountId: string;

  @IsEnum(DisbursementMode)
  mode: DisbursementMode;
}
