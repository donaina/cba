import { IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRateBandDto {
  @ApiProperty({ example: 0, description: 'Lower bound of principal range (inclusive, NGN)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minAmount: number;

  @ApiProperty({ example: 1000000, description: 'Upper bound of principal range (inclusive, NGN)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxAmount: number;

  @ApiProperty({ example: 0.12, description: 'Annual interest rate for this band (e.g. 0.12 = 12%)' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  rate: number;
}
