import {
  IsString,
  IsNotEmpty,
  IsBoolean,
  IsOptional,
  IsNumber,
  Min,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTransactionTypeDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  flatFee: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  percentageFee: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  minFee: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  maxFee: number;

  @IsBoolean()
  vatApplicable: boolean;

  @IsBoolean()
  whtApplicable: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  requiresApprovalAbove?: number;

  @IsArray()
  @IsString({ each: true })
  approvalChannels: string[];
}
