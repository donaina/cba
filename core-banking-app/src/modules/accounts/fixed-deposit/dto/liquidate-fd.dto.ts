import { IsEnum } from 'class-validator';
import { LiquidationReason } from '@prisma/client';

export class LiquidateFdDto {
  @IsEnum(LiquidationReason)
  reason: LiquidationReason;
}
