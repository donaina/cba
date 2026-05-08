import { IsEnum, IsString } from 'class-validator';
import { DisbursementMode } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class DisburseLoanDto {
  @ApiProperty({ description: 'Account UUID to credit disbursement proceeds' })
  @IsString()
  targetAccountId: string;

  @ApiProperty({ enum: DisbursementMode, description: 'Disbursement channel' })
  @IsEnum(DisbursementMode)
  mode: DisbursementMode;
}
