import { IsOptional, IsNumber, IsString, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AuditLogQueryDto {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ type: Number, default: 20 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ description: 'Filter by user UUID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: '/api/v1/transactions/deposit', description: 'Filter by request path' })
  @IsOptional()
  @IsString()
  path?: string;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'ISO 8601 date range start' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'ISO 8601 date range end' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
