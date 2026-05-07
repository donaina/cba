import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRateBandDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAmount: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAmount: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rate: number;
}
