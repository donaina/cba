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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMakerCheckerRuleDto {
  @ApiProperty({ example: 'transactions', description: 'Module this rule applies to' })
  @IsString()
  @IsNotEmpty()
  module: string;

  @ApiProperty({ example: 'OTC_DEPOSIT', description: 'Action/operation requiring approval' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiPropertyOptional({ example: 100000, description: 'Trigger approval only when amount exceeds this (NGN)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  requiresApprovalAbove?: number;

  @ApiProperty({ example: ['MOBILE', 'INTERNET'], description: 'Channels where this rule applies' })
  @IsArray()
  @IsString({ each: true })
  channels: string[];

  @ApiProperty({ example: 1, description: 'Number of approvers required' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  requiredApprovers: number;

  @ApiProperty({ example: 60, description: 'Request expiry window in minutes' })
  @IsInt()
  @IsPositive()
  @Type(() => Number)
  ttlMinutes: number;
}
