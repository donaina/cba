import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoleDto {
  @ApiProperty({ example: 'BRANCH_MANAGER' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Can approve transactions up to ₦500k' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: ['txn:deposit', 'txn:withdraw', 'loan:read'], description: 'List of permission codes to assign' })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissionCodes: string[];
}
