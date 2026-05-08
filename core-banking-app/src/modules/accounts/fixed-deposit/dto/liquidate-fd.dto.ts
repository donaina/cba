import { IsEnum } from 'class-validator';
import { LiquidationReason } from '@prisma/client';
import { ApiProperty } from '@nestjs/swagger';

export class LiquidateFdDto {
  @ApiProperty({ enum: LiquidationReason, description: 'Reason for early liquidation' })
  @IsEnum(LiquidationReason)
  reason: LiquidationReason;
}
