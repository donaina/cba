import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsInt,
  IsPositive,
  IsArray,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateMakerCheckerRuleDto {
  @IsString()
  @IsNotEmpty()
  module: string;

  @IsString()
  @IsNotEmpty()
  action: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  requiresApprovalAbove?: number;

  @IsArray()
  @IsString({ each: true })
  channels: string[];

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  requiredApprovers: number;

  @IsInt()
  @IsPositive()
  @Type(() => Number)
  ttlMinutes: number;
}
