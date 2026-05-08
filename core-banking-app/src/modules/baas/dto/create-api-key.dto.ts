import { IsString, IsArray, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateApiKeyDto {
  @ApiProperty({ example: 'Production Key', description: 'Human-readable label for this API key' })
  @IsString()
  name: string;

  @ApiProperty({ example: ['txn:read', 'account:read'], description: 'List of permission scopes', type: [String] })
  @IsArray()
  @IsString({ each: true })
  scopes: string[];

  @ApiPropertyOptional({ example: '2025-12-31T23:59:59Z', description: 'ISO 8601 expiry datetime (omit for no expiry)' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
